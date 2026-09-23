import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

const auth = read('backend/lib/authorization.js');
const server = read('backend/server.js');
const tenant = read('backend/lib/tenant-isolation.js');
const audit = read('app/src/audit/audit-boundary.js');
const sharedManifest = read('shared/vertical-pack-manifests.js');

assert.match(auth, /export function authorize\(actor, organization, location, resource, action\)/);
assert.match(auth, /ALLOW/);
assert.match(auth, /DENY/);
assert.match(auth, /REQUIRES_APPROVAL/);
for (const role of ['owner', 'manager', 'cashier', 'staff', 'buyer', 'viewer']) {
  assert.match(auth, new RegExp(`['"]${role}['"]`));
}

assert.match(server, /function requireAuthorization\(/);
const protectedCallCount = (server.match(/requireAuthorization\(/g) || []).length;
assert.ok(protectedCallCount >= 20, `expected existing protected authorization calls, found ${protectedCallCount}`);

assert.match(tenant, /organization|tenant/i);
assert.match(audit, /audit_events|audit/i);

const packFiles = [
  'app/src/verticals/agriculture/pack.js',
  'app/src/verticals/restaurant/pack.js',
  'app/src/verticals/warehouse/pack.js',
  'app/src/verticals/logistics/pack.js',
];
for (const file of packFiles) {
  assert.ok(exists(file), `${file} missing`);
  const source = read(file);
  assert.match(sharedManifest, /permissions:\s*Object\.freeze\(\[/, 'shared Pack manifest must expose declarative permission metadata');
  assert.doesNotMatch(source, /ROLE_PERMISSIONS|function\s+authorize\s*\(|CREATE TABLE.*(permission|role|authorization)/is, `${file} must not implement a competing authorization authority`);
}

const verticalFiles = [];
for (const pack of ['agriculture', 'restaurant', 'warehouse', 'logistics']) {
  const dir = path.join(root, 'app/src/verticals', pack);
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith('.js')) verticalFiles.push(path.join(dir, name));
  }
}
for (const file of verticalFiles) {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /CREATE TABLE.*(permission|role|authorization)/is, `${file} declares authorization persistence`);
  assert.doesNotMatch(source, /ROLE_PERMISSIONS|function\s+authorize\s*\(/, `${file} declares a competing authorization engine`);
}

assert.ok(exists('phase0/PHASE13.12.0-SECURITY-GATE-BASELINE.md'));
console.log('Phase 13.12.1 Authorization Authority Inventory Regression: PASS');
console.log(`Existing server authorization calls inventoried: ${protectedCallCount}`);
console.log(`Vertical pack boundaries checked: ${packFiles.length}`);
console.log('Duplicate vertical authorization authority: BLOCKED');
console.log('Phase 10.3 canonical authority preserved: PASS');
