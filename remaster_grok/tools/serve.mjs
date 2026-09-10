import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cardRoot = path.join(root, '..', 'card');
const allowedRoots = [
  path.resolve(root, 'src'),
  path.resolve(root, 'assets'),
  path.resolve(cardRoot)
];
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg'
};

export function isInside(file, dir) {
  const resolved = path.resolve(file);
  const base = path.resolve(dir);
  return resolved === base || resolved.startsWith(base + path.sep);
}

export function locate(urlPath) {
  const raw = String(urlPath || '/').split('?')[0];
  let clean;
  try {
    clean = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!clean || clean.includes('\0')) return null;
  const relative = clean === '/' ? 'index.html' : clean.replace(/^\/+/, '');
  const candidates = [
    path.resolve(root, 'src', relative),
    path.resolve(root, 'assets', path.basename(relative)),
    path.resolve(cardRoot, path.basename(relative)),
    path.resolve(cardRoot, relative)
  ];
  for (const file of candidates) {
    if (!allowedRoots.some(dir => isInside(file, dir))) continue;
    try {
      if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
    } catch {
      continue;
    }
  }
  return null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = http.createServer((req, res) => {
    const file = locate(req.url || '/');
    if (!file) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(4177, '127.0.0.1', () => console.log('Azure Archive http://127.0.0.1:4177'));
}
