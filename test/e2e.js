// End-to-end smoke test (Playwright). Run: node test/e2e.js
// Starts test/dev-server.js on a free port, plays an online duel with two
// mobile contexts, an offline CPU game, and checks the i18n RTL switch.
// Exits with code 1 on any failed assertion, page error or console error.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const PORT_START = 4310;
const MOBILE = { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const problems = [];
let step = 'init';
const log = (...a) => console.log('[e2e]', ...a);

function assert(cond, msg) { if (!cond) throw new Error('assertion failed: ' + msg); }

function freePort(start) {
  return new Promise(resolve => {
    const s = net.createServer();
    s.once('error', () => resolve(freePort(start + 1)));
    s.listen(start, () => s.close(() => resolve(start)));
  });
}

async function waitForServer(base, child) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error('dev server exited early (code ' + child.exitCode + ')');
    try { const r = await fetch(base + '/'); if (r.ok) return; } catch (e) { /* not up yet */ }
    await sleep(100);
  }
  throw new Error('dev server did not start');
}

// Collect page errors and console errors for a page.
function watch(page, label) {
  page.on('pageerror', e => problems.push(`${label} pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') problems.push(`${label} console.error: ${m.text()}`); });
}

// Team picker overlay: team -> next, player -> next.
async function pick(page) {
  await page.waitForSelector('.ps-root .ps-team', { timeout: 10000 });
  await page.locator('.ps-root .ps-team').first().click();
  await page.locator('.ps-root .ps-go').click();
  await page.waitForSelector('.ps-root .ps-player', { timeout: 10000 });
  await page.locator('.ps-root .ps-player').first().click();
  await page.locator('.ps-root .ps-go').click();
}

// POST /api/game from inside the page, using that player's stored token.
function api(page, code, body) {
  return page.evaluate(async ({ code, body }) => {
    const token = localStorage.getItem('pota:tok:' + code);
    const r = await fetch('/api/game', { method: 'POST', body: JSON.stringify({ code, token, ...body }) });
    return { status: r.status, json: await r.json() };
  }, { code, body });
}

async function waitState(page, code, pred, what, timeout = 15000) {
  const end = Date.now() + timeout;
  let last = null;
  while (Date.now() < end) {
    const r = await api(page, code, { action: 'state' });
    last = r.json.state;
    if (last && last.match && pred(last.match)) return last;
    await sleep(250);
  }
  throw new Error('timeout waiting for ' + what + ' (phase=' + (last && last.match && last.match.phase) + ')');
}

async function onlineFlow(browser, base) {
  step = 'online';
  const ctxA = await browser.newContext(MOBILE), ctxB = await browser.newContext(MOBILE);
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  watch(A, 'A'); watch(B, 'B');

  await A.goto(base + '/');
  await A.fill('#nameInput', 'Alice');
  await A.click('#createBtn');
  await pick(A);
  await A.waitForSelector('#waitScr.on', { timeout: 15000 });
  const code = (await A.textContent('#waitCode')).trim();
  assert(/^[A-Z0-9]{4,8}$/.test(code), 'room code looks valid: ' + code);
  log('room', code);

  await B.goto(base + '/?oda=' + code);
  await B.fill('#joinName', 'Bob');
  await B.click('#joinBtn');
  await pick(B);
  await A.waitForSelector('#game.on', { timeout: 20000 });
  await B.waitForSelector('#game.on', { timeout: 20000 });
  log('both players in game');

  const pageOf = { host: A, guest: B };
  for (let n = 0; n < 4; n++) {
    const st = await waitState(A, code, m => m.phase === 'turn', 'turn #' + n);
    const m = st.match, poss = m.poss, att = m.shooter, def = att === 'host' ? 'guest' : 'host';
    const before = { host: m.score.host, guest: m.score.guest };
    // mix of outcomes: clean shot, layup, badly-timed contested shot (likely a miss), layup
    const aMove = [{ mode: 'shot1', lane: 'L', err: 0 }, { mode: 'layup' }, { mode: 'shot2', lane: 'L', err: 3 }, { mode: 'layup' }][n];
    const defLane = n === 2 ? 'L' : 'R';
    // moves are refused until the countdown (startsAt) is over: wait for it using the server clock
    const wait = (m.startsAt || 0) - st.now;
    if (wait > 0) await sleep(wait + 150);
    const ra = await api(pageOf[att], code, { action: 'move', poss, ...aMove });
    let rd;
    assert(ra.status === 200, `attacker move accepted (poss ${poss}): ${JSON.stringify(ra.json)}`);
    rd = await api(pageOf[def], code, { action: 'move', poss, lane: defLane });
    assert(rd.status === 200, `defender move accepted (poss ${poss}): ${JSON.stringify(rd.json)}`);

    const rev = await waitState(A, code, x => x.phase === 'reveal' || x.poss > poss, 'reveal #' + n);
    const last = rev.match.last;
    assert(last && last.poss === poss, 'last result belongs to possession ' + poss);
    assert(last.attacker === att, 'last.attacker is the shooter');
    const gained = rev.match.score[att] - before[att];
    assert(gained === (last.made ? last.pts : 0), `score change matches result (made=${last.made}, +${gained})`);
    assert(rev.match.score[def] === before[def], 'defender score unchanged');
    assert(last.keeps === last.made, 'possession kept only on a made shot');

    const nxt = await waitState(A, code, x => x.phase === 'turn' && x.poss === poss + 1, 'next possession after #' + n, 20000);
    assert(nxt.match.shooter === (last.keeps ? att : def),
      `possession ${last.keeps ? 'kept' : 'changed'} after ${last.made ? 'made' : last.result}`);
    log(`poss ${poss}: ${att} ${aMove.mode} -> ${last.result} (made=${last.made}), score ${nxt.match.score.host}-${nxt.match.score.guest}`);
  }
  const fin = await api(A, code, { action: 'state' });
  const sc = fin.json.state.match.score;
  assert(String(await A.textContent('#ptsHost')).trim() !== '', 'scoreboard rendered');
  log('online final score', sc.host + '-' + sc.guest);
  await ctxA.close(); await ctxB.close();
}

async function cpuFlow(browser, base) {
  step = 'cpu';
  const ctx = await browser.newContext(MOBILE);
  const page = await ctx.newPage();
  watch(page, 'CPU');
  await page.goto(base + '/');
  await page.fill('#nameInput', 'Solo');
  await page.click('#cpuBtn');
  await pick(page);
  await page.waitForSelector('#game.on', { timeout: 15000 });
  log('cpu game started');

  const visible = sel => page.evaluate(s => { const e = document.querySelector(s); return !!e && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden'; }, sel);
  const counter = () => page.evaluate(() => { const m = /(\d+)\s*\/\s*\d+/.exec(document.getElementById('roundLbl').textContent); return m ? +m[1] : 0; });
  const c0 = await counter();

  // Wait until one of the action bars is shown (our turn to act), then play via the real UI.
  await page.waitForFunction(() => ['modes', 'dirs'].some(id => { const e = document.getElementById(id); return e && e.offsetParent !== null; }), null, { timeout: 20000 });
  await sleep(1800); // countdown before the first possession
  if (await visible('#modes')) {
    await page.click('#modes button[data-m=shot1]');
    await page.click('#dirs button[data-l=C]');
    const box = await page.locator('#cv').boundingBox();
    const x = box.x + box.width / 2;
    await page.mouse.move(x, box.y + box.height * 0.7);
    await page.mouse.down();
    await page.mouse.move(x, box.y + box.height * 0.5, { steps: 6 });
    await page.mouse.move(x, box.y + box.height * 0.25, { steps: 6 });
    await page.mouse.up();
    log('cpu: attacked with a swipe');
  } else {
    await page.click('#dirs button[data-l=R]');
    log('cpu: defended');
  }
  // The possession counter (n/8 in #roundLbl) advances once the CPU has answered and the result is shown.
  await page.waitForFunction(c0 => { const m = /(\d+)\s*\/\s*\d+/.exec(document.getElementById('roundLbl').textContent); return m && +m[1] > c0; }, c0, { timeout: 25000 });
  const sc = await page.evaluate(() => `${document.getElementById('ptsHost').textContent}-${document.getElementById('ptsGuest').textContent} ${document.getElementById('roundLbl').textContent}`);
  log('cpu possession advanced:', sc);
  await ctx.close();
}

async function i18nFlow(browser, base) {
  step = 'i18n';
  const ctx = await browser.newContext(MOBILE);
  const page = await ctx.newPage();
  watch(page, 'i18n');
  await page.goto(base + '/');
  await page.evaluate(() => PotaI18n.setLang('ar'));
  assert(await page.evaluate(() => document.documentElement.dir) === 'rtl', 'Arabic sets dir=rtl');
  await page.evaluate(() => PotaI18n.setLang('en'));
  assert(await page.evaluate(() => document.documentElement.dir) === 'ltr', 'English sets dir=ltr');
  log('i18n rtl/ltr ok');
  await ctx.close();
}

async function main() {
  const port = await freePort(PORT_START);
  const base = 'http://127.0.0.1:' + port;
  const server = spawn(process.execPath, [path.join(__dirname, 'dev-server.js'), String(port)], { stdio: ['ignore', 'pipe', 'inherit'] });
  const stop = () => { if (server.exitCode === null) server.kill(); };
  process.on('exit', stop);
  let browser, failed = null;
  try {
    await waitForServer(base, server);
    browser = await chromium.launch();
    await onlineFlow(browser, base);
    await cpuFlow(browser, base);
    await i18nFlow(browser, base);
  } catch (e) {
    failed = e;
    problems.push(`[${step}] ${e.message}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    stop();
  }
  if (problems.length) {
    console.error('\nE2E FAILED');
    problems.forEach(p => console.error(' - ' + p));
    process.exit(1);
  }
  console.log('\nE2E OK: online duel, CPU game, i18n RTL — no page or console errors');
  process.exit(0);
}

main();
