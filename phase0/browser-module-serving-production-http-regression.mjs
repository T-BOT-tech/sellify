import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const HOST = '127.0.0.1';

async function reservePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, HOST, resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + 15_000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`production server exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(baseUrl);
      if (response.status === 200) return;
      lastError = new Error(`server returned HTTP ${response.status} during startup`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`production server did not become ready: ${lastError?.message || 'timeout'}`);
}

const port = await reservePort();
const dataDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-module-http-'));
const baseUrl = `http://${HOST}:${port}`;
const child = spawn(process.execPath, ['backend/server.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    HOST,
    PORT: String(port),
    NODE_ENV: 'test',
    CORS_ALLOWED_ORIGINS: baseUrl,
    SELLIFY_DATA_DIR: dataDir,
    SELLIFY_DB_PATH: path.join(dataDir, 'test.sqlite'),
    SELLIFY_BACKUP_DIR: path.join(dataDir, 'backups'),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stdout = '';
let stderr = '';
child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');
child.stdout.on('data', chunk => { stdout += chunk; });
child.stderr.on('data', chunk => { stderr += chunk; });

try {
  await waitForServer(baseUrl, child);

  const home = await fetch(baseUrl);
  assert.equal(home.status, 200, 'production server serves the PWA root');
  assert.match(home.headers.get('content-type') || '', /^text\/html\b/i);
  assert.match(await home.text(), /<html\b/i);

  for (const [url, label] of [
    ['/backend/lib/authorization.js', 'allowlisted backend policy module'],
    ['/shared/vertical-pack-manifests.js', 'allowlisted shared manifest'],
  ]) {
    const response = await fetch(baseUrl + url);
    assert.equal(response.status, 200, `${label} is served`);
    assert.match(response.headers.get('content-type') || '', /^application\/javascript\b/i);
    assert.match(response.headers.get('x-content-type-options') || '', /nosniff/i);
    assert.ok((await response.text()).length > 0, `${label} has a body`);
  }

  for (const pathname of [
    '/backend/lib/store-sqlite.js',
    '/backend/server.js',
    '/backend/lib/%2e%2e/server.js',
    '/backend/lib/%E0%A4%A',
    '/shared/not-allowlisted.js',
    '/..%2fbackend/server.js',
    '/backend/test.sqlite',
  ]) {
    const response = await fetch(baseUrl + pathname);
    assert.notEqual(response.status, 200, `sensitive or invalid path is not served: ${pathname}`);
    assert.ok(!/^application\/javascript\b/i.test(response.headers.get('content-type') || ''),
      `rejected path is not returned as JavaScript: ${pathname}`);
  }

  const config = await fetch(baseUrl + '/config.js');
  assert.equal(config.status, 200, 'existing generated config route remains available');
  assert.match(config.headers.get('content-type') || '', /javascript/i);

  console.log('Production server browser module HTTP regression: PASS');
} catch (error) {
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  throw error;
} finally {
  child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 2_000)),
  ]);
  await rm(dataDir, { recursive: true, force: true });
}
