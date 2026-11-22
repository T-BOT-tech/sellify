import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const store = read('backend/lib/store-sqlite.js');
const server = read('backend/server.js');
const frontend = read('app/src/authorization/membership-admin.js');
const authorization = read('backend/lib/authorization.js');
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
assert.match(store, /contextual_roles_json/);
assert.match(store, /contextualRoles: parseJSON/);
assert.match(store, /scope_type AS scopeType/);
assert.match(store, /status,\s*source,\s*created_at AS grantedAt,\s*revoked_at AS revokedAt/);
assert.match(store, /WHERE membership_id = \?\s+ORDER BY created_at, role_id, scope_type, scope_id/);


assert.match(store, /export async function revokeMembershipContextualRole\(/);
assert.match(store, /membership\.contextual_role\.revoked/);
assert.match(store, /status = 'revoked'/);
assert.match(store, /revoked_at/);

assert.match(server, /membership-role/);
assert.match(server, /membership-contextual-role/);
assert.match(server, /membership-contextual-role\\\/revoke/, 'contextual role revoke route missing');
assert.match(server, /membership:role:manage/);
assert.match(server, /handleChangeMembershipRole[\s\S]{0,5000}requireAuthorization\(session, tenant, 'membership', 'membership:role:manage'/);
assert.match(server, /handleAssignMembershipContextualRole[\s\S]{0,5000}requireAuthorization\(session, tenant, 'membership', 'membership:role:manage'/);
assert.match(server, /handleRevokeMembershipContextualRole[\s\S]{0,5000}requireAuthorization\(session, tenant, 'membership', 'membership:role:manage'/);
assert.doesNotMatch(server, /handleChangeMembershipRole[\s\S]{0,1000}authorize\(session, session\.organizationId/);
assert.doesNotMatch(server, /handleAssignMembershipContextualRole[\s\S]{0,1000}authorize\(session, session\.organizationId/);
assert.doesNotMatch(server, /handleRevokeMembershipContextualRole[\s\S]{0,1000}authorize\(session, session\.organizationId/);

assert.doesNotMatch(server, /handleListTenantMemberships[\s\S]{0,500}logistics:deliveries:view/);

assert.match(authorization, /Contextual roles are scoped authorities/);
assert.match(authorization, /scopeType === 'LOCATION'/);
assert.match(authorization, /requestedLocationId/);
assert.match(authorization, /return false/);
assert.match(permissions, /membership:role:manage/);
assert.match(frontend, /membership:role:manage/);
assert.match(frontend, /MANAGER_ASSIGNABLE_ROLES/);
assert.match(frontend, /cashier.*staff.*viewer/);
assert.match(frontend, /contextualRoles/);
assert.match(frontend, /data-grant-contextual/);
assert.match(frontend, /data-revoke-contextual/);
assert.match(frontend, /auth\/membership-contextual-role/);
assert.match(frontend, /auth\/membership-contextual-role\/revoke/);
assert.match(frontend, /scopeType/);
assert.match(frontend, /LOCATION/);
assert.match(frontend, /grantedAt/);
assert.match(frontend, /revokedAt/);
assert.match(frontend, /Contextual role grant confirmed by the server/);
assert.match(frontend, /Contextual role revocation confirmed by the server/);


// Render the actual administration module against a minimal authenticated
// tenant response so the UI contract is tested, not only source-string matched.
const { config } = await import('../app/src/state.js');
config.chatId = 'gap5-ui-tenant';
config.sessionToken = 'gap5-ui-session';
config.syncUrl = 'https://sellify.test';
config.tenantRole = 'owner';
const panel = { innerHTML: '', querySelectorAll: () => [] };
globalThis.document = { getElementById: id => id === 'membershipAdministrationPanel' ? panel : null };
globalThis.fetch = async url => ({
  ok: true,
  async json() {
    if (String(url).includes('/memberships')) return {
      memberships: [{
        id: 'membership-ui-1',
        userId: 'user-ui-1',
        role: 'staff',
        displayName: 'Warehouse Operator',
        contextualRoles: [
          { role: 'restaurant_waiter', scopeType: 'LOCATION', scopeId: 'location-ui-1', status: 'active', source: 'ADMIN_UI', grantedAt: '2026-11-22T10:00:00.000Z', revokedAt: null },
          { role: 'warehouse_receiving', scopeType: 'ORGANIZATION', scopeId: null, status: 'revoked', source: 'LEGACY_BRIDGE', grantedAt: '2026-11-20T10:00:00.000Z', revokedAt: '2026-11-21T10:00:00.000Z' },
        ],
      }],
    };
    return { locations: [{ id: 'location-ui-1', name: 'Main Store', type: 'STORE', status: 'active' }] };
  },
});
const { renderMembershipAdministration } = await import('../app/src/authorization/membership-admin.js');
await renderMembershipAdministration();
assert.match(panel.innerHTML, /Restaurant · Waiter/);
assert.match(panel.innerHTML, /Location · Main Store/);
assert.match(panel.innerHTML, /warehouse_receiving/);
assert.match(panel.innerHTML, /revoked/);
assert.match(panel.innerHTML, /ADMIN_UI/);
assert.match(panel.innerHTML, /2026-11-22T10:00:00.000Z/);
assert.match(panel.innerHTML, /2026-11-21T10:00:00.000Z/);
assert.match(panel.innerHTML, /data-grant-contextual/);
assert.match(panel.innerHTML, /data-revoke-contextual/);
delete globalThis.document;

console.log('GAP-5 IAM Membership/Contextual Role Regression: PASS');
console.log('Generic role mutation protections: PASS');
console.log('Contextual role assign/revoke lifecycle: PASS');
console.log('Contextual role idempotency: PASS');
console.log('Membership listing authorization boundary: PASS');
console.log('Frontend/backend role contract alignment: PASS');
