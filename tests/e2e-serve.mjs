/**
 * The production shape, locally.
 *
 * Static files served the way Vercel's CDN serves them, and /api/* routed
 * through api/index.js the way Vercel invokes it. Anything that breaks here
 * breaks in production, which is the point — the previous round of bugs was
 * invisible to a test that called createApp() directly.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('../apps/brandora', import.meta.url).pathname;
const fn = (await import('../api/index.js')).default;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
};

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    void fn(req, res);
    return;
  }
  let p = join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
  if (!existsSync(p) || statSync(p).isDirectory()) p = join(ROOT, 'index.html');
  res.setHeader('Content-Type', TYPES[extname(p)] || 'application/octet-stream');
  createReadStream(p).pipe(res);
}).listen(4600, '127.0.0.1', () => console.log('up on 4600'));
