// Phase 13.12.0 — Security Gate Baseline / Re-lock regression.
// Control-only: proves the approved Phase 13.11 security foundations are present
// before Phase 13.12 enforcement work begins. It must not introduce a new auth,
// configuration, or event authority.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = relative => fs.readFileSync(new URL(relative, root), 'utf8');
const exists = relative => fs.existsSync(new URL(relative, root));

const authz = read('backend/lib/authorization.js');
const tenant = read('backend/lib/tenant-isolation.js');
const server = read('backend/server.js');
const audit = read('app/src/audit/audit-boundary.js');
const handoff = read('SELLIFY_AI_HANDOFF.md');
const snapshot = read('phase0/PHASE13.11.21-SNAPSHOT-EXIT.md');

assert.match(authz, /export function authorize\(actor, organization, location, resource, action\)/);
assert.match(authz, /ALLOW/);
assert.match(authz, /DENY/);
assert.match(authz, /REQUIRES_APPROVAL/);
assert.match(authz, /ROLE_PERMISSIONS/);
assert.match(tenant, /tenantScopeDecision/);
assert.match(tenant, /assertTenantScope/);
assert.match(tenant, /assertLocationScope/);
assert.match(server, /requireAuthorization/);
assert.match(server, /recordAuditEvent/);
assert.match(audit, /audit_events/);
assert.match(handoff, /Phase 13\.11 status: COMPLETE \/ EXITED/);
assert.match(handoff, /Phase 13\.11\.21/);
assert.match(snapshot, /Phase 13\.11\.21 Snapshot \/ Exit/);

// Phase-boundary locks: these responsibilities must not be pulled forward.
const allSource = [authz, tenant, server, audit].join('\n');
assert.doesNotMatch(allSource, /CREATE TABLE[^\n]*(authorization|permission|role)/i);
assert.doesNotMatch(allSource, /CREATE TABLE[^\n]*(pack[_ -]?config|configuration)/i);
assert.doesNotMatch(allSource, /CREATE TABLE[^\n]*(event[_ -]?store|event[_ -]?broker)/i);
assert.equal(exists('app/src/verticals/agriculture/config-authority.js'), false);
assert.equal(exists('app/src/verticals/restaurant/config-authority.js'), false);
assert.equal(exists('app/src/verticals/warehouse/config-authority.js'), false);
assert.equal(exists('app/src/verticals/logistics/config-authority.js'), false);

console.log('Phase 13.12.0 Security Gate Baseline / Re-lock: PASS');
console.log('Canonical Phase 10.3 authorization authority preserved: PASS');
console.log('Organization / location security boundaries preserved: PASS');
console.log('Existing audit authority preserved: PASS');
console.log('Phase 13.11.21 exit continuity preserved: PASS');
console.log('Phase 13.13 configuration scope not pulled forward: PASS');
console.log('Phase 13.14 event/outbox scope not pulled forward: PASS');
console.log('No duplicate authorization persistence authority: BLOCKED');
