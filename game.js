(() => {
'use strict';
const $ = id => document.getElementById(id);
const COLOR = { host: '#ff6b1a', guest: '#2de2c5' };
const REVEAL_MS = 3600;   // must match the server
const T = (k, v) => (window.PotaI18n ? window.PotaI18n.t(k, v) : k);
const TL = (k, i) => (window.PotaI18n ? window.PotaI18n.list(k, i) : k);
const LANE_NAME = { get L() { return T('lane.L'); }, get C() { return T('lane.C'); }, get R() { return T('lane.R'); } };
// Translate error keys coming from the server (e.xxx)
const errText = m => (/^e\.\w+$/.test(m) ? T(m) : m);
const LANE_OFF = { L: -1, C: 0, R: 1 };

// ---------- storage (always try/catch) ----------
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

// ---------- state ----------
let code = null, token = null, role = null;
let S = null;                 // latest view received from the server
let offset = 0, haveOffset = false;
const now = () => Date.now() + offset;
let pending = null;           // move sent but not yet visible on the server
let revealKey = null, reveal = null;  // result animation being played
let muted = store.get('pota:mute') === '1';

// ---------- teams ----------
const TEAMS = window.POTA_TEAMS || null;
function teamOf(r) { const pk = S && S.picks && S.picks[r]; return pk && TEAMS ? TEAMS.byId(pk.teamId) : null; }
function playerOf(r) { const t = teamOf(r), pk = S && S.picks && S.picks[r]; return t && pk ? t.players[pk.playerIdx] : null; }
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function colorDist(a, b) { const x = hexRgb(a), y = hexRgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); }
// kits: team main color; if the two teams' colors clash, the away team wears its second color
function kitOf(r) {
  const t = teamOf(r);
  if (!t) return { body: COLOR[r], text: '#ffffff' };
  if (r === 'guest') {
    const h = teamOf('host');
    if (h && colorDist(h.colors.primary, t.colors.primary) < 90) {
      return { body: t.colors.secondary, text: colorDist(t.colors.secondary, '#ffffff') < 200 ? '#111111' : '#ffffff' };
    }
  }
  return { body: t.colors.primary, text: t.colors.text || '#ffffff' };
}
function logoHtml(t, size) { try { return t && window.PotaLogo ? window.PotaLogo.svg(t, size) : ''; } catch { return ''; } }
const pickKey = 'pota:pick';
function lastPick() { try { return JSON.parse(store.get(pickKey) || 'null'); } catch { return null; } }
// team/player selection (continue without it if the module fails to load)
function choosePick(accent) {
  return new Promise(resolve => {
    if (!window.PotaSelect || !TEAMS) return resolve(null);
    window.PotaSelect.open({
      title: T('pick.title'), accent, initial: lastPick() || undefined,
      onDone: pk => { store.set(pickKey, JSON.stringify(pk)); resolve(pk); },
      onCancel: () => resolve(undefined),
    });
  });
}

// ---------- network ----------
async function api(body) {
  if (local) return localApi(body);
  const t0 = Date.now();
  let r, j;
  try {
    r = await fetch('/api/game', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    j = await r.json();
  } catch { throw new Error(T('err.conn')); }
  const t1 = Date.now();
  if (j && j.state && typeof j.state.now === 'number') {
    const o = j.state.now - (t0 + t1) / 2;
    offset = haveOffset ? offset * 0.7 + o * 0.3 : o;
    haveOffset = true;
  }
  if (!r.ok) { const e = new Error(errText((j && j.error) || T('err.generic'))); e.code = j && j.error; throw e; }
  return j;
}

function toast(msg, ms = 2200) {
  const t = $('toast'); t.textContent = msg; t.style.display = 'block';
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.style.display = 'none'), ms);
}

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id);
  if (id === 'game') requestAnimationFrame(resize);
}

const shareUrl = () => `${location.origin}/?oda=${code}`;

// ---------- join flow ----------
const savedName = store.get('pota:name') || '';
$('nameInput').value = savedName;
$('joinName').value = savedName;

$('createBtn').onclick = async () => {
  unlockAudio();
  const name = $('nameInput').value.trim();
  store.set('pota:name', name);
  const pick = await choosePick('var(--host)');
  if (pick === undefined) return;
  $('createBtn').disabled = true; $('homeErr').textContent = '';
  try {
    const j = await api({ action: 'create', name, pick });
    code = j.state.code; token = j.token;
    store.set('pota:tok:' + code, token);
    history.replaceState(null, '', '/?oda=' + code);
    applyState(j.state);
    poll();
  } catch (e) { $('homeErr').textContent = e.message; }
  $('createBtn').disabled = false;
};

$('joinBtn').onclick = async () => {
  unlockAudio();
  const name = $('joinName').value.trim();
  store.set('pota:name', name);
  const pick = await choosePick('var(--guest)');
  if (pick === undefined) return;
  $('joinBtn').disabled = true; $('joinErr').textContent = '';
  try { await join(name, pick); } catch (e) { $('joinErr').textContent = e.message; }
  $('joinBtn').disabled = false;
};

async function join(name, pick) {
  const j = await api({ action: 'join', code, name, token, pick: pick || undefined });
  token = j.token;
  store.set('pota:tok:' + code, token);
  applyState(j.state);
  poll();
}

function goHome() {
  stopLocal();
  code = token = role = S = null; pending = null; reveal = null; revealKey = null;
  history.replaceState(null, '', '/');
  $('overModal').classList.remove('on');
  show('home');
}
$('joinHome').onclick = goHome;
$('homeBtn').onclick = goHome;

$('shareBtn').onclick = async () => {
  const url = shareUrl();
  if (navigator.share) {
    try { await navigator.share({ title: T('brand.title'), text: T('share.text'), url }); return; } catch {}
  }
  copy(url);
};
$('copyBtn').onclick = () => copy(shareUrl());
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast(T('toast.copied')); }
  catch { prompt(T('prompt.copy'), text); }
}

$('muteBtn').onclick = () => {
  muted = !muted; store.set('pota:mute', muted ? '1' : '0');
  $('muteBtn').textContent = muted ? '🔇' : '🔊';
  unlockAudio();
};
$('muteBtn').textContent = muted ? '🔇' : '🔊';

$('teamBtn').onclick = async () => {
  const pick = await choosePick(role === 'host' ? 'var(--host)' : 'var(--guest)');
  if (!pick) return;
  try { const j = await api({ action: 'pick', code, token, pick }); applyState(j.state); toast(T('toast.teamUpdated')); }
  catch (e) { toast(e.message); }
};

// Attack move (visible only on own screen; opponent doesn't know until the reveal)
const MODE_INFO = {};
for (const md of ['shot1', 'shot2', 'layup', 'dunk']) {
  MODE_INFO[md] = { get label() { return T(`mode.${md}.label`); }, get name() { return T(`mode.${md}.name`); }, get tip() { return T(`mode.${md}.tip`); } };
}
let mode = MODE_INFO[store.get('pota:mode')] ? store.get('pota:mode') : 'shot1';
const isShot = md => md === 'shot1' || md === 'shot2';
function curSpot() {
  const m = S.match;
  if (m.shooter === role && isShot(mode) && m.shotSpots) return m.shotSpots[mode === 'shot1' ? 1 : 2];
  return m.spot;
}
// Pick a direction first, then swipe (swipe only sets the power)
let aim = { poss: -1, lane: null };
function aimLane() { const m = S && S.match; return m && aim.poss === m.poss ? aim.lane : null; }
for (const b of document.querySelectorAll('#dirs button')) {
  b.onclick = () => {
    const kind = myTurnKind();
    const lane = b.dataset.l;
    if (kind === 'defend') { sendMove({ poss: S.match.poss, lane }, {}); return; }
    if (kind !== 'shoot' || !isShot(mode) || lane === 'S' || lane === 'P') return;
    aim = { poss: S.match.poss, lane };
    sfx('tick');
  };
}
$('readyBtn').onclick = async () => {
  try { const j = await api({ action: 'ready', code, token }); applyState(j.state); } catch (e) { toast(e.message); }
};
$('subBtn').onclick = () => {
  const pk = S && S.picks && S.picks[role];
  if (!pk || !window.PotaSelect) return;
  window.PotaSelect.open({
    lockTeam: true, initial: { teamId: pk.teamId, playerIdx: pk.playerIdx }, currentIdx: pk.playerIdx,
    title: T('sub.title'), subtitle: T('sub.subtitle'), goLabel: T('sub.go'),
    accent: role === 'host' ? 'var(--host)' : 'var(--guest)',
    onCancel: () => {},
    onDone: async sel => {
      try { const j = await api({ action: 'sub', code, token, playerIdx: sel.playerIdx }); applyState(j.state); toast(T('toast.onCourt', { name: playerOf(role).name })); }
      catch (e) { toast(e.message); }
    },
  });
};
for (const b of document.querySelectorAll('#modes button')) {
  b.onclick = () => {
    if (!S || !S.match || myTurnKind() !== 'shoot') return;
    mode = b.dataset.m; store.set('pota:mode', mode);
    if (!isShot(mode)) aim = { poss: -1, lane: null };
    sfx('tick');
  };
}

$('rematchBtn').onclick = async () => {
  $('rematchBtn').disabled = true;
  try { const j = await api({ action: 'rematch', code, token }); applyState(j.state); }
  catch (e) { toast(e.message); $('rematchBtn').disabled = false; }
};

// ---------- polling ----------
let polling = false, pollTimer = null, fails = 0;
function poll() {
  clearTimeout(pollTimer);
  if (!code || !token) return;
  pollTimer = setTimeout(async () => {
    if (polling) return poll();
    polling = true;
    try {
      const j = await api({ action: 'state', code, token });
      fails = 0;
      applyState(j.state);
    } catch (e) {
      fails++;
      if (fails === 3) toast(T('toast.weak'));
      if (e.code === 'e.notPlayer' || e.code === 'e.roomNotFound') { toast(e.message, 4000); polling = false; return goHome(); }
    }
    polling = false;
    poll();
  }, local ? 200 : S && S.match && S.match.phase !== 'over' ? 650 : 1500);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });

// ---------- apply state ----------
function applyState(st) {
  const prev = S;
  S = st; role = st.role;
  const m = st.match;
  if (!m) {
    if (role === 'host') { $('waitCode').textContent = st.code; show('waitScr'); }
    return;
  }
  if (!$('game').classList.contains('on')) show('game');
  if (pending && (m.turn !== pending.turn || m.phase !== 'turn' || m.myMove)) pending = null;
  // start the animation if a new result arrived
  if (m.last && (m.phase === 'reveal' || m.phase === 'over' || m.phase === 'turn')) {
    const key = m.seed + ':' + m.last.poss;
    if (key !== revealKey) {
      revealKey = key;
      const start = m.last && m.phase === 'reveal' ? m.revealUntil - REVEAL_MS : null;
      if (start && now() - start < REVEAL_MS) startReveal(m.last, start);
    }
  }
  // if a rematch started
  if (prev && prev.match && m.seed !== prev.match.seed) { reveal = null; }
  updateHud();
}

// ---------- HUD ----------
// Don't show the last shot on the scoreboard before the animation reaches the impact moment
function hidingLast() {
  return reveal && revealPlaying() && now() - reveal.start < showAtOf(reveal);
}
function shotsOf(who) {
  const m = S.match, shots = m.shots[who];
  if (hidingLast() && reveal.last.shooter === who && m.seed + ':' + reveal.last.poss === revealKey) return shots.slice(0, -1);
  return shots;
}
function scoreOf(who) {
  const m = S.match;
  if (hidingLast() && reveal.last.shooter === who) return m.score[who] - reveal.last.pts;
  return m.score[who];
}
function showAtOf(R) { return R.impactT + (R.kind === 'shot' && R.last.made ? 80 : 0); }

function dotsFor(who) {
  const m = S.match, shots = shotsOf(who);
  const isCur = (m.phase === 'turn' && m.shooter === who) || (hidingLast() && reveal.last.shooter === who);
  const n = shots.length + (isCur ? 1 : 0);
  let html = '';
  const startIdx = Math.max(0, n - 5);  // last 5 attacks
  for (let i = startIdx; i < n; i++) {
    const s = shots[i];
    if (s) html += s.made ? `<div class="dot made">${s.pts}</div>` : `<div class="dot miss">${s.result === 'steal' ? '✋' : '✕'}</div>`;
    else html += `<div class="dot${isCur && i === shots.length ? ' cur' : ''}"></div>`;
  }
  return html;
}

function periodLabel(m) {
  if (!m.quarter) return T('period.to', { n: m.target });
  if (m.quarter > m.quarters) return `${T('period.ot')} ${m.quarter - m.quarters > 1 ? m.quarter - m.quarters : ''}`.trim();
  return T('period.q', { n: m.quarter });
}
function nameOf(r) { return (S.names && S.names[r]) || (S.cpu && r === 'guest' ? T('cpu') : T(r === 'host' ? 'host' : 'guest')); }
function starOf(r) { const p = playerOf(r); return p ? p.name : nameOf(r); }

function updateHud() {
  const m = S.match;
  for (const r of ['host', 'guest']) {
    const cap = r[0].toUpperCase() + r.slice(1);
    const t = teamOf(r), pl = playerOf(r);
    // score band: large team abbreviation, with the on-court player and player name below
    $('nm' + cap).textContent = t ? t.short : nameOf(r);
    $('sub' + cap).textContent = (r === role ? T('you') + ' · ' : '') + (pl ? pl.name : nameOf(r));
    $('row' + cap).classList.toggle('me', r === role);
    $('row' + cap).title = t ? t.name : '';
    const lg = logoHtml(t, 28);
    if ($('lg' + cap).innerHTML !== lg) $('lg' + cap).innerHTML = lg;
    $('lg' + cap).style.display = lg ? '' : 'none';
    $('row' + cap).style.setProperty('--tc', kitOf(r).body);
    const dh = dotsFor(r); if ($('dots' + cap).innerHTML !== dh) $('dots' + cap).innerHTML = dh;
    $('pts' + cap).textContent = scoreOf(r);
  }
  $('roundLbl').textContent = periodLabel(m) + (m.phase === 'turn' || m.phase === 'reveal' ? ` · ${Math.min(m.qPoss + (m.phase === 'turn' ? 1 : 0), m.periodLen)}/${m.periodLen}` : '');
  $('roundLbl').style.color = m.overtime ? 'var(--bad)' : '';

  // match end
  const over = m.phase === 'over';
  $('overModal').classList.toggle('on', over && !revealPlaying());
  if (over) {
    recordPersonalStats();
    const win = m.winner === role;
    $('overTitle').textContent = win ? T('over.win') : T('over.lose');
    $('overTitle').style.color = win ? '#0a8f4a' : '#d1173f';
    const tn = r => (teamOf(r) ? teamOf(r).short : nameOf(r));
    $('overSub').textContent = `${tn('host')} ${m.score.host} – ${m.score.guest} ${tn('guest')}`;
    const opp = role === 'host' ? 'guest' : 'host';
    $('overSeries').textContent = T('over.series', { a: S.series[role], b: S.series[opp], opp: nameOf(opp) });
    const btn = $('rematchBtn');
    if (S.rematch[role]) { btn.disabled = true; btn.textContent = T('rematch.wait'); }
    else { btn.disabled = false; btn.textContent = S.rematch[opp] ? T('rematch.accept') : T('rematch'); }
  }
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function setHint(big, small) {
  if ($('hintBig').textContent !== big) $('hintBig').textContent = big;
  if ($('hintSmall').textContent !== small) $('hintSmall').textContent = small;
}

// ---------- canvas ----------
const cv = $('cv'), stage = $('stage');
const mainCtx = cv.getContext('2d', { alpha: false });
let ctx = mainCtx;                      // swapped temporarily while painting cached layers
let W = 360, H = 560;
// Render scale: capped at 1.5x (sharp enough on phones, far fewer pixels than 3x);
// lowered automatically to 1x if the device can't keep up (see perf monitor in frame()).
let renderScale = Math.min(1.5, window.devicePixelRatio || 1);
let lowFx = false;                      // lighter crowd when the device is slow
function resize() {
  const r = stage.getBoundingClientRect();
  if (!r.width || !r.height) return;
  W = r.width; H = r.height;
  cv.width = Math.round(W * renderScale); cv.height = Math.round(H * renderScale);
  mainCtx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  layers = null; crowd = null;
}
// Static scenery (sky, stand steps, floor, lines, backboard) is painted once into offscreen
// canvases and blitted every frame instead of being redrawn from scratch.
let layers = null;
function makeLayer(paint) {
  const c = document.createElement('canvas');
  c.width = Math.round(W * renderScale); c.height = Math.round(H * renderScale);
  const lc = c.getContext('2d');
  lc.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  const saved = ctx; ctx = lc;
  try { paint(); } finally { ctx = saved; }
  return c;
}
function ensureLayers() {
  if (layers && layers.W === W && layers.H === H) return;
  if (!crowd || crowd.W !== W || crowd.H !== H) buildCrowd();
  layers = {
    W, H,
    back: makeLayer(() => {
      ctx.fillStyle = '#121014'; ctx.fillRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.4);
      g.addColorStop(0, '#05060d'); g.addColorStop(1, '#11152b');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.45);
      for (let r = 0; r < crowd.rows; r++) {
        const y = crowd.top + r * crowd.rh;
        ctx.fillStyle = r % 2 ? '#1a1f3d' : '#161a33'; ctx.fillRect(0, y, W, crowd.rh);
        ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fillRect(0, y + crowd.rh - 2, W, 2);
      }
    }),
    front: makeLayer(() => { drawFloor(); drawBackboard(); }),
  };
}
window.addEventListener('resize', resize);

// Court coordinates to screen: x (-1..1 lateral), d (distance from hoop), h (height; rim = 1)
function P(x, d, h = 0) {
  const k = (d + 0.1) / 1.2;
  const s = 0.6 + 0.4 * k;
  const yb = H * 0.34, yn = H * 1.0;
  const yf = yb + (yn - yb) * k;
  return { x: W / 2 + x * W * 0.46 * s, y: yf - h * H * 0.2 * s, s };
}
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const RIM = { x: 0, d: 0.04, h: 1 };
const RIM_R = 0.15;   // horizontal radius (in x units)
const BALL_R = 0.085;

function px(x, s) { return x * W * 0.46 * s; }

function polyline(pts, close) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  if (close) ctx.closePath();
}

// ---------- stands, crowd, scoreboard ----------
let crowd = null, crowdExcite = 0, crowdT = 0;
function buildCrowd() {
  const top = H * 0.17, bottom = P(0, -0.1).y - 28;
  const rows = 5, rh = (bottom - top) / rows;
  const skins = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
  const shirts = () => [kitOf('host').body, kitOf('guest').body, '#ffffff', '#3a3f63'];
  crowd = { W, H, top, bottom, rows, rh, fans: [] };
  for (let r = 0; r < rows; r++) {
    const n = Math.floor(W / (10 + r * 1.2));
    for (let i = 0; i < n; i++) {
      crowd.fans.push({ r, x: (i + (r % 2) * 0.5) * (W / n) + (Math.random() - 0.5) * 4, skinIdx: (i * 7 + r) % skins.length,
        shirt: (i + r) % 4, ph: Math.random() * 6.28, fan: Math.random() < 0.5 ? 'host' : 'guest' });
    }
  }
  crowd.shirts = shirts;
  crowd.skins = skins;
}
function drawArena(t) {
  ensureLayers();
  ctx.drawImage(layers.back, 0, 0, W, H);
  const C = crowd, shirts = C.shirts();
  crowdExcite = Math.max(0, crowdExcite - 0.006);
  const sc = H / 700;
  const step = lowFx ? 2 : 1;            // on slow devices draw every other fan
  // compute positions once, then fill shirts / heads / arms in a few batched paths
  const P2 = C.pos || (C.pos = new Float32Array(C.fans.length * 3));
  for (let i = 0; i < C.fans.length; i += step) {
    const f = C.fans[i];
    const ex = crowdExcite * (f.fan === crowdT || crowdT === 'all' ? 1 : 0.3);
    P2[i * 3] = Math.sin(t / 260 + f.ph) * (1 + ex * 4) * sc - ex * 5 * sc * Math.max(0, Math.sin(t / 120 + f.ph));
    P2[i * 3 + 1] = (0.8 + f.r * 0.07) * sc;
    P2[i * 3 + 2] = ex;
  }
  const fanY = f => C.top + (f.r + 1) * C.rh - 3;
  for (let k = 0; k < shirts.length; k++) {
    ctx.fillStyle = shirts[k]; ctx.beginPath();
    for (let i = 0; i < C.fans.length; i += step) {
      const f = C.fans[i]; if (f.shirt !== k) continue;
      const bob = P2[i * 3], sz = P2[i * 3 + 1];
      ctx.rect(f.x - 4 * sz, fanY(f) - 7 * sz + bob, 8 * sz, 7 * sz);
    }
    ctx.fill();
  }
  for (let k = 0; k < C.skins.length; k++) {
    const skin = C.skins[k];
    ctx.fillStyle = skin; ctx.beginPath();
    let arms = false;
    for (let i = 0; i < C.fans.length; i += step) {
      const f = C.fans[i]; if (f.skinIdx !== k) continue;
      const bob = P2[i * 3], sz = P2[i * 3 + 1], y = fanY(f) - 10 * sz + bob;
      ctx.moveTo(f.x + 3.2 * sz, y); ctx.arc(f.x, y, 3.2 * sz, 0, 6.283);
      if (P2[i * 3 + 2] > 0.3) arms = true;
    }
    ctx.fill();
    if (arms) {                                       // arms in the air (only while excited)
      ctx.strokeStyle = skin; ctx.lineWidth = 1.4 * sc; ctx.beginPath();
      for (let i = 0; i < C.fans.length; i += step) {
        const f = C.fans[i]; if (f.skinIdx !== k || P2[i * 3 + 2] <= 0.3) continue;
        const bob = P2[i * 3], sz = P2[i * 3 + 1], y = fanY(f);
        ctx.moveTo(f.x - 4 * sz, y - 6 * sz + bob); ctx.lineTo(f.x - 6 * sz, y - 15 * sz + bob);
        ctx.moveTo(f.x + 4 * sz, y - 6 * sz + bob); ctx.lineTo(f.x + 6 * sz, y - 15 * sz + bob);
      }
      ctx.stroke();
    }
  }
  // camera flashes
  if (crowdExcite > 0.4 && Math.random() < 0.5) {
    const f = C.fans[Math.floor(Math.random() * C.fans.length)];
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(f.x, C.top + (f.r + 1) * C.rh - 12, 2.5, 0, 6.283); ctx.fill();
  }
  // LED ad board
  const by = C.bottom + 2;
  ctx.fillStyle = '#0b0e1c'; ctx.fillRect(0, by, W, 20);
  ctx.fillStyle = '#ff7a1a'; ctx.font = '900 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const msg = T('led');
  const off = (t / 40) % 220;
  for (let x = -off; x < W + 220; x += 220) ctx.fillText(msg, x + 110, by + 10);
  drawJumbotron(t);
}

function drawJumbotron(t) {
  const m = S.match;
  const w = Math.min(230, W * 0.6), h = H * 0.13, x = W / 2 - w / 2, y = 4;
  ctx.strokeStyle = '#2a3053'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W / 2 - w * 0.3, 0); ctx.lineTo(W / 2 - w * 0.3, y); ctx.moveTo(W / 2 + w * 0.3, 0); ctx.lineTo(W / 2 + w * 0.3, y); ctx.stroke();
  ctx.fillStyle = '#05070f'; roundRect(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 1.5; ctx.stroke();
  const tn = r => (teamOf(r) ? teamOf(r).short : r === 'host' ? T('jb.host') : T('jb.guest'));
  const sh = scoreOf('host'), sg = scoreOf('guest');
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  const cy = y + h * 0.42, fs = Math.min(26, h * 0.42);
  ctx.font = `900 ${fs}px ui-monospace, Menlo, monospace`;
  ctx.fillStyle = '#ff3b30'; ctx.fillText(String(sh).padStart(2, '0'), x + w * 0.3, cy);
  ctx.fillText(String(sg).padStart(2, '0'), x + w * 0.7, cy);
  ctx.font = `800 ${Math.max(9, fs * 0.42)}px system-ui`; ctx.fillStyle = '#c9cdf0';
  ctx.fillText(tn('host'), x + w * 0.3, y + h * 0.82); ctx.fillText(tn('guest'), x + w * 0.7, y + h * 0.82);
  // period and time in the center
  const Tn = now();
  let clk = '';
  if (m.phase === 'turn') clk = String(Math.max(0, Math.ceil((m.deadline - Tn) / 1000)));
  else if (m.phase === 'break') clk = String(Math.max(0, Math.ceil((m.breakUntil - Tn) / 1000)));
  ctx.fillStyle = '#ffcc33'; ctx.font = `900 ${Math.max(9, fs * 0.5)}px system-ui`;
  ctx.fillText(m.quarter > m.quarters ? T('jb.ot') : T('jb.q', { n: m.quarter || 1 }), x + w / 2, y + h * 0.3);
  ctx.font = `900 ${Math.max(10, fs * 0.6)}px ui-monospace, Menlo, monospace`;
  ctx.fillStyle = clk && Number(clk) <= 3 ? '#ff3b30' : '#3ddc84';
  ctx.fillText(clk, x + w / 2, y + h * 0.66);
  // attack arrow
  if (m.phase === 'turn') {
    const ax = m.shooter === 'host' ? x + w * 0.13 : x + w * 0.87;
    ctx.fillStyle = '#ffcc33'; ctx.beginPath();
    ctx.arc(ax, cy, 3.5 + Math.sin(t / 200), 0, 6.283); ctx.fill();
  }
}

function drawFloor() {
  const corners = [P(-1.6, -0.1), P(1.6, -0.1), P(1.6, 1.15), P(-1.6, 1.15)];
  const g = ctx.createLinearGradient(0, corners[0].y, 0, H);
  g.addColorStop(0, '#9a6232'); g.addColorStop(1, '#d08e4f');
  ctx.fillStyle = g; polyline(corners, true); ctx.fill();
  // court lines
  ctx.strokeStyle = 'rgba(70,35,10,.18)'; ctx.lineWidth = 1;
  for (let x = -1.6; x <= 1.6; x += 0.1) { polyline([P(x, -0.1), P(x, 1.15)]); ctx.stroke(); }
  // painted area
  ctx.fillStyle = 'rgba(30,40,110,.55)';
  polyline([P(-0.3, -0.1), P(0.3, -0.1), P(0.3, 0.48), P(-0.3, 0.48)], true); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
  ctx.stroke();
  // free-throw arc
  const ft = [];
  for (let a = 0; a <= Math.PI; a += Math.PI / 24) ft.push(P(0.3 * Math.cos(a), 0.48 + 0.3 * Math.sin(a)));
  polyline(ft); ctx.stroke();
  // three-point line
  const R3 = 0.946, a0 = Math.asin(0.92 / R3);
  const arc = [P(-0.92, -0.1), P(-0.92, 0.22)];
  for (let a = -a0; a <= a0 + 1e-6; a += a0 / 24) arc.push(P(R3 * Math.sin(a), R3 * Math.cos(a)));
  arc.push(P(0.92, 0.22), P(0.92, -0.1));
  polyline(arc); ctx.stroke();
  // baseline and edges
  polyline([P(-1.12, 1.15), P(-1.12, -0.1), P(1.12, -0.1), P(1.12, 1.15)]); ctx.stroke();
  // center court logo
  const c = P(0, 1.1);
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath(); ctx.ellipse(c.x, c.y, px(0.3, c.s), px(0.3, c.s) * 0.35, 0, Math.PI, 2 * Math.PI); ctx.stroke();
}

function drawBackboard() {
  // post
  const pb = P(0, -0.2, 0), pt = P(0, -0.2, 1.15);
  ctx.strokeStyle = '#4b5370'; ctx.lineWidth = px(0.06, pb.s);
  ctx.beginPath(); ctx.moveTo(pb.x, pb.y); ctx.lineTo(pt.x, pt.y); ctx.stroke();
  const arm1 = P(0, -0.2, 1.15), arm2 = P(0, -0.04, 1.15);
  ctx.lineWidth = px(0.04, pb.s); ctx.beginPath(); ctx.moveTo(arm1.x, arm1.y); ctx.lineTo(arm2.x, arm2.y); ctx.stroke();
  // backboard
  const a = P(-0.36, -0.04, 0.9), b = P(0.36, -0.04, 1.42);
  ctx.fillStyle = 'rgba(220,235,255,.22)'; ctx.strokeStyle = '#f2f4ff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.rect(a.x, b.y, b.x - a.x, a.y - b.y); ctx.fill(); ctx.stroke();
  const ia = P(-0.12, -0.04, 1.0), ib = P(0.12, -0.04, 1.2);
  ctx.strokeStyle = '#ff4d3d'; ctx.lineWidth = 2.5;
  ctx.strokeRect(ia.x, ib.y, ib.x - ia.x, ia.y - ib.y);
}

function rimGeom() {
  const c = P(RIM.x, RIM.d, RIM.h);
  return { c, rx: px(RIM_R, c.s), ry: px(RIM_R, c.s) * 0.32 };
}

function drawRim(half, netPull = 0) {
  const { c, rx, ry } = rimGeom();
  if (half === 'back') {
    ctx.strokeStyle = '#ff5a1f'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, Math.PI, 2 * Math.PI); ctx.stroke();
    return;
  }
  if (half === 'net') {
    const depth = ry * 4.2 + netPull * ry * 2.5;
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.2;
    const n = 12;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI * i / n;
      const x1 = c.x + rx * Math.cos(a), y1 = c.y + ry * Math.sin(a);
      const x2 = c.x + rx * 0.55 * Math.cos(a) * (1 - netPull * 0.3), y2 = c.y + depth + ry * 0.5 * Math.sin(a);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo((x1 + x2) / 2 + (x1 - c.x) * 0.1, (y1 + y2) / 2, x2, y2); ctx.stroke();
    }
    for (let j = 1; j <= 3; j++) {
      const f = j / 3;
      ctx.beginPath(); ctx.ellipse(c.x, c.y + depth * f, rx * lerp(1, 0.55, f), ry * lerp(1, 0.5, f), 0, 0, Math.PI); ctx.stroke();
    }
    return;
  }
  ctx.strokeStyle = '#ff6a2a'; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI); ctx.stroke();
}

// player drawing
function drawPlayer(x, d, color, opts = {}) {
  const { jump = 0, lean = 0, armsUp = 0, armSide = 0, back = false, holdBall = false, label = '', textColor = '#ffffff', me = false } = opts;
  const f = P(x, d, 0);
  const u = H * 0.2 * f.s;          // 1 unit of height (rim height)
  const bodyX = f.x + px(lean * 0.1, f.s);
  const base = f.y - jump * u;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(f.x, f.y, u * 0.16 * (1 - jump * 0.6), u * 0.045, 0, 0, 2 * Math.PI); ctx.fill();
  const skin = '#b97a4f';
  // legs
  ctx.fillStyle = skin;
  ctx.fillRect(bodyX - u * 0.07, base - u * 0.3, u * 0.05, u * 0.3);
  ctx.fillRect(bodyX + u * 0.02, base - u * 0.3, u * 0.05, u * 0.3);
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(bodyX - u * 0.08, base - u * 0.04, u * 0.07, u * 0.04);
  ctx.fillRect(bodyX + u * 0.01, base - u * 0.04, u * 0.07, u * 0.04);
  // shorts
  ctx.fillStyle = shade(color, -0.25);
  roundRect(bodyX - u * 0.1, base - u * 0.42, u * 0.2, u * 0.15, u * 0.03); ctx.fill();
  // torso
  ctx.fillStyle = color;
  roundRect(bodyX - u * 0.1, base - u * 0.68, u * 0.2, u * 0.28, u * 0.05); ctx.fill();
  if (label) {
    ctx.fillStyle = textColor; ctx.font = `900 ${Math.max(9, u * 0.12)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, bodyX, base - u * 0.55);
  }
  // arms
  ctx.strokeStyle = skin; ctx.lineWidth = Math.max(2, u * 0.045); ctx.lineCap = 'round';
  const shY = base - u * 0.64;
  for (const side of [-1, 1]) {
    const sx = bodyX + side * u * 0.1;
    let ex, ey;
    if (holdBall) { ex = bodyX + side * u * 0.05; ey = base - u * (0.95 + armsUp * 0.1); }
    else if (armsUp > 0) {
      const toward = armSide === side ? 1 : armSide === 0 ? 0.6 : 0.3;
      ex = sx + side * u * (0.06 + 0.12 * (armSide === side ? 1 : 0)) + armSide * u * 0.06;
      ey = shY - u * 0.36 * armsUp * toward - u * 0.05;
    } else { ex = sx + side * u * 0.05; ey = shY + u * 0.24; }
    ctx.beginPath(); ctx.moveTo(sx, shY); ctx.lineTo(ex, ey); ctx.stroke();
  }
  // head
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(bodyX, base - u * 0.76, u * 0.065, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = '#1d1410';
  ctx.beginPath(); ctx.arc(bodyX, base - u * 0.785, u * 0.062, Math.PI, 2 * Math.PI); ctx.fill();
  if (back) { ctx.beginPath(); ctx.arc(bodyX, base - u * 0.77, u * 0.06, Math.PI * 0.9, Math.PI * 2.1); ctx.fill(); }
  if (me) {
    const ty = base - u * (holdBall ? 1.22 : 0.98);
    ctx.fillStyle = '#ffcc33'; roundRect(bodyX - 15, ty - 8, 30, 15, 5); ctx.fill();
    ctx.fillStyle = '#111'; ctx.font = '900 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(T('you'), bodyX, ty);
  }
  return { hand: { x: bodyX, y: base - u * 1.0 }, u };
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => clamp(Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt)), 0, 255);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function drawBall(x, d, h, rot = 0, glow = false) {
  const p = P(x, d, h);
  const r = px(BALL_R, p.s);
  // shadow
  const fl = P(x, d, 0);
  ctx.fillStyle = `rgba(0,0,0,${0.25 * clamp(1 - h / 2.5, 0.1, 1)})`;
  ctx.beginPath(); ctx.ellipse(fl.x, fl.y, r * 0.9, r * 0.3, 0, 0, 2 * Math.PI); ctx.fill();
  if (glow) { ctx.fillStyle = 'rgba(255,204,51,.25)'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.7, 0, 2 * Math.PI); ctx.fill(); }
  const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.2, p.x, p.y, r);
  g.addColorStop(0, '#ffa04a'); g.addColorStop(1, '#d4570f');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 2 * Math.PI); ctx.fill();
  ctx.strokeStyle = 'rgba(40,15,0,.75)'; ctx.lineWidth = Math.max(1, r * 0.09);
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(rot);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 2 * Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.45, r, 0, 0, 2 * Math.PI); ctx.stroke();
  ctx.restore();
}

// ---------- scene layout ----------
const ease = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const mix = (a, b, t) => ({ x: lerp(a.x, b.x, t), d: lerp(a.d, b.d, t) });
// defender: between attacker and hoop
function between(p, t = 0.36) { return { x: lerp(p.x, RIM.x, t), d: lerp(p.d, RIM.d, t) + 0.02 }; }
function laneDir(p) { return 0.2 + 0.08 * p.d; }
function layout(spot) { return { shooter: { x: spot.x, d: spot.d }, defender: between(spot) }; }

// Ball flight: s 0..1, from {x,d,h} → target {x,d,h}
function flight(from, lane, s, target, arcMul = 1) {
  const x = lerp(from.x, target.x, s) + LANE_OFF[lane] * laneDir(from) * 4 * s * (1 - s) * 1.2 * arcMul;
  const d = lerp(from.d, target.d, s);
  const arcH = (0.55 + 0.55 * Math.hypot(from.x, from.d)) * arcMul;
  const h = lerp(from.h, target.h, s) + arcH * 4 * s * (1 - s);
  return { x, d, h };
}
const dribbleH = t => 0.12 + 0.3 * Math.abs(Math.sin(t / 150));

// ---------- result animation ----------
const RESULT_COLOR = {
  swish: '#3ddc84', in: '#3ddc84', rimin: '#3ddc84', short: '#ff4d6d', long: '#ff4d6d', airball: '#ff4d6d',
  block: '#22c3e6', clock: '#ff4d6d', layup: '#3ddc84', layup_miss: '#ff4d6d', dunk: '#ffcc33', poster: '#ffcc33',
  dunk_miss: '#ff4d6d', steal: '#22c3e6',
};
const RESULT_TEXT = new Proxy({}, { get: (_, k) => (RESULT_COLOR[k] ? [T('res.' + k), RESULT_COLOR[k]] : undefined) });

const SLOGAN_KEYS = ['swish', 'in', 'rimin', 'shot2', 'layup', 'dunk', 'poster', 'contested', 'block', 'steal'];
function sloganFor(last) {
  let key = last.result;
  if (last.made) {
    if (last.result === 'poster') key = 'poster';
    else if (last.result === 'dunk') key = 'dunk';
    else if (last.result === 'layup') key = 'layup';
    else if (last.contested) key = 'contested';
    else if (last.pts === 2) key = 'shot2';
  }
  if (!SLOGAN_KEYS.includes(key)) return null;
  return TL('slo.' + key, last.poss * 7 + (S.match.seed || 1) * 3);
}

function startReveal(last, start) {
  const R = { last, start, res: last.result, mode: last.mode, lane: last.lane || 'C', sounds: {}, slogan: sloganFor(last) };
  R.base = { x: last.from.x, d: last.from.d };
  R.spot = { x: last.spot.x, d: last.spot.d };
  R.defBase = between(R.base);
  const res = R.res;
  if (!last.mode) { R.kind = 'clock'; R.impactT = 200; }
  else if (isShot(last.mode)) {
    R.kind = 'shot';
    R.walk = last.mode === 'shot1' ? 420 : 0;            // step into the lane
    R.release = 300 + R.walk;
    R.defSpot = between(R.spot);
    R.from = { x: R.spot.x, d: R.spot.d, h: 0.98 };
    R.F = res === 'block' ? 560 : 1000;
    R.arc = res === 'block' ? 0.3 : 1;
    const TGT = {
      swish: { x: RIM.x, d: RIM.d, h: RIM.h }, in: { x: RIM.x, d: RIM.d, h: RIM.h },
      rimin: { x: RIM.x + 0.09, d: RIM.d, h: RIM.h + 0.05 }, short: { x: RIM.x, d: RIM.d + 0.13, h: RIM.h + 0.05 },
      long: { x: RIM.x + 0.03, d: -0.03, h: 1.25 }, airball: { x: RIM.x, d: RIM.d + 0.32, h: 0.55 },
      block: { x: R.defSpot.x + LANE_OFF[R.lane] * 0.16, d: R.defSpot.d, h: 1.32 },
    };
    R.target = TGT[res];
    R.impactT = R.release + R.F;
    const rnd = (Math.random() < 0.5 ? -1 : 1);
    const V = {
      short: { x: rnd * 0.2, d: 0.9, h: 1.1 }, long: { x: rnd * 0.5, d: 0.75, h: 0.4 },
      airball: { x: 0, d: 0.35, h: -1.2 }, block: { x: (LANE_OFF[R.lane] || rnd) * 2.4, d: 0.5, h: 1.2 },
    };
    if (V[res]) R.post = { p: flight(R.from, R.lane, 1, R.target, R.arc), v: V[res] };
  } else if (last.mode === 'layup') {
    R.kind = 'layup';
    R.side = R.base.x >= 0 ? 1 : -1;
    R.drive = { x: R.side * 0.3, d: 0.15 };
    R.impactT = res === 'steal' ? 650 : res === 'block' ? 1250 : 1450;
  } else {
    R.kind = 'dunk';
    R.drive = { x: 0, d: 0.24 };
    R.impactT = res === 'steal' ? 600 : res === 'block' ? 1150 : 1300;
  }
  reveal = R;
}

function revealPlaying() { return reveal && now() - reveal.start < REVEAL_MS; }

function simulate(p, v, dt) {
  let x = p.x, d = p.d, h = p.h, vx = v.x, vd = v.d, vh = v.h;
  const step = 1 / 120;
  for (let t = 0; t < dt; t += step) {
    vh -= 4.8 * step;
    x += vx * step; d += vd * step; h += vh * step;
    if (h < BALL_R * 0.9) { h = BALL_R * 0.9; vh = -vh * 0.55; vx *= 0.85; vd *= 0.85; }
  }
  return { x, d, h };
}

// After a basket: pass through the net and fall to the floor (tt seconds)
function throughNet(tt, rot) {
  if (tt < 0.35) {
    const f = tt / 0.35;
    return { x: RIM.x, d: RIM.d, h: lerp(RIM.h, RIM.h - 0.42, f), layer: 'inside', rot, net: Math.sin(Math.PI * f) };
  }
  return { ...simulate({ x: RIM.x, d: RIM.d, h: RIM.h - 0.42 }, { x: 0.05, d: 0.25, h: -1.0 }, tt - 0.35), layer: 'front', rot };
}

// Attacker's position
function attackerAt(R, rt) {
  if (R.kind === 'shot') {
    const p = R.walk ? mix(R.base, R.spot, ease(rt / (R.walk + 250))) : R.base;
    const jump = 0.16 * Math.sin(Math.PI * clamp((rt - R.release + 150) / 420, 0, 1));
    return { ...p, jump, hold: rt < R.release + 60 && rt > R.release - 260 };
  }
  if (R.kind === 'layup') {
    const p = mix(R.base, R.drive, ease((rt - 250) / 850));
    const jump = 0.42 * Math.sin(Math.PI * clamp((rt - 1100) / 450, 0, 1));
    if (R.res === 'steal' && rt > R.impactT) return { ...mix(R.base, R.drive, ease((R.impactT - 250) / 850)), jump: 0 };
    return { ...p, jump, hold: rt > 1080 && rt < 1320 };
  }
  if (R.kind === 'dunk') {
    if (R.res === 'steal' && rt > R.impactT) return { ...mix(R.base, R.drive, ease((R.impactT - 250) / 700)), jump: 0 };
    if (rt < 950) return { ...mix(R.base, R.drive, ease((rt - 250) / 700)), jump: 0 };
    const f = clamp((rt - 950) / 520, 0, 1);
    return { ...mix(R.drive, { x: -0.03, d: 0.15 }, ease(f * 1.4)), jump: 0.8 * Math.sin(Math.PI * f), hold: rt < 1300 };
  }
  return { ...R.base, jump: 0 };
}

// Defender's position and stance
function defenderAt(R, rt) {
  const dl = R.last.defLane;
  let base = R.kind === 'shot' && R.walk ? mix(R.defBase, R.defSpot, ease(rt / (R.walk + 250))) : R.defBase;
  const o = { ...base, jump: 0, lean: 0, armsUp: 0.35, armSide: 0 };
  if (!dl) return o;
  if (dl === 'S') {                                         // steal attempt
    const a = attackerAt(R, Math.min(rt, 650));
    const f = ease((rt - 150) / 450);
    const p = mix(base, a, 0.55 * f);
    return { ...p, jump: 0, lean: Math.sign(a.x - base.x) * f, armsUp: 0.15, armSide: Math.sign(a.x - base.x) };
  }
  const side = LANE_OFF[dl];
  if (R.kind === 'shot') {
    const jStart = R.res === 'block' ? R.impactT - 470 : R.release + 50;
    const f = clamp((rt - jStart) / 950, 0, 1);
    return { ...base, jump: Math.sin(Math.PI * f) * 0.35, lean: side * clamp((rt - 150) / 250, 0, 1) * 1.2, armsUp: 1, armSide: side };
  }
  // layup/dunk
  if (dl === 'P') {                                         // protecting the hoop: waits underneath, jumps
    const spot = R.kind === 'dunk' ? { x: 0.16, d: 0.08 } : { x: R.side * 0.2, d: 0.1 };
    const p = mix(base, spot, ease((rt - 100) / 600));
    const peak = R.res === 'block' ? R.impactT : R.kind === 'dunk' ? R.impactT - 50 : 1300;
    const f = clamp((rt - peak + 250) / 500, 0, 1);
    return { ...p, jump: Math.sin(Math.PI * f) * (R.kind === 'dunk' ? 0.5 : 0.4), lean: 0, armsUp: 1, armSide: 0 };
  }
  // came out to contest the shot: jumps early, attacker passes by
  const f = clamp((rt - 150) / 700, 0, 1);
  return { ...base, jump: Math.sin(Math.PI * f) * 0.3, lean: side * 0.8, armsUp: 1, armSide: side };
}

function handPos(p, up = true) { return { x: p.x, d: p.d, h: (up ? 1.0 : 0.55) + (p.jump || 0) }; }

function ballAt(R, rt, att, def) {
  const rot = rt / 90;
  if (R.kind === 'clock') return { ...handPos(att, false), layer: 'front', rot: 0 };
  if (R.kind === 'shot') {
    if (rt < R.release - 250) return { x: att.x + 0.07, d: att.d, h: dribbleH(rt), layer: 'front', rot };
    if (rt < R.release) return { x: att.x, d: att.d, h: lerp(0.6, 0.98, (rt - R.release + 250) / 250) + att.jump, layer: 'front', rot: 0 };
    const s = (rt - R.release) / R.F;
    if (s < 1) return { ...flight(R.from, R.lane, s, R.target, R.arc), layer: 'front', rot };
    const tt = (rt - R.impactT) / 1000;
    if (R.post) return { ...simulate(R.post.p, R.post.v, tt), layer: 'front', rot };
    if (R.res === 'rimin') {
      if (tt < 0.3) { const f = tt / 0.3; return { x: lerp(RIM.x + 0.09, RIM.x, f), d: RIM.d, h: RIM.h + 0.05 + 0.22 * Math.sin(Math.PI * f), layer: 'front', rot }; }
      return throughNet(tt - 0.3, rot);
    }
    return throughNet(tt, rot);
  }
  // layup / dunk common: ball is dribbled during the drive
  const holdT = R.kind === 'dunk' ? 950 : 1080;
  if (R.res === 'steal' && rt >= R.impactT - 150) {
    const f = clamp((rt - R.impactT + 150) / 150, 0, 1);
    const from = { x: att.x + 0.07, d: att.d, h: dribbleH(R.impactT - 150) };
    const to = { x: def.x, d: def.d, h: 0.5 };
    return { x: lerp(from.x, to.x, f), d: lerp(from.d, to.d, f), h: lerp(from.h, to.h, f) + 0.3 * Math.sin(Math.PI * f), layer: 'front', rot };
  }
  if (rt < holdT) return { x: att.x + (R.side || 1) * 0.07, d: att.d, h: dribbleH(rt), layer: 'front', rot };
  if (R.kind === 'layup') {
    if (R.res === 'block' && rt >= R.impactT) {
      const p0 = { ...handPos(attackerAt(R, R.impactT)), h: handPos(attackerAt(R, R.impactT)).h + 0.15 };
      return { ...simulate(p0, { x: -R.side * 1.8, d: 0.7, h: 0.8 }, (rt - R.impactT) / 1000), layer: 'front', rot };
    }
    if (rt < 1300) return { ...handPos(att), layer: 'front', rot: 0 };
    const from = handPos(attackerAt(R, 1300));
    if (rt < 1450) {
      const f = (rt - 1300) / 150;
      return { x: lerp(from.x, RIM.x, f), d: lerp(from.d, RIM.d, f), h: lerp(from.h, RIM.h + 0.05, f) + 0.12 * Math.sin(Math.PI * f), layer: 'front', rot };
    }
    const tt = (rt - 1450) / 1000;
    if (R.res === 'layup') return throughNet(tt, rot);
    return { ...simulate({ x: RIM.x + R.side * 0.1, d: RIM.d, h: RIM.h + 0.05 }, { x: R.side * 0.7, d: 0.6, h: 0.9 }, tt), layer: 'front', rot };
  }
  // dunk
  if (R.res === 'block' && rt >= R.impactT) {
    const p0 = handPos(attackerAt(R, R.impactT));
    return { ...simulate(p0, { x: (Math.random() < 0.5 ? -1 : 1) * 0.2 + 1.6 * (R.lane === 'C' ? 1 : LANE_OFF[R.lane]), d: 0.9, h: 0.6 }, (rt - R.impactT) / 1000), layer: 'front', rot };
  }
  if (rt < 1200) return { ...handPos(att), h: handPos(att).h + 0.05, layer: 'front', rot: 0 };
  if (rt < 1300) {
    const f = (rt - 1200) / 100;
    return { x: RIM.x, d: lerp(0.08, RIM.d, f), h: lerp(1.35, RIM.h - 0.05, f), layer: f > 0.5 ? 'inside' : 'front', rot: 0, net: f };
  }
  const tt = (rt - 1300) / 1000;
  if (R.res === 'dunk_miss') return { ...simulate({ x: RIM.x, d: RIM.d - 0.02, h: RIM.h + 0.05 }, { x: 0.4, d: 0.9, h: 1.6 }, tt), layer: 'front', rot };
  return throughNet(tt * 1.6, rot);
}

// ---------- input (swipe) ----------
let drag = null;
cv.addEventListener('pointerdown', e => {
  unlockAudio();
  const r = cv.getBoundingClientRect();
  drag = { x0: e.clientX - r.left, y0: e.clientY - r.top, x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId };
  try { cv.setPointerCapture(e.pointerId); } catch {}
  e.preventDefault();
});
cv.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const r = cv.getBoundingClientRect();
  drag.x = e.clientX - r.left; drag.y = e.clientY - r.top;
  e.preventDefault();
});
cv.addEventListener('pointerup', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  handleSwipe(d.x - d.x0, d.y - d.y0);
});
cv.addEventListener('pointercancel', () => { drag = null; });

function myTurnKind() {
  if (!S || !S.match) return null;
  const m = S.match;
  if (m.phase !== 'turn') return null;
  if (m.startsAt && now() < m.startsAt) return null;
  if (m.myMove || (pending && pending.turn === m.turn)) return null;
  return m.shooter === role ? 'shoot' : 'defend';
}

const POWER_PX = () => H * 0.62;
function powerFromDy(dy) { return clamp(-dy / POWER_PX(), 0, 1.15); }
function laneFromShot(dx, dy) {
  const ratio = dx / Math.max(50, -dy);
  return ratio < -0.28 ? 'L' : ratio > 0.28 ? 'R' : 'C';
}
function bandCenter(spot, t) {
  const base = 0.42 + 0.42 * spot.diff;
  const amp = 0.04 + 0.05 * spot.diff;
  const period = 2600 - 1100 * spot.diff;
  return base + amp * Math.sin((2 * Math.PI * t) / period);
}
const DUNK_MIN = 0.55;

function handleSwipe(dx, dy) {
  const kind = myTurnKind();
  if (!kind) return;
  const m = S.match;
  if (kind === 'shoot') {
    if (isShot(mode)) {
      if (-dy < 30) { toast(T('toast.swipeShot')); return; }
      const p = powerFromDy(dy);
      const spot = curSpot();
      const c = bandCenter(spot, performance.now());
      const lane = aimLane() || laneFromShot(dx, dy);
      sendMove({ poss: m.poss, mode, lane, err: Math.round((p - c) * 10000) / 10000 }, { lane });
    } else if (mode === 'layup') {
      if (-dy < 30) { toast(T('toast.swipeLayup')); return; }
      sendMove({ poss: m.poss, mode }, {});
    } else {
      if (-dy < 30) { toast(T('toast.swipeDunk')); return; }
      sendMove({ poss: m.poss, mode }, {});
    }
  } else {
    let lane = null;
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 0.6) lane = dx < 0 ? 'L' : 'R';
    else if (dy < -30) lane = 'C';
    else if (dy > 30) lane = 'S';
    if (!lane) { toast(T('toast.pickDef')); return; }
    sendMove({ poss: m.poss, lane }, {});
  }
}

async function sendMove(mv, extra) {
  pending = { ...mv, ...extra, turn: mv.poss };
  sfx('whoosh');
  try {
    const j = await api({ action: 'move', code, token, ...mv });
    applyState(j.state);
  } catch (e) {
    if (pending && pending.turn === mv.poss) pending = null;
    if (e.code !== 'e.oldPoss' && e.code !== 'e.alreadyMoved') toast(e.message);
  }
}

const DEF_NAME = new Proxy({}, { get: (_, k) => T('def.' + String(k)) });

// ---------- main draw loop ----------
// Perf monitor: if frames are consistently slow, drop to 1x render scale, then to a lighter crowd.
const perf = { n: 0, sum: 0, last: 0 };
function perfSample(t) {
  if (perf.last) { const dt = t - perf.last; if (dt < 250) { perf.sum += dt; perf.n++; } }
  perf.last = t;
  if (perf.n < 120) return;
  const avg = perf.sum / perf.n; perf.n = 0; perf.sum = 0;
  if (avg > 24) {                         // below ~40 fps
    if (renderScale > 1) { renderScale = 1; resize(); }
    else if (!lowFx) lowFx = true;
  }
}
const gameEl = $('game');
function frame() {
  requestAnimationFrame(frame);
  if (!gameEl.classList.contains('on') || !S || !S.match) { perf.last = 0; return; }
  if (cv.width === 0) resize();
  const t = performance.now();
  perfSample(t);
  const Tn = now();
  const m = S.match;
  const playing = revealPlaying();
  const rt = playing ? Tn - reveal.start : 0;

  let shake = 0;
  if (playing && (reveal.res === 'dunk' || reveal.res === 'poster') && rt > reveal.impactT && rt < reveal.impactT + 350) {
    shake = 7 * (1 - (rt - reveal.impactT) / 350);
  }
  ctx.save();
  if (shake) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  // camera moves closer to the hoop on layup/dunk
  if (playing && (reveal.kind === 'layup' || reveal.kind === 'dunk') && reveal.res !== 'steal') {
    const zin = ease((rt - 300) / 700), zout = ease((rt - 2700) / 600);
    const z = 1 + 0.75 * zin * (1 - zout);
    const f = P(0, 0.1, 0.55);
    ctx.translate(f.x, f.y); ctx.scale(z, z); ctx.translate(-f.x, -f.y);
  }
  ctx.fillStyle = '#121014'; ctx.fillRect(-10, -10, W + 20, H + 20);
  drawArena(t);
  ctx.drawImage(layers.front, 0, 0, W, H);

  const attRole = playing ? reveal.last.attacker : m.shooter;
  const defRole = attRole === 'host' ? 'guest' : 'host';
  const myMove = m.myMove || (pending && pending.turn === m.turn ? pending : null);
  const kind = myTurnKind();

  let att, def, ball, banner = null;
  if (playing) {
    att = attackerAt(reveal, rt);
    def = defenderAt(reveal, rt);
    ball = ballAt(reveal, rt, att, def);
    if (reveal.res === 'steal' && rt > reveal.impactT) ball = { x: def.x + 0.05, d: def.d, h: 0.55 + 0.05 * Math.sin(rt / 120), layer: 'front', rot: 0 };
    const showAt = showAtOf(reveal);
    if (rt >= showAt) banner = { rt: rt - showAt };
    const once = (k, at, fn) => { if (rt >= at && !reveal.sounds[k]) { reveal.sounds[k] = 1; if (rt - at < 400) fn(); } };
    if (reveal.kind === 'shot') once('rel', reveal.release, () => sfx('whoosh'));
    once('hit', reveal.impactT, () => onImpact(reveal));
    once('hud', showAt, updateHud);
  } else {
    // attack moment: if a 1-pointer is selected on own screen, stands inside the lane
    const spot = role === attRole ? curSpot() : m.spot;
    att = { x: spot.x, d: spot.d, jump: 0 };
    const db = between(spot);
    def = { ...db, jump: 0, lean: 0, armsUp: 0.35, armSide: 0 };
    if (role === defRole && myMove && m.phase === 'turn') {
      if (myMove.lane === 'S') def = { ...mix(db, spot, 0.25), jump: 0, lean: 0, armsUp: 0.1, armSide: 0 };
      else if (myMove.lane === 'P') def = { ...mix(db, { x: 0, d: 0.1 }, 0.7), jump: 0, lean: 0, armsUp: 1, armSide: 0 };
      else def = { ...db, jump: 0, lean: LANE_OFF[myMove.lane] * 0.8, armsUp: 0.9, armSide: LANE_OFF[myMove.lane] };
    }
    const overhead = role === attRole && isShot(mode) && m.phase === 'turn';
    att.hold = overhead;
    ball = overhead ? { ...handPos(att), h: 0.98, layer: 'front', rot: 0 }
      : { x: att.x + 0.07, d: att.d, h: m.phase === 'turn' ? dribbleH(t) : 0.55, layer: 'front', rot: t / 200 };
  }

  drawRim('back');
  if (ball.layer === 'inside') drawBall(ball.x, ball.d, ball.h, ball.rot);
  drawRim('net', ball.net || 0);
  drawRim('front');

  const dk = kitOf(defRole), ak = kitOf(attRole);
  const num = r => { const p = playerOf(r); return p ? String(p.num) : ''; };
  const drawDef = () => drawPlayer(def.x + (def.lean || 0) * 0.1, def.d, dk.body, { jump: def.jump, armsUp: def.armsUp, armSide: def.armSide, label: num(defRole), textColor: dk.text, me: role === defRole });
  const drawAtt = () => drawPlayer(att.x, att.d, ak.body, { back: true, jump: att.jump || 0, holdBall: !!att.hold, armsUp: att.hold ? 1 : 0.2, label: num(attRole), textColor: ak.text, me: role === attRole });
  // far ones (near the hoop) are drawn first; the court between is left to the cheerleaders
  const onBreak = m.phase === 'break' && !playing;
  if (onBreak) { /* players on the sidelines */ }
  else if (def.d <= att.d) { drawDef(); if (kind === 'defend') drawDefendArrows(def, t); drawAtt(); }
  else { drawAtt(); drawDef(); if (kind === 'defend') drawDefendArrows(def, t); }

  if (kind === 'shoot') drawAttackGuides(att, t);
  if (ball.layer !== 'inside' && !onBreak) drawBall(ball.x, ball.d, ball.h, ball.rot, !playing && role === attRole && !!myMove);
  if (kind === 'shoot' && isShot(mode)) drawPowerMeter(curSpot(), t);
  if (!playing && role === attRole && myMove) drawTag(P(att.x, att.d, 1.5), `${MODE_INFO[myMove.mode] ? MODE_INFO[myMove.mode].label : ''} ${isShot(myMove.mode) ? LANE_NAME[myMove.lane] || '' : ''} ✓`, '#ffcc33');
  if (!playing && role === defRole && myMove && myMove.lane) drawTag(P(def.x, def.d, 1.3), myMove.lane === 'S' ? T('tag.steal') : myMove.lane === 'P' ? T('tag.rim') : T('tag.closed', { lane: LANE_NAME[myMove.lane] }), '#22c3e6');

  ctx.restore();
  if (m.phase === 'break' && !playing) drawBreak(t, Tn);
  if (banner) drawBanner(reveal, banner.rt);
  else if (sparks.length) { for (const p of sparks) { p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.life -= 0.02; } sparks = sparks.filter(p => p.life > 0); }
  if (m.startsAt && Tn < m.startsAt && m.phase === 'turn') drawCountdown(m.startsAt - Tn);

  updateClockAndHint(Tn, playing);
}

function drawTag(p, text, color) {
  ctx.font = '800 13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 16;
  const x = clamp(p.x, w / 2 + 4, W - w / 2 - 4), y = Math.max(16, p.y);
  ctx.fillStyle = 'rgba(13,16,32,.85)'; roundRect(x - w / 2, y - 12, w, 24, 12); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = color; ctx.fillText(text, x, y + 1);
}

function drawDefendArrows(def, t) {
  const p = P(def.x, def.d, 0.5);
  const u = H * 0.2 * p.s;
  const pulse = 0.55 + 0.45 * Math.sin(t / 220);
  const sz = Math.max(22, u * 0.35);
  ctx.globalAlpha = pulse; ctx.fillStyle = '#22c3e6'; ctx.font = `900 ${sz}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('←', p.x - u * 0.55, p.y);
  ctx.fillText('↑', p.x, p.y - u * 0.75);
  ctx.fillText('→', p.x + u * 0.55, p.y);
  ctx.fillStyle = '#ffcc33';
  ctx.fillText('↓', p.x, p.y + u * 0.55);
  ctx.font = `900 ${Math.max(10, sz * 0.4)}px system-ui`;
  ctx.fillText(T('arrow.steal'), p.x, p.y + u * 0.55 + sz * 0.6);
  ctx.globalAlpha = 1;
}

function drawAttackGuides(att, t) {
  let dx = 0, dy = 0;
  if (drag) { dx = drag.x - drag.x0; dy = drag.y - drag.y0; }
  if (isShot(mode)) {
    const target = { x: RIM.x, d: RIM.d, h: RIM.h };
    const from = { x: att.x, d: att.d, h: 0.98 };
    const active = aimLane() || (drag && -dy > 10 ? laneFromShot(dx, dy) : null);
    for (const lane of ['L', 'C', 'R']) {
      const on = lane === active;
      ctx.strokeStyle = on ? 'rgba(255,204,51,.95)' : 'rgba(255,255,255,.22)';
      ctx.lineWidth = on ? 3 : 2;
      ctx.setLineDash(on ? [] : [6, 8]);
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const q = flight(from, lane, i / 24, target);
        const p = P(q.x, q.d, q.h);
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    if (active) drawTag({ x: W / 2, y: P(0, 0.62).y }, T('aim.from', { lane: LANE_NAME[active] }), '#ffcc33');
  } else {
    // layup/dunk drive paths
    const side = att.x >= 0 ? 1 : -1;
    const paths = [['C', mode === 'layup' ? { x: side * 0.3, d: 0.15 } : { x: 0, d: 0.12 }]];
    const active = drag && -dy > 20 ? 'C' : null;
    for (const [lane, to] of paths) {
      const on = lane === active;
      const a = P(att.x, att.d, 0.02), b = P(to.x, to.d, 0.02), c = P(RIM.x, RIM.d, RIM.h);
      ctx.strokeStyle = on ? 'rgba(255,204,51,.95)' : 'rgba(255,255,255,.3)';
      ctx.lineWidth = on ? 4 : 3; ctx.setLineDash(on ? [] : [8, 8]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.quadraticCurveTo(b.x, c.y + 30, c.x, c.y); ctx.stroke();
    }
    ctx.setLineDash([]);
    if (active) drawTag({ x: W / 2, y: P(0, 0.62).y }, mode === 'layup' ? T('aim.layup') : T('aim.dunk'), '#ffcc33');
  }
  if (drag) {
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(drag.x0, drag.y0); ctx.lineTo(drag.x, drag.y); ctx.stroke();
  }
}

function drawPowerMeter(spot, t) {
  const x = W - 30, top = H * 0.2, bot = H * 0.8, h = bot - top;
  const toY = p => bot - (p / 1.15) * h;
  ctx.fillStyle = 'rgba(13,16,32,.75)'; roundRect(x - 11, top - 8, 22, h + 16, 11); ctx.fill();
  if (mode === 'dunk') {
    const dm = S.match.dunkMin || DUNK_MIN;
    ctx.fillStyle = 'rgba(61,220,132,.85)'; ctx.fillRect(x - 8, toY(1.15), 16, toY(dm) - toY(1.15));
  } else {
    const c = bandCenter(spot, t);
    const y1 = toY(c + spot.band / 2), y2 = toY(c - spot.band / 2);
    ctx.fillStyle = 'rgba(61,220,132,.9)'; ctx.fillRect(x - 8, y1, 16, y2 - y1);
    ctx.fillStyle = 'rgba(255,204,51,.55)';
    const r1 = toY(c + spot.band / 2 * 1.7), r2 = toY(c - spot.band / 2 * 1.7);
    ctx.fillRect(x - 8, r1, 16, y1 - r1); ctx.fillRect(x - 8, y2, 16, r2 - y2);
  }
  let p = 0;
  if (drag) p = powerFromDy(drag.y - drag.y0);
  if (p > 0) {
    ctx.fillStyle = '#ff7a1a'; ctx.fillRect(x - 3, toY(p), 6, bot - toY(p));
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 13, toY(p) - 1.5, 26, 3);
  }
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '800 10px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(T('meter.power'), x, bot + 20);
}

let sparks = [];
// The result banner is painted once per result into two small offscreen canvases
// (static text + slogan) and then only scaled/faded per frame — strokes and gradients are costly.
function bannerImages(R) {
  const lang = window.PotaI18n ? window.PotaI18n.lang : 'en';
  if (R.img && R.img.W === W && R.img.lang === lang && R.img.scale === renderScale) return R.img;
  const [txt, color] = RESULT_TEXT[R.res] || [R.res, '#fff'];
  const last = R.last, big = R.slogan || txt;
  const cw = Math.ceil(W), ch = 220, cx = cw / 2, cy = 110;
  const mk = paint => {
    const c = document.createElement('canvas');
    c.width = Math.round(cw * renderScale); c.height = Math.round(ch * renderScale);
    const g = c.getContext('2d'); g.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    const saved = ctx; ctx = g;
    try { ctx.translate(cx, cy); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; paint(); } finally { ctx = saved; }
    return c;
  };
  const info = mk(() => {
    if (R.slogan) {
      ctx.font = '900 14px system-ui';
      const w = ctx.measureText(txt).width + 18;
      ctx.fillStyle = color; roundRect(-w / 2, -58, w, 22, 11); ctx.fill();
      ctx.fillStyle = '#0d1020'; ctx.fillText(txt, 0, -46);
    }
    ctx.font = '800 16px system-ui';
    let sub;
    if (last.made) sub = T('ban.made', { name: starOf(last.attacker), pts: last.pts }) + (last.open ? T('ban.open') : '');
    else if (last.result === 'block') sub = T('ban.block', { name: starOf(last.defender) });
    else if (last.result === 'steal') sub = T('ban.steal', { name: starOf(last.defender) });
    else sub = starOf(last.attacker);
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(sub, 0, 38); ctx.fillStyle = '#fff'; ctx.fillText(sub, 0, 38);
    let info2 = last.made ? T('ban.keep') : T('ban.change');
    if (last.made && last.streak >= 3) info2 = T('ban.streak', { n: last.streak });
    ctx.font = '800 13px system-ui'; ctx.strokeText(info2, 0, 62);
    ctx.fillStyle = last.made ? (last.streak >= 3 ? '#ff9a3c' : '#3ddc84') : 'rgba(255,255,255,.85)'; ctx.fillText(info2, 0, 62);
  });
  const slogan = mk(() => {
    ctx.rotate(-0.07);
    let fs = Math.min(44, W * 0.105);
    ctx.font = `${fs}px Bungee, system-ui`;
    const tw = ctx.measureText(big).width;
    if (tw > W * 0.88) { fs *= (W * 0.88) / tw; ctx.font = `${fs}px Bungee, system-ui`; }
    const gr = ctx.createLinearGradient(0, -fs / 2, 0, fs / 2);
    if (last.made) { gr.addColorStop(0, '#fff6b0'); gr.addColorStop(0.5, '#ffcc33'); gr.addColorStop(1, '#ff7a1a'); }
    else if (R.res === 'block' || R.res === 'steal') { gr.addColorStop(0, '#d8fbff'); gr.addColorStop(1, '#22c3e6'); }
    else { gr.addColorStop(0, '#ffd0d8'); gr.addColorStop(1, '#ff4d6d'); }
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9; ctx.strokeStyle = '#05070f'; ctx.strokeText(big, 0, 0);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.strokeText(big, 0, 0);
    ctx.fillStyle = gr; ctx.fillText(big, 0, 0);
  });
  R.img = { info, slogan, cw, ch, cx, cy, W, lang, scale: renderScale };
  return R.img;
}

function drawBanner(R, rt) {
  const last = R.last;
  const pop = rt < 220 ? 0.4 + 0.8 * (rt / 220) : 1.2 - 0.2 * Math.min(1, (rt - 220) / 160);
  const fade = rt > 2000 ? Math.max(0, 1 - (rt - 2000) / 400) : 1;
  const I = bannerImages(R);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.drawImage(I.info, W / 2 - I.cx, H * 0.48 - I.cy, I.cw, I.ch);
  ctx.translate(W / 2, H * 0.48);
  ctx.scale(pop, pop);
  ctx.drawImage(I.slogan, -I.cx, -I.cy, I.cw, I.ch);
  ctx.restore();
  // sparks
  if (last.made && rt < 120 && !R.sparked) {
    R.sparked = true;
    for (let i = 0; i < 40; i++) sparks.push({ x: W / 2, y: H * 0.48, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 8 - 1, life: 1, c: ['#ffcc33', '#ff7a1a', '#ffffff', '#3ddc84'][i % 4] });
  }
  for (const p of sparks) { p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.life -= 0.02; }
  sparks = sparks.filter(p => p.life > 0);
  for (const p of sparks) { ctx.globalAlpha = p.life; ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 3, 3); }
  ctx.globalAlpha = 1;
}

function breakTitle(m) {
  if (m.breakKind === 'half') return T('brk.half');
  if (m.breakKind === 'ot') return T('brk.ot');
  return T('brk.q', { n: m.quarter });
}

// Quarter/half break: MANYAFEST pom-pom show
let lastBeat = 0;
function drawBreak(t, Tn) {
  const m = S.match;
  ctx.fillStyle = 'rgba(5,7,15,.55)'; ctx.fillRect(-10, -10, W + 20, H + 20);
  // stage lights
  for (let i = 0; i < 3; i++) {
    const a = Math.sin(t / 700 + i * 2) * 0.5;
    const gx = W * (0.2 + 0.3 * i);
    const gr = ctx.createLinearGradient(gx, 0, gx + a * 120, H);
    gr.addColorStop(0, ['rgba(255,122,26,.25)', 'rgba(34,195,230,.25)', 'rgba(255,77,200,.25)'][i]); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(gx - 10, 0); ctx.lineTo(gx + 10, 0); ctx.lineTo(gx + a * 200 + 90, H); ctx.lineTo(gx + a * 200 - 90, H); ctx.closePath(); ctx.fill();
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '24px Bungee, system-ui'; ctx.lineWidth = 6; ctx.strokeStyle = '#05070f';
  const ttl = breakTitle(m);
  ctx.strokeText(ttl, W / 2, H * 0.2); ctx.fillStyle = '#ffcc33'; ctx.fillText(ttl, W / 2, H * 0.2);
  ctx.font = '900 20px system-ui';
  const tn = r => (teamOf(r) ? teamOf(r).short : nameOf(r));
  const sc = `${tn('host')} ${m.score.host} – ${m.score.guest} ${tn('guest')}`;
  ctx.strokeText(sc, W / 2, H * 0.27); ctx.fillStyle = '#fff'; ctx.fillText(sc, W / 2, H * 0.27);
  const C = window.PotaCheer;
  if (C) {
    try {
      C.drawTitle(ctx, W / 2, H * 0.37, t, {});
      C.drawLyrics(ctx, W, H, t, { y: H * 0.5 });
      C.drawSquad(ctx, W / 2, H * 0.84, Math.min(W * 0.88, 440), t, { colors: [kitOf('host').body, kitOf('guest').body] });
    } catch (e) { /* the game goes on even without the show */ }
  }
  // rhythm
  if (t - lastBeat > 470) { lastBeat = t; sfx('beat'); }
}

function drawCountdown(ms) {
  ctx.fillStyle = 'rgba(5,7,15,.45)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffcc33'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '56px Bungee, system-ui';
  ctx.fillText(ms > 1000 ? T('cd.ready') : T('cd.go'), W / 2, H * 0.45);
}

let lastTick = -1;
// write to the DOM only when a value actually changes (avoids style/layout work every frame)
const domCache = new Map();
function setProp(el, key, val, apply) {
  const k = el.id + '|' + key;
  if (domCache.get(k) === val) return;
  domCache.set(k, val); apply(val);
}
const setText = (el, v) => setProp(el, 'text', v, x => { el.textContent = x; });
const setDisp = (el, v) => setProp(el, 'disp', v, x => { el.style.display = x; });
function updateClockAndHint(Tn, playing) {
  const m = S.match;
  const clock = $('clock');
  if (m.phase === 'break') {
    const left = Math.max(0, Math.ceil((m.breakUntil - Tn) / 1000));
    setText(clock, `0:${String(Math.min(left, 99)).padStart(2, '0')}`); clock.classList.remove('low');
  } else if (m.phase === 'turn' && !playing) {
    const left = Math.max(0, Math.ceil((m.deadline - Tn) / 1000));
    const lbl = `0:${String(Math.min(left, 99)).padStart(2, '0')}`;
    setText(clock, lbl);
    clock.classList.toggle('low', left <= 3);
    if (left <= 3 && left > 0 && left !== lastTick && myTurnKind()) { lastTick = left; sfx('tick'); }
  } else { setText(clock, '—'); clock.classList.remove('low'); }

  const chip = $('oppChip');
  if (m.phase === 'turn' && !playing && !(m.startsAt && Tn < m.startsAt)) {
    setDisp(chip, '');
    setText(chip, m.oppReady ? T('chip.ready') : T('chip.thinking'));
    chip.classList.toggle('ok', m.oppReady);
  } else setDisp(chip, 'none');

  const kind = myTurnKind();
  const mEl = $('modes');
  setDisp(mEl, kind === 'shoot' ? 'flex' : 'none');
  if (kind === 'shoot') for (const b of mEl.children) b.classList.toggle('on', b.dataset.m === mode);
  const dEl = $('dirs');
  const showDirs = kind === 'defend' || (kind === 'shoot' && isShot(mode));
  setDisp(dEl, showDirs ? 'flex' : 'none');
  dEl.classList.toggle('def', kind === 'defend');
  if (showDirs) for (const b of dEl.children) {
    const l = b.dataset.l;
    const vis = kind === 'defend' || (l !== 'S' && l !== 'P');
    const v = vis ? '' : 'none'; if (b.style.display !== v) b.style.display = v;
    b.classList.toggle('on', kind === 'shoot' && aimLane() === l);
  }
  const brk = m.phase === 'break';
  $('brk').classList.toggle('on', brk);
  if (brk) {
    const rb = $('readyBtn'); const me = m.ready && m.ready[role];
    if (rb.disabled !== !!me) rb.disabled = !!me;
    setText(rb, me ? T('rematch.wait') : T('ready'));
  }

  const myMove = m.myMove || (pending && pending.turn === m.turn ? pending : null);
  if (playing && hidingLast()) setHint('…', ' ');
  else if (playing) {
    const [txt] = RESULT_TEXT[reveal.res] || [''];
    setHint(txt, reveal.last.made ? T('hint.made', { name: starOf(reveal.last.attacker), pts: reveal.last.pts }) : T('hint.change'));
  } else if (m.phase === 'over') setHint(T('hint.over'), ' ');
  else if (m.phase === 'break') setHint(breakTitle(m), T('hint.break'));
  else if (m.startsAt && Tn < m.startsAt) setHint(T('hint.starting'), m.shooter === role ? T('hint.firstAtt') : T('hint.firstDef'));
  else if (m.shooter === role) {
    if (myMove) setHint(T('hint.moveReady'), m.oppReady ? T('hint.resultSoon') : T('hint.oppDef'));
    else setHint(T('hint.att', { mode: MODE_INFO[mode].name + (aimLane() ? ' · ' + LANE_NAME[aimLane()] : '') }), MODE_INFO[mode].tip);
  } else {
    if (myMove) setHint(`🛡️ ${DEF_NAME[myMove.lane] || ''} ✓`, m.oppReady ? T('hint.resultSoon') : T('hint.oppAtt'));
    else setHint(T('hint.def'), T('hint.defTip'));
  }
  if (m.phase === 'over' && !playing && !$('overModal').classList.contains('on')) updateHud();
}

function onImpact(R) {
  const mine = R.last.attacker === role;
  const res = R.res;
  if (R.last.made) { crowdExcite = res === 'poster' || res === 'dunk' || R.last.pts === 2 ? 1 : 0.75; crowdT = R.last.attacker; }
  else if (res === 'block' || res === 'steal') { crowdExcite = 0.7; crowdT = R.last.defender; }
  if (res === 'block') { sfx('block'); vibrate([60, 40, 60]); }
  else if (res === 'steal') { sfx('steal'); vibrate([30, 30, 30]); if (!mine) setTimeout(() => sfx('cheer'), 200); }
  else if (res === 'clock') sfx('buzzer');
  else if (res === 'dunk' || res === 'poster') { sfx('block'); sfx('clank'); setTimeout(() => sfx('cheer'), 150); vibrate(res === 'poster' ? [80, 40, 120] : 80); }
  else if (R.last.made) { sfx(res === 'swish' ? 'swish' : 'clank'); setTimeout(() => sfx('swish'), res === 'swish' ? 0 : 250); setTimeout(() => sfx('cheer'), 300); if (mine) vibrate(40); }
  else { sfx('clank'); setTimeout(() => sfx('aww'), 400); }
}

function vibrate(p) { try { navigator.vibrate && navigator.vibrate(p); } catch {} }

// ---------- sound ----------
let AC = null;
function unlockAudio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch { AC = null; } }
  if (AC && AC.state === 'suspended') AC.resume();
}
function noise(dur) {
  const b = AC.createBuffer(1, Math.ceil(AC.sampleRate * dur), AC.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = AC.createBufferSource(); s.buffer = b; return s;
}
function env(g, t, a, d, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function sfx(kind) {
  if (muted || !AC) return;
  const t = AC.currentTime;
  const g = AC.createGain(); g.connect(AC.destination);
  if (kind === 'swish' || kind === 'whoosh') {
    const n = noise(0.4), f = AC.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = kind === 'swish' ? 3200 : 900; f.Q.value = 0.8;
    n.connect(f); f.connect(g); env(g, t, 0.02, kind === 'swish' ? 0.28 : 0.2, kind === 'swish' ? 0.5 : 0.25); n.start(t); n.stop(t + 0.4);
  } else if (kind === 'clank') {
    for (const fr of [620, 980, 1370]) { const o = AC.createOscillator(); o.type = 'square'; o.frequency.value = fr; o.connect(g); o.start(t); o.stop(t + 0.25); }
    env(g, t, 0.005, 0.22, 0.12);
  } else if (kind === 'block') {
    const o = AC.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.25);
    o.connect(g); env(g, t, 0.005, 0.3, 0.8); o.start(t); o.stop(t + 0.35);
  } else if (kind === 'buzzer') {
    const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 196; o.connect(g); env(g, t, 0.01, 0.6, 0.25); o.start(t); o.stop(t + 0.7);
  } else if (kind === 'steal') {
    const n = noise(0.15), f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    n.connect(f); f.connect(g); env(g, t, 0.005, 0.12, 0.4); n.start(t); n.stop(t + 0.15);
    const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(1800, t + 0.12);
    const g2 = AC.createGain(); g2.connect(AC.destination); o.connect(g2); env(g2, t, 0.005, 0.15, 0.2); o.start(t); o.stop(t + 0.2);
  } else if (kind === 'beat') {
    const o = AC.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    o.connect(g); env(g, t, 0.002, 0.14, 0.35); o.start(t); o.stop(t + 0.16);
    const n = noise(0.05), f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g2 = AC.createGain(); g2.connect(AC.destination); n.connect(f); f.connect(g2); env(g2, t + 0.235, 0.002, 0.04, 0.08); n.start(t + 0.235); n.stop(t + 0.3);
  } else if (kind === 'tick') {
    const o = AC.createOscillator(); o.type = 'square'; o.frequency.value = 1200; o.connect(g); env(g, t, 0.002, 0.05, 0.08); o.start(t); o.stop(t + 0.08);
  } else if (kind === 'cheer' || kind === 'aww') {
    const n = noise(1.2), f = AC.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(kind === 'cheer' ? 1800 : 700, t);
    if (kind === 'aww') f.frequency.exponentialRampToValueAtTime(250, t + 1);
    n.connect(f); f.connect(g); env(g, t, 0.15, 0.9, kind === 'cheer' ? 0.22 : 0.15); n.start(t); n.stop(t + 1.2);
  }
}

// ---------- startup ----------
// ---------- offline: vs CPU ----------
// Rules also run in the browser (lib/rules.js); a local room is used instead of the server.
let local = null, cpuTimer = null;
const rnd = a => a[Math.floor(Math.random() * a.length)];
function weighted(items) {
  const sum = items.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * sum;
  for (const [v, w] of items) { if ((r -= w) <= 0) return v; }
  return items[items.length - 1][0];
}
function gauss() { return (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 0.816; }

function cpuPickFor(room) {
  const teams = TEAMS ? TEAMS.TEAMS.filter(t => !room.picks.host || t.id !== room.picks.host.teamId) : [];
  if (!teams.length) return null;
  const t = rnd(teams);
  return { teamId: t.id, playerIdx: Math.floor(Math.random() * t.players.length) };
}

function localApi(body) {
  const R = window.PotaRules, room = local.room, now = Date.now();
  R.advance(room, now);
  let err = null;
  switch (body.action) {
    case 'state': break;
    case 'move': err = R.submitMove(room, 'host', body, now); if (!err) R.advance(room, now); break;
    case 'ready': err = R.setReady(room, 'host'); if (!err) R.advance(room, now); break;
    case 'sub': err = R.substitute(room, 'host', body.playerIdx); break;
    case 'pick': err = R.setPick(room, 'host', body.pick); break;
    case 'rematch':
      if (!room.match || room.match.phase !== 'over') err = 'e.notOver';
      else { room.seed += 1; room.picks.guest = cpuPickFor(room) || room.picks.guest; R.startMatch(room, now); }
      break;
    default: err = 'e.unknown';
  }
  if (err) { const e = new Error(errText(err)); e.code = err; return Promise.reject(e); }
  const st = R.view(room, 'host', now);
  st.cpu = true;
  return Promise.resolve({ state: st });
}

// CPU brain: thinks a bit, chooses based on its player's abilities
function cpuTick() {
  if (!local) return;
  const R = window.PotaRules, room = local.room, m = room.match, now = Date.now();
  R.advance(room, now);
  if (!m) return;
  const me = 'guest';
  if (m.phase === 'turn' && now >= (m.startsAt || 0) && !m.moves[me]) {
    if (local.poss !== m.poss) { local.poss = m.poss; local.at = now + 900 + Math.random() * 3800; }
    if (now < local.at) return;
    const p = R.playerOf(room, me);
    if (m.possession === me) {
      const md = weighted([['shot1', 0.6 * p.two], ['shot2', 0.75 * p.three], ['layup', 0.55 * (p.layup ?? p.two)], ['dunk', 0.5 * Math.max(0.1, (p.dunk ?? p.two) - 0.25)]]);
      const mv = { poss: m.poss, mode: md, lane: rnd(['L', 'C', 'R']) };
      if (md === 'shot1' || md === 'shot2') {
        const band = R.shotSpot(room, m, md === 'shot2' ? 2 : 1).band;
        mv.err = Math.round(gauss() * band * 0.6 * 10000) / 10000;
      }
      R.submitMove(room, me, mv, now);
    } else {
      R.submitMove(room, me, { poss: m.poss, lane: weighted([['L', 0.2], ['C', 0.2], ['R', 0.2], ['P', 0.26], ['S', 0.14]]) }, now);
    }
    R.advance(room, now);
  } else if (m.phase === 'break' && !(m.ready && m.ready[me])) {
    if (local.brk !== m.quarter) { local.brk = m.quarter; local.at = now + 2500 + Math.random() * 3000; }
    if (now < local.at) return;
    if (Math.random() < 0.35) R.substitute(room, me, Math.floor(Math.random() * 3));
    R.setReady(room, me);
    R.advance(room, now);
  }
}

async function startCpuGame() {
  unlockAudio();
  const R = window.PotaRules;
  if (!R) return;
  const name = $('nameInput').value.trim();
  store.set('pota:name', name);
  const pick = await choosePick('var(--host)');
  if (pick === undefined) return;
  const now = Date.now();
  const room = R.initialRoom('CPU' + Math.random().toString(36).slice(2, 7).toUpperCase(), now);
  room.names = { host: name.slice(0, 16), guest: 'CPU' };
  if (pick) room.picks.host = pick;
  room.picks.guest = cpuPickFor(room);
  if (!room.picks.guest) delete room.picks.guest;
  room.guestJoined = true;
  R.startMatch(room, now);
  local = { room, poss: -1, at: 0 };
  code = room.code; token = 'local'; offset = 0; haveOffset = true;
  history.replaceState(null, '', '/');
  clearInterval(cpuTimer); cpuTimer = setInterval(cpuTick, 150);
  const j = await localApi({ action: 'state' });
  applyState(j.state);
  poll();
}
function stopLocal() { local = null; clearInterval(cpuTimer); cpuTimer = null; }
$('cpuBtn').onclick = startCpuGame;


// ---------- personal stats (localStorage only) ----------
const STATS_KEY = 'pota:stats';
function loadStats() {
  try { const v = JSON.parse(store.get(STATS_KEY) || 'null'); if (v && v.v === 1) return v; } catch { /* ignore */ }
  return { v: 1, games: 0, wins: 0, cpuGames: 0, onlineGames: 0, pts: 0, blocks: 0, steals: 0, posters: 0, bestStreak: 0,
    att: { shot1: 0, shot2: 0, layup: 0, dunk: 0 }, made: { shot1: 0, shot2: 0, layup: 0, dunk: 0 }, counted: [] };
}
function saveStats(st) { store.set(STATS_KEY, JSON.stringify(st)); }
// Called when a match is over: add this match once
function recordPersonalStats() {
  const m = S && S.match;
  if (!m || m.phase !== 'over' || !m.stats || !m.stats[role]) return;
  const key = `${S.code}:${m.seed}`;
  const st = loadStats();
  if (st.counted.includes(key)) return;
  const me = m.stats[role];
  st.counted = st.counted.concat(key).slice(-50);
  st.games += 1; if (m.winner === role) st.wins += 1;
  if (S.cpu) st.cpuGames += 1; else st.onlineGames += 1;
  st.pts += me.pts; st.blocks += me.blocks; st.steals += me.steals; st.posters += me.posters;
  st.bestStreak = Math.max(st.bestStreak, me.bestStreak);
  for (const k of Object.keys(st.att)) { st.att[k] += me.att[k] || 0; st.made[k] += me.made[k] || 0; }
  saveStats(st);
}
function renderStats() {
  const st = loadStats();
  const body = $('statsBody');
  if (!st.games) { body.innerHTML = `<div class="empty">${escapeHtml(T('stats.empty'))}</div>`; return; }
  const fav = Object.keys(st.att).sort((a, b) => st.att[b] - st.att[a])[0];
  const tile = (v, k) => `<div class="tile"><b>${escapeHtml(String(v))}</b><span>${escapeHtml(T(k))}</span></div>`;
  let html = '<div class="grid">' +
    tile(st.games, 'stats.games') + tile(st.wins, 'stats.wins') +
    tile(Math.round((st.wins / st.games) * 100) + '%', 'stats.winPct') + tile(st.pts, 'stats.points') +
    tile(st.blocks, 'stats.blocks') + tile(st.steals, 'stats.steals') +
    tile(st.posters, 'stats.posters') + tile(st.bestStreak, 'stats.streak') + '</div>';
  html += `<div class="shoot"><div><b>${escapeHtml(T('stats.fav'))}</b><span>${escapeHtml(MODE_INFO[fav].name)}</span></div>`;
  for (const k of Object.keys(st.att)) {
    const pct = st.att[k] ? Math.round((st.made[k] / st.att[k]) * 100) : 0;
    html += `<div><span>${escapeHtml(MODE_INFO[k].name)}</span><span>${st.made[k]} / ${st.att[k]} · ${pct}%</span></div>`;
  }
  html += `<div><span>${escapeHtml(T('stats.online'))} · ${escapeHtml(T('stats.vsCpu'))}</span><span>${st.onlineGames} · ${st.cpuGames}</span></div></div>`;
  body.innerHTML = html;
}
$('statsBtn').onclick = () => { renderStats(); $('statsModal').classList.add('on'); };
$('statsClose').onclick = () => $('statsModal').classList.remove('on');
$('statsReset').onclick = () => { if (confirm(T('stats.resetConfirm'))) { store.set(STATS_KEY, ''); renderStats(); } };

// ---------- shareable result card ----------
function loadImg(src) {
  return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
}
// Draw text centred at x, shrinking the font until it fits maxW
function fitText(g, text, x, y, maxW, size, font, color) {
  let px = size;
  g.font = font.replace('{px}', px);
  while (g.measureText(text).width > maxW && px > 14) { px -= 1; g.font = font.replace('{px}', px); }
  g.fillStyle = color; g.fillText(text, x, y);
}
async function makeResultCard() {
  const m = S.match, W2 = 1080, H2 = 1350;
  const c = document.createElement('canvas'); c.width = W2; c.height = H2;
  const g = c.getContext('2d');
  try { await document.fonts.ready; } catch { /* ignore */ }
  const disp = 'Bungee, system-ui, sans-serif', ui = 'Rubik, system-ui, sans-serif';
  // asphalt background + court lines
  g.fillStyle = '#121014'; g.fillRect(0, 0, W2, H2);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`; g.fillRect(Math.random() * W2, Math.random() * H2, 2, 2); }
  g.strokeStyle = 'rgba(255,247,236,.08)'; g.lineWidth = 6;
  g.beginPath(); g.arc(W2 / 2, 500, 300, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(0, 500); g.lineTo(W2, 500); g.stroke();
  const glow = g.createRadialGradient(W2 / 2, H2, 50, W2 / 2, H2, 900); glow.addColorStop(0, 'rgba(255,107,26,.35)'); glow.addColorStop(1, 'rgba(255,107,26,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W2, H2);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // brand
  g.font = `48px ${disp}`; g.fillStyle = '#fff7ec'; g.fillText(`${T('brand.1')} ${T('brand.2')}`, W2 / 2, 90);
  // stamp
  const win = m.winner === role;
  g.save(); g.translate(W2 / 2, 210); g.rotate(-0.07);
  g.font = `92px ${disp}`; g.lineWidth = 10; g.strokeStyle = win ? '#5bf08a' : '#ff3d6e'; g.fillStyle = win ? '#5bf08a' : '#ff3d6e';
  const st = win ? T('share.win') : T('share.loss'); const sw = g.measureText(st).width + 70;
  g.strokeRect(-sw / 2, -70, sw, 140); g.fillText(st, 0, 6); g.restore();
  // teams + score
  const side = (r, x) => {
    const t = teamOf(r), p = playerOf(r);
    return { x, t, name: t ? t.name : nameOf(r), star: p ? p.name : nameOf(r), user: nameOf(r), score: m.score[r], color: kitOf(r).body };
  };
  const L = side(role, 270), R = side(role === 'host' ? 'guest' : 'host', 810);
  for (const s2 of [L, R]) {
    if (s2.t && window.PotaLogo) { const im = await loadImg(window.PotaLogo.dataUrl(s2.t, 180)); if (im) g.drawImage(im, s2.x - 90, 330, 180, 180); }
    g.font = `150px ${disp}`; g.fillStyle = '#fff7ec'; g.fillText(String(s2.score), s2.x, 640);
    fitText(g, s2.name, s2.x, 750, 440, 34, `700 {px}px ${ui}`, '#fff7ec');
    fitText(g, `${s2.star} · ${s2.user}`, s2.x, 795, 440, 30, `600 {px}px ${ui}`, '#a59fb2');
    g.fillStyle = s2.color; g.fillRect(s2.x - 120, 822, 240, 10);
  }
  g.font = `70px ${disp}`; g.fillStyle = '#ffd23f'; g.fillText('–', W2 / 2, 630);
  // highlights
  g.fillStyle = '#000'; g.fillRect(70, 880, W2 - 140, 330);
  g.font = `40px ${disp}`; g.fillStyle = '#c6ff3d'; g.fillText(T('share.highlights'), W2 / 2, 935);
  const ms = m.stats || {}; const a = ms[role] || {}, b = ms[role === 'host' ? 'guest' : 'host'] || {};
  const rows = [
    ['hl.2pt', (a.made || {}).shot2 || 0, (b.made || {}).shot2 || 0],
    ['hl.dunks', (a.made || {}).dunk || 0, (b.made || {}).dunk || 0],
    ['hl.posters', a.posters || 0, b.posters || 0],
    ['hl.blocks', a.blocks || 0, b.blocks || 0],
    ['hl.steals', a.steals || 0, b.steals || 0],
    ['hl.streak', a.bestStreak || 0, b.bestStreak || 0],
  ];
  rows.forEach(([k, va, vb], i) => {
    const y = 995 + i * 37;
    g.font = `600 30px ${ui}`; g.fillStyle = '#a59fb2'; g.fillText(T(k), W2 / 2, y);
    g.font = `34px ${disp}`; g.fillStyle = '#fff7ec'; g.fillText(String(va), 270, y); g.fillText(String(vb), 810, y);
  });
  g.font = `600 32px ${ui}`; g.fillStyle = '#ff6b1a'; g.fillText(T('share.cta', { url: location.host }), W2 / 2, 1285);
  return c;
}
$('shareCardBtn').onclick = async () => {
  try {
    const c = await makeResultCard();
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const file = new File([blob], 'basketball-duel-result.png', { type: 'image/png' });
    const m = S.match, opp = role === 'host' ? 'guest' : 'host';
    const text = T('share.text', { score: `${m.score[role]}–${m.score[opp]}` }) + ' ' + location.origin;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text, title: T('brand.title') }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(T('share.saved'));
  } catch (e) { toast(T('err.generic')); }
};

// ---------- language selector ----------
function renderLangs() {
  const I = window.PotaI18n;
  if (!I) return;
  for (const box of document.querySelectorAll('.langs')) {
    box.innerHTML = '';
    for (const L of I.LANGS) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = `${L.flag} ${L.code.toUpperCase()}`; b.title = L.name;
      b.classList.toggle('on', L.code === I.lang);
      b.onclick = () => I.setLang(L.code);
      box.appendChild(b);
    }
  }
}
const HTML_TITLE = document.title;   // keep the descriptive (SEO) title in English
if (window.PotaI18n) {
  window.PotaI18n.onChange(() => {
    renderLangs();
    domCache.clear();
    document.title = window.PotaI18n.lang === 'en' ? HTML_TITLE : T('brand.title');
    crowd = null;
    if (S && S.match) updateHud();
  });
}

function boot() {
  const q = new URLSearchParams(location.search);
  const oda = (q.get('oda') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!oda) return show('home');
  code = oda;
  token = store.get('pota:tok:' + code);
  if (token) {
    show('joinScr'); $('joinText').textContent = T('join.connecting');
    join('').catch(e => { $('joinText').textContent = T('join.invited'); $('joinErr').textContent = e.message; token = null; });
  } else {
    show('joinScr');
  }
}
if (window.PotaI18n) window.PotaI18n.setLang(window.PotaI18n.lang);   // DOM texts + direction (RTL)
renderLangs();
if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); }); }
requestAnimationFrame(frame);
boot();
})();
