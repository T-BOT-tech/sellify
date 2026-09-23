import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
assert.match(source, /version, applied_at.*40|VALUES \(40, nowIso\(\)\)/s);
assert.match(source, /CREATE TABLE IF NOT EXISTS pack_lifecycle/);
assert.match(source, /UNIQUE\(organization_id, pack_id\)/);
assert.match(source, /REFERENCES organizations\(id\) ON DELETE CASCADE/);
assert.match(source, /getPackLifecycle\(organizationId, packId\)/);
assert.match(source, /idx_pack_lifecycle_org_state/);
assert.match(source, /idx_pack_lifecycle_pack/);
for (const state of [
  'NOT_INSTALLED','INSTALLED','ELIGIBILITY_UNKNOWN','ELIGIBLE','DEPENDENCY_BLOCKED',
  'ACTIVATION_AUTHORIZATION_REQUIRED','ACTIVE','DEACTIVATION_AUTHORIZATION_REQUIRED',
  'DEACTIVATED','UPGRADE_AVAILABLE','UPGRADE_AUTHORIZATION_REQUIRED','UPGRADE_BLOCKED',
  'RECOVERY_REQUIRED','UNKNOWN',
]) assert.match(source, new RegExp(`'${state}'`));
assert.doesNotMatch(source, /function\s+(install|activate|deactivate|upgrade)Pack/i);
console.log('FUX-13.2 Pack Lifecycle Persistence regression: PASS');
