// Local test server: static files + /api/game, with an in-memory fake DB instead of Neon.
// Usage: node test/dev-server.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const rows = new Map();
function fakeNeon() {
  return (strings, ...vals) => {
    const q = strings.join('?').replace(/\s+/g, ' ').trim();
    let out = [];
    if (q.startsWith('CREATE') || q.startsWith('DELETE')) out = [];
    else if (q.startsWith('INSERT')) {
      const [code, host_token, data] = vals;
      if (!rows.has(code)) { rows.set(code, { code, host_token, guest_token: null, data: JSON.parse(data), version: 0 }); out = [{ code }]; }
    } else if (q.startsWith('SELECT')) {
      const r = rows.get(vals[0]); out = r ? [JSON.parse(JSON.stringify(r))] : [];
    } else if (q.startsWith('UPDATE')) {
      const [data, guest, code, version] = vals;
      const r = rows.get(code);
      if (r && r.version === version) { r.data = JSON.parse(data); r.guest_token = guest; r.version++; out = [{ version: r.version }]; }
    } else throw new Error('sahte DB: bilinmeyen sorgu ' + q);
    return Promise.resolve(out);
  };
}
const origLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === '@neondatabase/serverless') return { neon: fakeNeon };
  return origLoad.call(this, req, ...rest);
};

const root = path.join(__dirname, '..');
const handler = require(path.join(root, 'api/game.js'));
const types = { '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/game') {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', () => {
      req.body = body ? JSON.parse(body) : {};
      res.status = c => { res.statusCode = c; return res; };
      res.json = o => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
      handler(req, res);
    });
    return;
  }
  const f = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const full = path.join(root, f);
  if (!full.startsWith(root) || !fs.existsSync(full) || f.includes('..')) { res.statusCode = 404; return res.end('404'); }
  res.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream');
  fs.createReadStream(full).pipe(res);
}).listen(Number(process.argv[2]) || 3456, () => console.log('dev server ready'));
