import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

const contextSource = read('backend/lib/security-context.js');
const authSource = read('backend/lib/authorization.js');
const serverSource = read('backend/server.js');
const tenantSource = read('backend/lib/tenant-isolation.js');
const auditSource = read('app/src/audit/audit-boundary.js');

assert.ok(exists('phase0/PHASE13.12.1-AUTHORIZATION-AUTHORITY-INVENTORY.md'));
assert.match(contextSource, /buildSecurityContext\(session/);
assert.match(contextSource, /validateSecurityContext\(context/);
assert.match(contextSource, /securityContextContract\(\)/);

for (const field of ['actorId', 'sessionId', 'deviceId', 'role', 'chatId', 'organizationId', 'locationId', 'requestId', 'correlationId', 'causationId', 'eventId', 'idempotencyKey', 'externalSystem', 'externalObjectId']) {
  assert.match(contextSource, new RegExp(`['"]?${field}['"]?`), `${field} missing from security context contract`);
}

const { buildSecurityContext, validateSecurityContext, securityContextContract } = await import('../backend/lib/security-context.js');
const session = {
  userId: 'user-1', sessionId: 'session-1', deviceId: 'device-1', role: 'manager',
  chatId: 'chat-1', organizationId: 'org-1', locationId: 'loc-1',
};
const context = buildSecurityContext(session, {
  requestId: 'req-1', correlationId: 'corr-1', causationId: 'cause-1',
  eventId: 'event-1', idempotencyKey: 'idem-1', externalSystem: 'provider-x', externalObjectId: 'obj-1',
});
assert.equal(validateSecurityContext(context), true);
assert.equal(validateSecurityContext(context, { requireLocation: true }), true);
assert.equal(context.actorId, 'user-1');
assert.equal(context.organizationId, 'org-1');
assert.equal(context.locationId, 'loc-1');
assert.equal(context.correlationId, 'corr-1');
assert.equal(Object.isFrozen(context), true);
assert.equal(validateSecurityContext({ ...context, actorId: null }), false);
assert.equal(validateSecurityContext({ ...context, organizationId: null }), false);
assert.equal(validateSecurityContext({ ...context, locationId: null }, { requireLocation: true }), false);

const contract = securityContextContract();
assert.equal(contract.identity_authority.includes('sessions'), true);
assert.equal(contract.authorization_authority.includes('authorize('), true);
assert.equal(contract.persistence, 'none');
assert.equal(contract.evaluator, 'none');
assert.equal(contract.duplicate_authorization_authority, false);
assert.equal(contract.duplicate_audit_authority, false);

// The contract must not silently replace the existing authority boundaries.
assert.match(authSource, /export function authorize\(actor, organization, location, resource, action\)/);
assert.match(serverSource, /authorize\(session, organization, location, resource, action\)/);
assert.match(serverSource, /assertTenantScope\(session, tenant\)/);
assert.match(tenantSource, /existing sessions \+ memberships \+ devices/);
assert.match(auditSource, /existing backend audit_events \/ recordAuditEvent\(\)/);

// No persistence, role store, permission store, evaluator, or database is introduced here.
assert.doesNotMatch(contextSource, /CREATE TABLE|INSERT INTO|UPDATE .*permission|ROLE_PERMISSIONS|function\s+authorize\s*\(/is);

console.log('Phase 13.12.2 Security Context Contract Regression: PASS');
console.log('Canonical Phase 10.3 authorization authority preserved: PASS');
console.log('Existing session / membership / device identity authority preserved: PASS');
console.log('Organization / location scope preserved: PASS');
console.log('Security + observability context contract validated: PASS');
console.log('No duplicate authorization / identity / audit persistence: BLOCKED');
