import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BROWSER_BACKEND_MODULES, BROWSER_SHARED_MODULES } from '../app/browser-backend-modules.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'app/index.html'), 'utf8');
const backendServer = fs.readFileSync(path.join(ROOT, 'backend/server.js'), 'utf8');
const devServer = fs.readFileSync(path.join(ROOT, 'app/dev-server.mjs'), 'utf8');
const bridge = fs.readFileSync(path.join(ROOT, 'app/src/window-bridge.js'), 'utf8');
const main = fs.readFileSync(path.join(ROOT, 'app/src/main.js'), 'utf8');
const creditTerms = fs.readFileSync(path.join(ROOT, 'app/src/b2b/credit-terms.js'), 'utf8');
const backendAllowlist = new Set(BROWSER_BACKEND_MODULES);
const sharedAllowlist = new Set(BROWSER_SHARED_MODULES);

assert.equal(new Set(BROWSER_BACKEND_MODULES).size, BROWSER_BACKEND_MODULES.length, 'backend allowlist has no duplicates');
assert.equal(new Set(BROWSER_SHARED_MODULES).size, BROWSER_SHARED_MODULES.length, 'shared allowlist has no duplicates');
assert.deepEqual(BROWSER_SHARED_MODULES, ['vertical-pack-manifests.js'], 'only the browser-required declarative shared manifest is served');
assert.ok(!BROWSER_BACKEND_MODULES.some(file => /(?:server\.js|store-sqlite|\.db$|\.sqlite$)/i.test(file)), 'server implementation and persistent data are never allowlisted');

function fileForBrowserUrl(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  if (clean.startsWith('/backend/lib/')) return path.join(ROOT, 'backend', clean.slice('/backend/'.length));
  if (clean.startsWith('/shared/')) return path.join(ROOT, 'shared', clean.slice('/shared/'.length));
  if (clean.startsWith('/src/')) return path.join(ROOT, 'app', clean.slice(1));
  if (clean.startsWith('/')) return path.join(ROOT, 'app', clean.slice(1));
  throw new Error(`Unsupported browser module URL: ${urlPath}`);
}

function importsFrom(source) {
  const specs = [];
  const expression = /^\s*(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/gm;
  for (const match of source.matchAll(expression)) specs.push(match[1]);
  return specs;
}

const entryMatches = [...indexHtml.matchAll(/<script\b(?=[^>]*\btype=["']module["'])[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)];
assert.ok(entryMatches.length > 0, 'index.html has module entrypoints');
const pending = entryMatches.map(match => new URL(match[1], 'http://sellify.test/').pathname);
const visited = new Set();
const backendRequests = new Set();
const sharedRequests = new Set();
while (pending.length) {
  const urlPath = pending.pop();
  if (visited.has(urlPath)) continue;
  visited.add(urlPath);
  const filePath = fileForBrowserUrl(urlPath);
  assert.ok(fs.existsSync(filePath), `browser module exists: ${urlPath} -> ${path.relative(ROOT, filePath)}`);
  const source = fs.readFileSync(filePath, 'utf8');
  for (const specifier of importsFrom(source)) {
    if (/^(?:[a-z]+:)?\/\//i.test(specifier) || specifier.startsWith('node:')) continue;
    const childPath = new URL(specifier, `http://sellify.test${urlPath}`).pathname;
    if (childPath.startsWith('/backend/lib/')) {
      const relative = childPath.slice('/backend/'.length);
      assert.ok(backendAllowlist.has(relative), `backend browser import is explicitly allowlisted: ${childPath}`);
      backendRequests.add(relative);
    } else if (childPath.startsWith('/shared/')) {
      const relative = childPath.slice('/shared/'.length);
      assert.ok(sharedAllowlist.has(relative), `shared browser import is explicitly allowlisted: ${childPath}`);
      sharedRequests.add(relative);
    }
    pending.push(childPath);
  }
}

for (const file of backendRequests) {
  const source = fs.readFileSync(path.join(ROOT, 'backend', file), 'utf8');
  assert.doesNotMatch(source, /(?:from\s*|import\s*\()\s*['"](?:node:|fs['"]|path['"]|sqlite['"]|crypto['"]|http['"])/, `${file} has no Node-only import`);
}
assert.ok(backendRequests.size > 0, 'bootstrap graph exercises shared backend modules');
assert.ok(sharedRequests.has('vertical-pack-manifests.js'), 'bootstrap graph reaches the shared vertical manifest');

assert.match(backendServer, /BROWSER_BACKEND_MODULES\.includes\(relativePath\)/, 'backend route checks exact module allowlist membership');
assert.match(backendServer, /BROWSER_SHARED_MODULES\.includes\(relativePath\)/, 'backend shared route checks exact module allowlist membership');
assert.match(backendServer, /path\.normalize\(path\.join\(STATIC_DIR, decoded\)\)/, 'general static serving remains rooted and traversal-guarded');
assert.match(devServer, /ALLOWED_MODULES\.has\(relativePath\)/, 'frontend-only server checks backend allowlist membership');
assert.match(devServer, /ALLOWED_SHARED_MODULES\.has\(relativePath\)/, 'frontend-only server checks shared allowlist membership');
assert.match(bridge, /refreshDeliveryAssignments, transitionDeliveryAssignmentForOrder/, 'bridge imports logistics exports');
assert.match(bridge.slice(bridge.indexOf('Object.assign(window')), /refreshDeliveryAssignments, transitionDeliveryAssignmentForOrder/, 'bridge assigns logistics exports to window');
assert.match(main, /refreshDeliveryAssignments, transitionDeliveryAssignmentForOrder/, 'main re-exports logistics functions');
assert.match(creditTerms, /setTimeout\(\(\) => \{ loadBusinessCreditCustomers\(\)\.catch\(\(\) => \{\}\); \}, 0\)/, 'optional initial credit read waits until state initialization completes');

console.log('Browser module serving regression: PASS');
console.log(`Bootstrap modules: ${visited.size}; allowlisted backend modules reached: ${backendRequests.size}; shared modules reached: ${sharedRequests.size}`);
