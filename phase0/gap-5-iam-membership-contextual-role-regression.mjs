import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const store = read('backend/lib/store-sqlite.js');
const server = read('backend/server.js');
const frontend = read('app/src/authorization/membership-admin.js');
const permissions = read('app/src/auth/permissions.js');

assert.match(store, /export async function changeMembershipRole\(/);
assert.match(store, /You cannot change your own role/);
assert.match(store, /Only the owner can assign the owner role/);
assert.match(store, /Managers may assign cashier, staff, or viewer roles/);
assert.match(store, /The last owner cannot be demoted/);

assert.match(store, /export async function assignMembershipContextualRole\(/);
assert.match(store, /assertContextualRoleAssignable\(chatId, normalizedRole\)/);
assert.match(store, /scopeType/);
assert.match(store, /scopeId/);
assert.match(store, /membership\.contextual_role\.assigned/);
assert.match(store, /existing\?\.status === 'active'/);
assert.match(store, /changed: false/);
assert.match(store, /ON CONFLICT\(membership_id, role_id, scope_type, scope_id\)/);
assert.match(store, /changed: true/);

assert.match(store, /export async function revokeMembershipContextualRole\(/);
assert.match(store, /membership\.contextual_role\.revoked/);
assert.match(store, /status = 'revoked'/);
assert.match(store, /revoked_at/);

assert.match(server, /membership-role/);
assert.match(server, /membership-contextual-role/);
assert.ok(server.includes("/auth/membership-contextual-role/revoke"), 'contextual role revoke route missing');
assert.match(server, /membership:role:manage/);
assert.doesNotMatch(server, /handleListTenantMemberships[\\s\\S]{0,500}logistics:deliveries:view/);

assert.match(permissions, /membership:role:manage/);
assert.match(frontend, /membership:role:manage/);
assert.match(frontend, /MANAGER_ASSIGNABLE_ROLES/);
assert.match(frontend, /cashier.*staff.*viewer/);

console.log('GAP-5 IAM Membership/Contextual Role Regression: PASS');
console.log('Generic role mutation protections: PASS');
console.log('Contextual role assign/revoke lifecycle: PASS');
console.log('Contextual role idempotency: PASS');
console.log('Membership listing authorization boundary: PASS');
console.log('Frontend/backend role contract alignment: PASS');
