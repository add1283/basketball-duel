// Single endpoint: POST /api/game  { action, ... }
const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
const R = require('../lib/rules');

const sql = neon(process.env.DATABASE_URL);
let ready = null;
function ensureTable() {
  if (!ready) {
    ready = sql`CREATE TABLE IF NOT EXISTS pota_rooms (
      code text PRIMARY KEY,
      host_token text NOT NULL,
      guest_token text,
      data jsonb NOT NULL,
      version int NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`.catch(e => { ready = null; throw e; });
  }
  return ready;
}

const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  const b = crypto.randomBytes(6);
  return Array.from(b, x => ALPH[x % ALPH.length]).join('');
}
const newToken = () => crypto.randomBytes(18).toString('base64url');
const cleanName = (n, d) => (String(n || '').replace(/[<>]/g, '').trim().slice(0, 16) || d);

async function load(code) {
  const rows = await sql`SELECT * FROM pota_rooms WHERE code = ${code}`;
  return rows[0] || null;
}

// read → modify → write with version check (retry on conflict)
async function mutate(code, fn) {
  for (let i = 0; i < 5; i++) {
    const row = await load(code);
    if (!row) return { error: 'e.roomNotFound', status: 404 };
    const room = row.data;
    const out = fn(room, row);
    if (out && out.error) return out;
    if (!out || !out.changed) return { row, room };
    const upd = await sql`UPDATE pota_rooms SET data = ${JSON.stringify(room)}::jsonb,
      guest_token = ${out.guestToken || row.guest_token},
      version = version + 1, updated_at = now()
      WHERE code = ${code} AND version = ${row.version} RETURNING version`;
    if (upd.length) return { row: { ...row, guest_token: out.guestToken || row.guest_token }, room };
  }
  return { error: 'e.busy', status: 409 };
}

function roleOf(row, token) {
  if (!token) return null;
  if (token === row.host_token) return 'host';
  if (row.guest_token && token === row.guest_token) return 'guest';
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST' });
  try {
    await ensureTable();
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const now = Date.now();
    const code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

    if (b.action === 'create') {
      if (Math.random() < 0.05) await sql`DELETE FROM pota_rooms WHERE updated_at < now() - interval '3 days'`;
      for (let i = 0; i < 5; i++) {
        const c = newCode();
        const token = newToken();
        const room = R.initialRoom(c, now);
        room.names.host = cleanName(b.name, '');
        if (b.pick) { const e = R.setPick(room, 'host', b.pick); if (e) return res.status(400).json({ error: e }); }
        const ins = await sql`INSERT INTO pota_rooms (code, host_token, data)
          VALUES (${c}, ${token}, ${JSON.stringify(room)}::jsonb) ON CONFLICT DO NOTHING RETURNING code`;
        if (ins.length) return res.json({ token, state: R.view(room, 'host', now) });
      }
      return res.status(500).json({ error: 'e.createFail' });
    }

    if (!code) return res.status(400).json({ error: 'e.noCode' });

    if (b.action === 'join') {
      let token = null, role = null;
      const out = await mutate(code, (room, row) => {
        role = roleOf(row, b.token);
        if (role) { token = b.token; return { changed: R.advance(room, now) }; }
        if (row.guest_token) return { error: 'e.roomFull', status: 403 };
        token = newToken(); role = 'guest';
        room.names.guest = cleanName(b.name, '');
        if (b.pick) { const e = R.setPick(room, 'guest', b.pick); if (e) return { error: e, status: 400 }; }
        room.guestJoined = true;
        R.startMatch(room, now);
        return { changed: true, guestToken: token };
      });
      if (out.error) return res.status(out.status).json({ error: out.error });
      return res.json({ token, state: R.view(out.room, role, now) });
    }

    let role = null;
    const out = await mutate(code, (room, row) => {
      role = roleOf(row, b.token);
      if (!role) return { error: 'e.notPlayer', status: 403 };
      let changed = R.advance(room, now);
      if (b.action === 'move') {
        const err = R.submitMove(room, role, b, now);
        if (err) return { error: err, status: 400 };
        R.advance(room, now);
        changed = true;
      } else if (b.action === 'sub') {
        const err = R.substitute(room, role, b.playerIdx);
        if (err) return { error: err, status: 400 };
        changed = true;
      } else if (b.action === 'ready') {
        const err = R.setReady(room, role);
        if (err) return { error: err, status: 400 };
        R.advance(room, now);
        changed = true;
      } else if (b.action === 'pick') {
        const err = R.setPick(room, role, b.pick);
        if (err) return { error: err, status: 400 };
        changed = true;
      } else if (b.action === 'rematch') {
        if (!room.match || room.match.phase !== 'over') return { error: 'e.notOver', status: 400 };
        room.rematch[role] = true;
        if (room.rematch.host && room.rematch.guest) { room.seed += 1; R.startMatch(room, now); }
        changed = true;
      } else if (b.action !== 'state') {
        return { error: 'e.unknown', status: 400 };
      }
      return { changed };
    });
    if (out.error) return res.status(out.status).json({ error: out.error });
    return res.json({ state: R.view(out.room, role, now) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'e.server' });
  }
};
