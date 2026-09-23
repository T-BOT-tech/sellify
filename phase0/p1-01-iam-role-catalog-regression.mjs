import fs from 'node:fs';
import assert from 'node:assert/strict';

const roleFile = fs.readFileSync('app/src/authorization/role-catalog.js', 'utf8');
const settingsFile = fs.readFileSync('app/src/ui/settings.js', 'utf8');
const html = fs.readFileSync('app/index.html', 'utf8');
const policy = fs.readFileSync('backend/lib/authorization.js', 'utf8');

const canonicalRoles = ['owner', 'manager', 'cashier', 'staff', 'buyer', 'viewer'];
for (const role of canonicalRoles) assert.match(policy, new RegExp(`['"]${role}['"]`), `missing canonical role ${role}`);
for (const role of canonicalRoles) assert.match(roleFile, new RegExp(`id: ['"]${role}['"]`), `catalog missing ${role}`);

assert.match(settingsFile, /renderRoleAccessPanel\(\)/);
assert.match(settingsFile, /authorization\/role-catalog\.js/);
assert.match(html, /id="roleAccessPanel"/);

// Target FUX-2 Section 6 families must remain represented as product-model
// metadata, not silently promoted into central server roles.
for (const family of ['Restaurant', 'Retail / POS', 'Warehouse', 'Logistics', 'Agriculture', 'Procurement', 'Supplier Network', 'Marketplace']) {
  assert.match(roleFile, new RegExp(family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}
assert.match(roleFile, /target product model/);
assert.match(roleFile, /does not create a second IAM store or evaluator/);

console.log('P1-01 IAM role catalogue regression: PASS');
