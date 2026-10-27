import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const HOST = '127.0.0.1';
const ROOT = process.cwd();

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

async function waitForServer(baseUrl, child, getOutput) {
  const deadline = Date.now() + 20_000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early with code ${child.exitCode}: ${getOutput()}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.status === 200) return;
      lastError = new Error(`server returned HTTP ${response.status} during startup`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 125));
  }
  throw new Error(`server did not become ready: ${lastError?.message || 'timeout'}; ${getOutput()}`);
}

async function smokeServer({ label, command, args, extraEnv = {}, dataDir }) {
  const port = await reservePort();
  const baseUrl = `http://${HOST}:${port}`;
  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    env: {
      ...process.env,
      HOST,
      PORT: String(port),
      NODE_ENV: 'test',
      CORS_ALLOWED_ORIGINS: baseUrl,
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const output = () => `stdout: ${stdout.slice(-3000)}\nstderr: ${stderr.slice(-3000)}`;
  let browser;
  try {
    await waitForServer(baseUrl, child, output);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const pageErrors = [];
    const failedLocalScripts = [];
    const badLocalScriptResponses = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('requestfailed', request => {
      const url = request.url();
      if (url.startsWith(baseUrl) && /\\.(?:m?js)(?:[?#]|$)/i.test(new URL(url).pathname)) {
        failedLocalScripts.push(`${request.method()} ${url}: ${request.failure()?.errorText || 'request failed'}`);
      }
    });
    page.on('response', response => {
      const url = response.url();
      if (url.startsWith(baseUrl) && /\\.(?:m?js)(?:[?#]|$)/i.test(new URL(url).pathname) && response.status() >= 400) {
        badLocalScriptResponses.push(`${response.status()} ${url}`);
      }
    });

    const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    assert.equal(response?.status(), 200, `${label}: browser receives the app document`);
    await page.waitForFunction(() => document.readyState === 'complete', null, { timeout: 10_000 });
    await page.waitForTimeout(1800);

    assert.match(await page.title(), /Sellify|Stall Ledger/i, `${label}: expected application title renders`);
    assert.ok(await page.locator('body').count(), `${label}: body exists`);
    assert.ok(
      await page.locator('script[type="module"]').count() > 0,
      `${label}: module entrypoints are present`,
    );
    assert.deepEqual(failedLocalScripts, [], `${label}: no same-origin JavaScript module request fails`);
    assert.deepEqual(badLocalScriptResponses, [], `${label}: no same-origin JavaScript module request returns HTTP error`);
    assert.deepEqual(pageErrors, [], `${label}: no uncaught browser JavaScript exceptions`);

    console.log(`Browser smoke ${label}: PASS (title="${await page.title()}")`);
  } catch (error) {
    error.message += `\n${label} server output:\n${output()}`;
    throw error;
  } finally {
    await browser?.close().catch(() => {});
    child.kill('SIGTERM');
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 3000)),
    ]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}

const dataDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-browser-smoke-'));
try {
  await smokeServer({
    label: 'development server',
    args: ['app/dev-server.mjs'],
  });
  await smokeServer({
    label: 'production server',
    args: ['backend/server.js'],
    dataDir,
    extraEnv: {
      SELLIFY_DATA_DIR: dataDir,
      SELLIFY_DB_PATH: path.join(dataDir, 'smoke.sqlite'),
      SELLIFY_BACKUP_DIR: path.join(dataDir, 'backups'),
    },
  });
  console.log('Full-app browser smoke regression: PASS');
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
