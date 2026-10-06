import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../dist');
const port = Number(process.env.TRAINER_PORT ?? 4173);
const mount = ('/' + (process.env.TRAINER_BASE_PATH ?? '').replace(/^\/+|\/+$/g, '')).replace(/\/$/, '');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.hdr': 'application/octet-stream', '.woff': 'font/woff', '.woff2': 'font/woff2' };
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const requestPath = decodeURIComponent(url.pathname);
    if (mount && requestPath !== mount && !requestPath.startsWith(mount + '/')) { res.writeHead(404).end('Not found'); return; }
    if (mount && requestPath === mount) { res.writeHead(308, { Location: mount + '/' + url.search }).end(); return; }
    const relativePath = requestPath.slice(mount.length) || '/';
    let file = path.resolve(root, '.' + relativePath);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (file === root || /^\/(dashboard|trainer)\/?$/.test(relativePath)) file = path.join(root, 'index.html');
    else if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const b = await readFile(file); res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(b);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Static trainer: http://127.0.0.1:${port}${mount}/`));
