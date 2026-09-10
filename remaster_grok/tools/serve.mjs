import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cardRoot = path.join(root, '..', 'card');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg'
};

function locate(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const name = path.posix.basename(clean);
  const candidates = [
    path.join(root, 'src', clean === '/' ? 'index.html' : clean.slice(1)),
    path.join(root, 'assets', name),
    path.join(cardRoot, name),
    path.join(cardRoot, clean.slice(1))
  ];
  return candidates.find(file => fs.existsSync(file) && fs.statSync(file).isFile());
}

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
server.listen(4177, () => console.log('Azure Archive http://127.0.0.1:4177'));
