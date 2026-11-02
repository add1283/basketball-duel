// Basketball Duel – street basketball rules (server side, pure functions).
// The scorer shoots again; a miss / a steal loses the ball.
// Inside the lane is 1 point, beyond the three-point line is 2. First to 15 wins, but must lead by 3
// (tie or a lead of 2 or less → overtime, continues until the lead is 3).

(function (root, factory) {
  // Same rules for Node (Vercel function) and the browser (offline CPU mode)
  if (typeof module === 'object' && module.exports) {
    let teams = null;
    try { teams = require('./teams'); } catch (e) { teams = null; }
    module.exports = factory(teams);
  } else {
    root.PotaRules = factory(root.POTA_TEAMS);
  }
})(typeof window !== 'undefined' ? window : globalThis, function (TEAMS_IN) {
'use strict';

const TARGET = 15;
const WIN_BY = 3;
const QUARTERS = 4;
const POSS_PER_Q = 8;        // attacks per quarter
const OT_POSS = 4;           // overtime period
const BREAK_MS = 15000;      // quarter break
const HALF_MS = 25000;       // half-time break
const TURN_MS = 10000;       // 10 s for both attack and defense
const REVEAL_MS = 3600;      // result animation
const SHOT_LANES = ['L', 'C', 'R'];
const MODES = ['shot1', 'shot2', 'layup', 'dunk'];
const DEF_CHOICES = ['L', 'C', 'R', 'P', 'S'];   // L/C/R = contest the shot, P = protect the hoop, S = steal

// Attack starting spots (all beyond the three-point line)
const SPOTS = [
  { id: 'cornerL', name: 'Left corner', x: -0.98, d: 0.12, band: 0.11, diff: 0.7 },
  { id: 'cornerR', name: 'Right corner', x: 0.98, d: 0.12, band: 0.11, diff: 0.7 },
  { id: 'wingL', name: 'Left wing', x: -0.72, d: 0.7, band: 0.105, diff: 0.8 },
  { id: 'wingR', name: 'Right wing', x: 0.72, d: 0.7, band: 0.105, diff: 0.8 },
  { id: 'slotL', name: 'Left slot', x: -0.4, d: 0.92, band: 0.1, diff: 0.85 },
  { id: 'slotR', name: 'Right slot', x: 0.4, d: 0.92, band: 0.1, diff: 0.85 },
  { id: 'top', name: 'Top of the key', x: 0, d: 0.98, band: 0.1, diff: 0.9 },
];
// 1-point shot: one step into the lane from the same direction (mid range)
function insideOf(spot) {
  return { id: spot.id + 'In', name: 'Mid-range', x: spot.x * 0.55, d: spot.d * 0.55, band: 0.15, diff: 0.3 };
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const other = r => (r === 'host' ? 'guest' : 'host');

function spotFor(m, poss) {
  return SPOTS[Math.floor(hash(`${m.code}:${m.seed}:spot:${poss}`) * SPOTS.length)];
}

// Team/player data (neutral values if missing)
const TEAMS = TEAMS_IN || null;
const NEUTRAL = { name: 'Player', num: 7, pos: 'G', h: 200, w: 100, three: 0.65, two: 0.65, def: 0.65 };
// Body: height (size), weight/strength (mass), agility (quick) – roughly in the -1..+1.5 range
function body(p) {
  const h = p.h || 200, w = p.w || 100;
  const size = (h - 200) / 12;
  const mass = (w - 100) / 18;
  const quick = clamp(-0.6 * mass - 0.4 * size, -1.5, 1.5);
  return { size, mass, quick };
}
function playerOf(room, role) {
  const pk = room.picks && room.picks[role];
  const team = pk && TEAMS ? TEAMS.byId(pk.teamId) : null;
  return (team && team.players[pk.playerIdx]) || NEUTRAL;
}

// Shot spot and effective hit band (shooter skill widens it, defense narrows it)
function shotSpot(room, m, pts) {
  const base = spotFor(m, m.poss);
  const spot = pts === 2 ? base : insideOf(base);
  const ap = playerOf(room, m.possession), dp = playerOf(room, other(m.possession));
  const skill = pts === 2 ? ap.three : ap.two;
  const sz = clamp(body(ap).size - body(dp).size, -2, 2);
  const band = spot.band * (0.75 + 0.5 * skill) * (1.1 - 0.2 * dp.def) * (1 + 0.04 * sz);
  return { ...spot, pts, band: Math.round(band * 10000) / 10000 };
}

function initialRoom(code) {
  return {
    code,
    names: { host: '', guest: '' },
    series: { host: 0, guest: 0 },
    rematch: {},
    picks: {},
    match: null,
    seed: 1,
  };
}

// Per-player match stats (for the result card and personal stats)
function newStats() {
  return { pts: 0, att: { shot1: 0, shot2: 0, layup: 0, dunk: 0 }, made: { shot1: 0, shot2: 0, layup: 0, dunk: 0 },
    blocks: 0, steals: 0, posters: 0, bestStreak: 0 };
}
function recordStats(m, res) {
  if (!m.stats) m.stats = { host: newStats(), guest: newStats() };
  const a = m.stats[res.attacker], d = m.stats[res.defender];
  if (res.mode) { a.att[res.mode] += 1; if (res.made) a.made[res.mode] += 1; }
  a.pts += res.pts;
  if (res.result === 'block') d.blocks += 1;
  if (res.result === 'steal') d.steals += 1;
  if (res.result === 'poster') a.posters += 1;
  a.bestStreak = Math.max(a.bestStreak, res.streak || 0);
}

function startMatch(room, now) {
  const first = hash(`${room.code}:${room.seed}:first`) < 0.5 ? 'host' : 'guest';
  room.match = {
    code: room.code, seed: room.seed,
    phase: 'turn', poss: 0, possession: first,
    quarter: 1, qPoss: 0, qStarter: first, streak: { host: 0, guest: 0 }, ready: {},
    stats: { host: newStats(), guest: newStats() },
    score: { host: 0, guest: 0 },
    shots: { host: [], guest: [] },     // result of each attack
    moves: {},
    startsAt: now + 1500,
    deadline: now + 1500 + TURN_MS,
    last: null, winner: null, overtime: false,
  };
  room.rematch = {};
}

const MADE = new Set(['swish', 'in', 'rimin', 'layup', 'dunk', 'poster']);

function resolve(room, m) {
  const att = m.possession, def = other(att);
  const A = m.moves[att], D = m.moves[def];
  const dl = D ? D.lane : null;
  const ap = playerOf(room, att), dp = playerOf(room, def);
  const r1 = hash(`${m.code}:${m.seed}:r1:${m.poss}`);
  const r2 = hash(`${m.code}:${m.seed}:r2:${m.poss}`);
  const base = spotFor(m, m.poss);
  let result, pts = 0, spot = base, open = false;

  const ab = body(ap), db = body(dp);
  const dSize = db.size - ab.size, dMass = db.mass - ab.mass, dQuick = db.quick - ab.quick;
  const r3 = hash(`${m.code}:${m.seed}:r3:${m.poss}`);
  let contested = false;
  if (!A) result = 'clock';
  else if (A.mode === 'shot1' || A.mode === 'shot2') {
    const p = A.mode === 'shot2' ? 2 : 1;
    spot = shotSpot(room, m, p);
    pts = p;
    const skill = p === 2 ? ap.three : ap.two;
    let q0 = Math.abs(A.err) / (spot.band / 2);
    if (dl === A.lane) {
      // correct side was closed: block depending on height difference, defense and shot quality — or a shot despite the defense
      const block = clamp(0.68 + 0.1 * dSize + 0.25 * (dp.def - 0.65) - (q0 <= 0.35 ? 0.12 : 0), 0.3, 0.9);
      if (r1 < block) result = 'block';
      else contested = true;
    }
    if (!result) {
      open = dl === 'S' || dl === 'P';           // a defender who goes for the steal or waits at the hoop leaves the shooter open
      const band = spot.band * (dl === 'S' ? 1.4 : dl === 'P' ? 1.2 : contested ? 0.8 : 1);
      const q = Math.abs(A.err) / (band / 2);
      if (q <= 0.35) result = 'swish';
      else if (q <= 1) result = 'in';
      else if (q <= 1.7) {
        // yellow zone: may go in depending on the situation
        const pIn = clamp(0.35 + 0.35 * skill + (open ? 0.15 : 0) - (contested ? 0.12 : 0) + 0.04 * -dSize, 0.15, 0.8);
        result = r2 < pIn ? 'rimin' : (A.err < 0 ? 'short' : 'long');
      } else result = A.err < 0 ? 'airball' : 'long';
    }
  } else if (A.mode === 'layup' || A.mode === 'dunk') {
    // Simple rule: HOOP → block risk, STEAL → risk of the ball being stolen, contesting the shot (LEFT/CENTER/RIGHT) → free path to the hoop.
    // Layup: easy to steal, hard to block. Dunk: hard to steal; against HOOP it is either a block or a POSTER.
    pts = 1;
    const dunk = A.mode === 'dunk';
    const skill = dunk ? (ap.dunk ?? ap.two) : (ap.layup ?? ap.two);
    if (dl === 'S') {
      const steal = dunk
        ? clamp(0.25 + 0.4 * (dp.def - 0.65) + 0.06 * dQuick, 0.1, 0.45)
        : clamp(0.42 + 0.4 * (dp.def - 0.65) + 0.08 * dQuick - 0.2 * (skill - 0.65), 0.2, 0.65);
      if (r1 < steal) result = 'steal';
    } else if (dl === 'P') {
      const block = dunk
        ? clamp(0.5 + 0.4 * (dp.def - 0.65) + 0.12 * dSize + 0.08 * dMass - 0.5 * (skill - 0.65), 0.15, 0.8)
        : clamp(0.35 + 0.4 * (dp.def - 0.65) + 0.1 * dSize - 0.3 * (skill - 0.65), 0.12, 0.65);
      if (r1 < block) result = 'block';
      else contested = true;
    }
    if (!result) {
      let p = dunk ? 0.84 + 0.3 * (skill - 0.65) : 0.86 + 0.25 * (skill - 0.65);
      if (contested) p -= dunk ? 0 : 0.2;             // layup is harder against a defender at the hoop
      const ok = r2 < clamp(p, 0.35, 0.98);
      result = dunk ? (ok ? (contested ? 'poster' : 'dunk') : 'dunk_miss') : (ok ? 'layup' : 'layup_miss');
    }
  }

  const made = MADE.has(result);
  return {
    poss: m.poss, attacker: att, defender: def,
    shooter: att,                                // legacy client field name
    mode: A ? A.mode : null, lane: A ? A.lane : null, defLane: dl,
    spot: { id: spot.id, name: spot.name, x: spot.x, d: spot.d },
    from: { x: base.x, d: base.d },
    result, made, open, contested: contested && made, pts: made ? pts : 0,
    keeps: made,                                 // the scorer shoots again
  };
}

function checkWinner(m) {
  const h = m.score.host, g = m.score.guest;
  const top = Math.max(h, g);
  if (top >= TARGET && Math.abs(h - g) >= WIN_BY) return h > g ? 'host' : 'guest';
  return null;
}

function periodLen(m) { return m.quarter > QUARTERS ? OT_POSS : POSS_PER_Q; }

function advance(room, now) {
  const m = room.match;
  if (!m || !m.possession) return false;   // matches in the old format
  let changed = false;
  for (let guard = 0; guard < 5; guard++) {
    if (m.phase === 'turn') {
      const att = m.possession;
      if (!(m.moves[att] && m.moves[other(att)]) && now < m.deadline) break;
      const res = resolve(room, m);
      m.streak[att] = res.made ? (m.streak[att] || 0) + 1 : 0;
      res.streak = m.streak[att];
      recordStats(m, res);
      m.shots[att].push({ made: res.made, pts: res.pts, result: res.result });
      if (m.shots[att].length > 30) m.shots[att].shift();
      m.score[att] += res.pts;
      m.last = res;
      m.moves = {};
      m.phase = 'reveal';
      m.revealUntil = now + REVEAL_MS;
      m.qPoss += 1;
      m.winner = checkWinner(m);
      // end of period: when the 4th quarter or overtime ends, the match is over if the lead is 3+
      if (!m.winner && m.qPoss >= periodLen(m) && m.quarter >= QUARTERS && Math.abs(m.score.host - m.score.guest) >= WIN_BY) {
        m.winner = m.score.host > m.score.guest ? 'host' : 'guest';
      }
      const top = Math.max(m.score.host, m.score.guest);
      m.overtime = !m.winner && (top >= TARGET || m.quarter > QUARTERS || (m.quarter >= QUARTERS && m.qPoss >= periodLen(m)));
      changed = true;
    } else if (m.phase === 'reveal') {
      if (now < m.revealUntil) break;
      if (m.winner) {
        m.phase = 'over';
        room.series[m.winner] += 1;
      } else if (m.qPoss >= periodLen(m)) {
        m.phase = 'break';
        m.breakKind = m.quarter === 2 ? 'half' : m.quarter >= QUARTERS ? 'ot' : 'quarter';
        m.breakUntil = now + (m.breakKind === 'half' ? HALF_MS : BREAK_MS);
        m.ready = {};
      } else {
        if (!m.last.keeps) m.possession = other(m.possession);
        m.poss += 1;
        m.phase = 'turn';
        m.deadline = now + TURN_MS;
      }
      changed = true;
    } else if (m.phase === 'break') {
      if (now < m.breakUntil && !(m.ready.host && m.ready.guest)) break;
      m.quarter += 1;
      m.qPoss = 0;
      m.qStarter = other(m.qStarter);              // the other player starts each period
      m.possession = m.qStarter;
      m.poss += 1;
      m.phase = 'turn';
      m.startsAt = now + 1500;
      m.deadline = now + 1500 + TURN_MS;
      m.ready = {};
      changed = true;
    } else break;
  }
  return changed;
}

function submitMove(room, role, move, now) {
  const m = room.match;
  if (!m || m.phase !== 'turn') return 'e.notMoveTime';
  if (m.startsAt && now < m.startsAt) return 'e.notStarted';
  if (move.poss !== m.poss) return 'e.oldPoss';
  if (m.moves[role]) return 'e.alreadyMoved';
  if (role === m.possession) {
    if (!MODES.includes(move.mode)) return 'e.badMove';
    const drive = move.mode === 'layup' || move.mode === 'dunk';
    if (!drive && !SHOT_LANES.includes(move.lane)) return 'e.badLane';
    const mv = { mode: move.mode, lane: drive ? 'C' : move.lane };
    if (move.mode === 'shot1' || move.mode === 'shot2') {
      const err = Number(move.err);
      if (!Number.isFinite(err) || Math.abs(err) > 3) return 'e.badPower';
      mv.err = err;
    }
    m.moves[role] = mv;
  } else {
    if (!DEF_CHOICES.includes(move.lane)) return 'e.badDef';
    m.moves[role] = { lane: move.lane };
  }
  return null;
}

// Substitution and readiness during quarter/half breaks
function substitute(room, role, playerIdx) {
  const m = room.match;
  if (!m || m.phase !== 'break') return 'e.subOnlyBreak';
  const pk = room.picks && room.picks[role];
  if (!pk) return 'e.noTeam';
  const idx = Number(playerIdx);
  if (TEAMS) { const t = TEAMS.byId(pk.teamId); if (!t || !t.players[idx]) return 'e.badPlayer'; }
  else if (!(idx >= 0 && idx < 3)) return 'e.badPlayer';
  pk.playerIdx = idx;
  return null;
}
function setReady(room, role) {
  const m = room.match;
  if (!m || m.phase !== 'break') return 'e.notBreak';
  m.ready[role] = true;
  return null;
}

function setPick(room, role, pick) {
  if (!pick || typeof pick.teamId !== 'string') return 'e.pickTeam';
  const idx = Number(pick.playerIdx);
  if (TEAMS) {
    const t = TEAMS.byId(pick.teamId);
    if (!t || !t.players[idx]) return 'e.badPick';
  }
  if (room.match && room.match.phase !== 'over') return 'e.noTeamChangeDuring';
  room.picks = room.picks || {};
  room.picks[role] = { teamId: pick.teamId.slice(0, 8), playerIdx: idx };
  return null;
}

// View sent to the client: moves are hidden until the reveal moment
function view(room, role, now) {
  const m = room.match;
  let match = null;
  if (m && m.possession) {
    const opp = other(role);
    const base = spotFor(m, m.poss);
    match = {
      phase: m.phase, poss: m.poss, turn: m.poss, shooter: m.possession,
      spot: { ...base },
      shotSpots: { 1: shotSpot(room, m, 1), 2: shotSpot(room, m, 2) },
      shots: m.shots, score: m.score,
      deadline: m.deadline, revealUntil: m.revealUntil, startsAt: m.startsAt,
      myMove: m.moves[role] || null,
      oppReady: !!m.moves[opp],
      last: m.last, winner: m.winner, overtime: m.overtime,
      target: TARGET, winBy: WIN_BY, seed: m.seed,
      quarter: m.quarter, quarters: QUARTERS, qPoss: m.qPoss, periodLen: periodLen(m),
      breakKind: m.breakKind, breakUntil: m.breakUntil, ready: m.ready || {},
      streak: m.streak, stats: m.stats || null,
    };
  }
  return {
    code: room.code, role, now,
    names: room.names, series: room.series, picks: room.picks || {},
    guestJoined: !!room.guestJoined,
    rematch: room.rematch,
    match,
  };
}

return {
  TARGET, WIN_BY, TURN_MS, REVEAL_MS, SPOTS, MODES, QUARTERS, POSS_PER_Q, OT_POSS,
  hash, spotFor, insideOf, shotSpot, playerOf, body, initialRoom, startMatch, advance, submitMove, setPick,
  substitute, setReady,
  view, checkWinner, resolve,
};
});
