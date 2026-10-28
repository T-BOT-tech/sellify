import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

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
  const deadline = Date.now() + 10_000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`dev server exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(baseUrl);
      if (response.status === 200) return;
      lastError = new Error(`server returned HTTP ${response.status} during startup`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`dev server did not become ready: ${lastError?.message || 'timeout'}`);
}

const port = await reservePort();
const baseUrl = `http://${HOST}:${port}`;
const child = spawn(process.execPath, ['app/dev-server.mjs'], {
  cwd: process.cwd(),
  env: { ...process.env, HOST, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stderr = '';
child.stderr.setEncoding('utf8');
child.stderr.on('data', chunk => { stderr += chunk; });

try {
  await waitForServer(baseUrl, child);

  const home = await fetch(baseUrl);
  assert.equal(home.status, 200, 'app root is served');
  assert.match(home.headers.get('content-type') || '', /^text\/html\b/i);
  assert.match(await home.text(), /<html\b/i);

  const allowed = await fetch(`${baseUrl}/backend/lib/authorization.js`);
  assert.equal(allowed.status, 200, 'allowlisted browser-safe backend module is served');
  assert.match(allowed.headers.get('content-type') || '', /^application\/javascript\b/i);
  assert.match(allowed.headers.get('x-content-type-options') || '', /nosniff/i);
  assert.match(await allowed.text(), /export|function|const|class/);

  const shared = await fetch(`${baseUrl}/shared/vertical-pack-manifests.js`);
  assert.equal(shared.status, 200, 'allowlisted shared manifest is served');
  assert.match(shared.headers.get('content-type') || '', /^application\/javascript\b/i);

  for (const pathname of [
    '/backend/lib/store-sqlite.js',
    '/backend/server.js',
    '/backend/lib/%2e%2e/server.js',
    '/backend/lib/%E0%A4%A',
    '/shared/not-allowlisted.js',
    '/..%2fbackend/server.js',
    '/backend/store.sqlite',
  ]) {
    const response = await fetch(`${baseUrl}${pathname}`);
    assert.notEqual(response.status, 200, `sensitive or invalid path is not served: ${pathname}`);
    assert.ok(!/^application\/javascript\b/i.test(response.headers.get('content-type') || ''),
      `rejected path is not returned as JavaScript: ${pathname}`);
  }

  const head = await fetch(`${baseUrl}/backend/lib/authorization.js`, { method: 'HEAD' });
  assert.equal(head.status, 200, 'HEAD supports allowlisted module checks');
  assert.equal((await head.text()).length, 0, 'HEAD response has no body');

  const post = await fetch(baseUrl, { method: 'POST', body: 'unexpected' });
  assert.equal(post.status, 405, 'unsupported methods are rejected');

  console.log('Browser module serving HTTP regression: PASS');
} catch (error) {
  if (stderr) process.stderr.write(stderr);
  throw error;
} finally {
  child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 2_000)),
  ]);
}
