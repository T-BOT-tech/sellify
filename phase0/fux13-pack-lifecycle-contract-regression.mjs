import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../app/src/experience/pack-activation-contract.js', import.meta.url), 'utf8');
assert.match(source, /PACK_LIFECYCLE_RECORD_CONTRACT_VERSION/);
for (const field of [
  'organization_id', 'pack_id', 'pack_version', 'state',
  'installed_at', 'activated_at', 'deactivated_at',
  'created_by_user_id', 'updated_by_user_id',
  'created_at', 'updated_at', 'version',
]) assert.match(source, new RegExp(field));
assert.match(source, /organization_id \+ pack_id/);
assert.match(source, /organizationScoped: true/);
assert.match(source, /implementationStatus: 'PERSISTENCE_AND_TRANSACTION_SERVICE'/);
assert.match(source, /persistenceAuthority: 'backend\/lib\/store-sqlite\.js#pack_lifecycle'/);
assert.match(source, /mutationAuthority: 'backend\/lib\/store-sqlite\.js#transitionPackLifecycle'/);
assert.match(source, /duplicateAuthority: false/);
assert.match(source, /backend\/lib\/authorization\.js/);
assert.match(source, /audit_events \/ recordAuditEvent/);
assert.match(source, /versioned event boundary \/ sync_events/);
assert.doesNotMatch(source, /CREATE TABLE/i);
assert.doesNotMatch(source, /fetch\([^)]*(activate|deactivate|install|upgrade)/i);

console.log('FUX-13 Pack Lifecycle Record Contract regression: PASS');
