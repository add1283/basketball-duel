const test = require('node:test');
const assert = require('node:assert');
const R = require('../lib/rules');

function room(now = 0) {
  const r = R.initialRoom('ABC123', now);
  r.guestJoined = true;
  R.startMatch(r, now);
  return r;
}
let T = 5000;
// play one attack, return the result and move on to the next attack
function play(r, att, def) {
  const m = r.match;
  const a = m.possession, d = a === 'host' ? 'guest' : 'host';
  if (att) assert.equal(R.submitMove(r, a, { poss: m.poss, ...att }, T), null);
  if (def) assert.equal(R.submitMove(r, d, { poss: m.poss, lane: def }, T), null);
  R.advance(r, att && def ? T : m.deadline + 1);
  const last = m.last;
  T = m.revealUntil + 1;
  R.advance(r, T);
  return last;
}

test('a made 2-pointer scores 2 points, scorer shoots again', () => {
  const r = room(); const a = r.match.possession;
  const last = play(r, { mode: 'shot2', lane: 'L', err: 0 }, 'R');
  assert.equal(last.result, 'swish'); assert.equal(last.pts, 2);
  assert.equal(r.match.score[a], 2);
  assert.equal(r.match.possession, a);
});

test("a 1-pointer scores 1 point, shot from inside the lane", () => {
  const r = room();
  const last = play(r, { mode: 'shot1', lane: 'C', err: 0 }, 'L');
  assert.equal(last.pts, 1);
  assert.ok(Math.hypot(last.spot.x, last.spot.d) < 0.9);
});

test('on a block or a miss the ball goes to the opponent', () => {
  const r = room(); const a = r.match.possession;
  play(r, { mode: 'shot1', lane: 'C', err: 2.5 }, 'R');      // airball/long
  assert.notEqual(r.match.possession, a);
});

test('no steal against a shot, the defender is left out of position', () => {
  const r = room();
  const last = play(r, { mode: 'shot2', lane: 'R', err: 0.06 }, 'S');
  assert.equal(last.open, true);
  assert.notEqual(last.result, 'steal');
});

test('layup/dunk: HOOP blocks, STEAL steals, free path against a defender contesting the shot; all worth 1 point', () => {
  const seen = new Set(); const stat = {};
  for (let i = 0; i < 400; i++) {
    const r = R.initialRoom('R' + i); r.guestJoined = true; R.startMatch(r, 0);
    const mode = i % 2 ? 'layup' : 'dunk';
    const def = ['L', 'P', 'S', 'R'][Math.floor(i / 2) % 4];
    const last = play(r, { mode }, def);              // no direction/power needed
    seen.add(last.result);
    assert.ok(last.pts === 0 || last.pts === 1);
    if (last.result === 'steal') assert.equal(def, 'S');
    if (last.result === 'block' || last.result === 'poster') assert.equal(def, 'P');
    const k = mode + ':' + def; stat[k] = stat[k] || [0, 0]; stat[k][0] += last.made ? 1 : 0; stat[k][1]++;
  }
  for (const k of ['layup', 'dunk', 'poster', 'steal', 'block', 'layup_miss']) assert.ok(seen.has(k), k);
  const rate = k => stat[k][0] / stat[k][1];
  assert.ok(rate('layup:L') > rate('layup:P') && rate('layup:L') > rate('layup:S'));
  assert.ok(rate('dunk:R') > rate('dunk:P'));
});

test('possession changes when the clock runs out', () => {
  const r = room(); const a = r.match.possession;
  const last = play(r, null, null);
  assert.equal(last.result, 'clock');
  assert.notEqual(r.match.possession, a);
});

test("first to 15 wins but must lead by 3; otherwise overtime", () => {
  const m = { score: { host: 15, guest: 13 } };
  assert.equal(R.checkWinner(m), null);                 // lead of 2 → overtime
  m.score = { host: 15, guest: 15 }; assert.equal(R.checkWinner(m), null);
  m.score = { host: 16, guest: 13 }; assert.equal(R.checkWinner(m), 'host');
  m.score = { host: 15, guest: 12 }; assert.equal(R.checkWinner(m), 'host');
  m.score = { host: 14, guest: 2 }; assert.equal(R.checkWinner(m), null);

  const r = room(); const a = r.match.possession;
  r.match.score[a] = 14; r.match.score[a === 'host' ? 'guest' : 'host'] = 13;
  play(r, { mode: 'shot1', lane: 'L', err: 0 }, 'R');     // 15-13
  assert.equal(r.match.winner, null); assert.equal(r.match.overtime, true);
  play(r, { mode: 'shot2', lane: 'L', err: 0 }, 'R');     // 17-13
  assert.equal(r.match.winner, a); assert.equal(r.match.phase, 'over');
  assert.equal(r.series[a], 1);
});

test("the opponent's move is hidden, invalid moves are rejected", () => {
  const r = room(); const m = r.match; const a = m.possession, d = a === 'host' ? 'guest' : 'host';
  assert.ok(R.submitMove(r, a, { poss: 0, mode: 'fly', lane: 'L' }, T));
  assert.ok(R.submitMove(r, a, { poss: 0, mode: 'shot1', lane: 'X', err: 0 }, T));
  assert.ok(R.submitMove(r, d, { poss: 0, lane: 'X' }, T));
  assert.equal(R.submitMove(r, a, { poss: 0, mode: 'layup' }, T), null);
  const v = R.view(r, d, T);
  assert.equal(v.match.myMove, null); assert.equal(v.match.oppReady, true);
});

test('player abilities affect the hit band', () => {
  const r = room(); const m = r.match;
  const base = R.shotSpot(r, m, 2).band;
  const Tm = require('../lib/teams');
  let best = null;
  for (const team of Tm.TEAMS) team.players.forEach((p, i) => { if (!best || p.three > best.p.three) best = { team, i, p }; });
  r.picks[m.possession] = { teamId: best.team.id, playerIdx: best.i };
  assert.ok(R.shotSpot(r, m, 2).band > base);
});

test('even when the correct side is closed it sometimes goes in despite the defense; yellow zone sometimes goes in', () => {
  const seen = new Set(); let yellowIn = 0, yellowOut = 0;
  for (let i = 0; i < 200; i++) {
    const r = R.initialRoom('Q' + i); r.guestJoined = true; R.startMatch(r, 0);
    const a = play(r, { mode: 'shot1', lane: 'L', err: 0 }, 'L');
    seen.add(a.result + (a.contested ? '+c' : ''));
    const r2 = R.initialRoom('Y' + i); r2.guestJoined = true; R.startMatch(r2, 0);
    const band = R.shotSpot(r2, r2.match, 1).band;
    const b = play(r2, { mode: 'shot1', lane: 'R', err: band / 2 * 1.3 }, 'L');   // yellow zone
    if (b.made) yellowIn++; else yellowOut++;
  }
  assert.ok(seen.has('block')); assert.ok([...seen].some(x => x.endsWith('+c')), 'basket despite the defense');
  assert.ok(yellowIn > 20 && yellowOut > 20, `yellow: ${yellowIn}/${yellowOut}`);
});

test('height/weight: a tall, heavy center\'s dunk is blocked less often by a short, light defender', () => {
  const Tm = require('../lib/teams');
  const all = []; for (const t of Tm.TEAMS) t.players.forEach((p, i) => all.push({ t, i, p }));
  if (!all[0].p.h) return;                         // skip if the data isn't there yet
  const big = all.reduce((a, b) => (b.p.h + b.p.w > a.p.h + a.p.w ? b : a));
  const small = all.reduce((a, b) => (b.p.h + b.p.w < a.p.h + a.p.w ? b : a));
  const rate = (att, def) => {
    let blocks = 0;
    for (let i = 0; i < 300; i++) {
      const r = R.initialRoom('B' + i); r.guestJoined = true; R.startMatch(r, 0);
      const m = r.match; const o = m.possession === 'host' ? 'guest' : 'host';
      r.picks[m.possession] = { teamId: att.t.id, playerIdx: att.i };
      r.picks[o] = { teamId: def.t.id, playerIdx: def.i };
      if (play(r, { mode: 'dunk' }, 'P').result === 'block') blocks++;
    }
    return blocks;
  };
  assert.ok(rate(big, small) < rate(small, big));
});

test('quarters: a quarter ends after 8 attacks, break, substitution, ready; half-time break after the 2nd quarter', () => {
  const r = room(); const m = r.match;
  const first = m.possession;
  for (let i = 0; i < 8; i++) play(r, { mode: 'shot1', lane: 'C', err: 2.5 }, 'L');   // all of them miss
  assert.equal(m.phase, 'break'); assert.equal(m.breakKind, 'quarter');
  r.picks = { host: { teamId: 'lsc', playerIdx: 0 }, guest: { teamId: 'blc', playerIdx: 0 } };
  assert.ok(R.submitMove(r, m.possession, { poss: m.poss, mode: 'shot1', lane: 'C', err: 0 }, T));
  assert.equal(R.substitute(r, 'host', 2), null); assert.equal(r.picks.host.playerIdx, 2);
  R.setReady(r, 'host'); R.advance(r, T); assert.equal(m.phase, 'break');
  R.setReady(r, 'guest'); R.advance(r, T);
  assert.equal(m.phase, 'turn'); assert.equal(m.quarter, 2);
  assert.notEqual(m.possession, first);            // the other player starts the 2nd quarter
  assert.ok(R.substitute(r, 'host', 1));           // no substitutions during play
  T = m.startsAt + 1;
  for (let i = 0; i < 8; i++) play(r, { mode: 'shot1', lane: 'C', err: 2.5 }, 'L');
  assert.equal(m.breakKind, 'half');
});

test('after the 4th quarter the match ends if the lead is 3+, otherwise an overtime period', () => {
  const r = room(); const m = r.match;
  m.quarter = 4; m.qPoss = 7; m.score = { host: 10, guest: 9 };
  play(r, { mode: 'shot1', lane: 'C', err: 2.5 }, 'L');
  assert.equal(m.phase, 'break'); assert.equal(m.breakKind, 'ot'); assert.equal(m.overtime, true);
  T = m.breakUntil + 1; R.advance(r, T);
  assert.equal(m.quarter, 5); assert.equal(m.phase, 'turn');
  m.qPoss = 3; m.score = { host: 12, guest: 9 };
  T = m.startsAt + 1;
  play(r, { mode: 'shot1', lane: 'C', err: 2.5 }, 'L');
  assert.equal(m.phase, 'over'); assert.equal(m.winner, 'host');
});

test('match stats: attempts, makes, points, blocks, steals and best streak are recorded', () => {
  const r = room(); const m = r.match; const a = m.possession; const d = a === 'host' ? 'guest' : 'host';
  play(r, { mode: 'shot2', lane: 'L', err: 0 }, 'R');          // made 2
  play(r, { mode: 'shot1', lane: 'C', err: 0 }, 'L');          // made 1, streak 2
  const s = m.stats[a];
  assert.equal(s.att.shot2, 1); assert.equal(s.made.shot2, 1); assert.equal(s.made.shot1, 1);
  assert.equal(s.pts, 3); assert.equal(s.bestStreak, 2);
  assert.equal(R.view(r, d, T).match.stats[a].pts, 3);
});
