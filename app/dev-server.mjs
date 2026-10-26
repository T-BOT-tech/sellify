import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BROWSER_BACKEND_MODULES, BROWSER_SHARED_MODULES } from './browser-backend-modules.mjs';

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.resolve(APP_DIR, '..');
const BACKEND_DIR = path.join(REPO_DIR, 'backend');
const ALLOWED_MODULES = new Set(BROWSER_BACKEND_MODULES);
const ALLOWED_SHARED_MODULES = new Set(BROWSER_SHARED_MODULES);
const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
});

function send(res, status, message) {
  const body = Buffer.from(message);
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': body.length,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function serveBrowserBackendModule(req, res, pathname) {
  let relativePath;
  try { relativePath = decodeURIComponent(pathname.slice('/backend/'.length)); }
  catch { return send(res, 400, 'Bad request'); }

  if (!ALLOWED_MODULES.has(relativePath)) return send(res, 404, 'Not found');
  const filePath = path.resolve(BACKEND_DIR, relativePath);
  const safeRoot = `${path.resolve(BACKEND_DIR, 'lib')}${path.sep}`;
  if (!filePath.startsWith(safeRoot)) return send(res, 404, 'Not found');

  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Content-Length': data.length,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=3600',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    return send(res, 404, 'Not found');
  }
}

async function serveBrowserSharedModule(req, res, pathname) {
  let relativePath;
  try { relativePath = decodeURIComponent(pathname.slice('/shared/'.length)); }
  catch { return send(res, 400, 'Bad request'); }
  if (!ALLOWED_SHARED_MODULES.has(relativePath)) return send(res, 404, 'Not found');
  const safeRoot = `${path.resolve(REPO_DIR, 'shared')}${path.sep}`;
  const filePath = path.resolve(REPO_DIR, 'shared', relativePath);
  if (!filePath.startsWith(safeRoot)) return send(res, 404, 'Not found');
  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Content-Length': data.length,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=3600',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    return send(res, 404, 'Not found');
  }
}

async function serveAppFile(req, res, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname === '/' ? '/index.html' : pathname); }
  catch { return send(res, 400, 'Bad request'); }
  const filePath = path.resolve(APP_DIR, `.${decoded}`);
  if (filePath !== APP_DIR && !filePath.startsWith(`${APP_DIR}${path.sep}`)) {
    return send(res, 403, 'Forbidden');
  }

  let actualPath = filePath;
  try {
    if ((await stat(actualPath)).isDirectory()) actualPath = path.join(actualPath, 'index.html');
    const data = await readFile(actualPath);
    const ext = path.extname(actualPath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Content-Length': data.length,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    return send(res, 404, 'Not found');
  }
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/backend/lib/')) return serveBrowserBackendModule(req, res, url.pathname);
  if (url.pathname.startsWith('/shared/')) return serveBrowserSharedModule(req, res, url.pathname);
  return serveAppFile(req, res, url.pathname);
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
server.listen(port, host, () => {
  console.log(`Sellify frontend dev server listening on http://${host}:${port} (API/backend disabled)`);
});
