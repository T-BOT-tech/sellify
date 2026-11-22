import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const ci = fs.readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const store = fs.readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
const backup = fs.readFileSync(new URL('../backend/backup.js', import.meta.url), 'utf8');
const lifecycle = fs.readFileSync(new URL('../phase0/gap-2-delivery-assignment-lifecycle-regression.mjs', import.meta.url), 'utf8');

assert.equal(pkg.engines?.node, '>=24', 'Node 24 runtime floor required');
const requiredScripts = [
  'test:gap-2-logistics-authz','test:gap-2-delivery-assignment','test:gap-2-delivery-lifecycle',
  'test:gap-2-delivery-exception','test:gap-2-dispatch-workload','test:gap-2-delivery-frontend',
  'test:gap-2-delivery-certification','test:gap-2-route-dispatch-scope',
  'test:gap-2-cross-feature-consistency','test:gap-2-adversarial-delivery'
];
for (const script of requiredScripts) assert.equal(typeof pkg.scripts?.[script], 'string', 'missing ' + script);
assert.match(ci, /node-version: \[24\]/);
const deliveryLifecycleCiAliases = ['test:gap-2-delivery-lifecycle', 'test:gap-2-delivery-exception'];
for (const script of requiredScripts.filter(script =>
  !deliveryLifecycleCiAliases.includes(script) && script !== 'test:gap-2-delivery-assignment')) {
  assert.ok(ci.includes('npm run ' + script), 'CI missing ' + script);
}
assert.ok(deliveryLifecycleCiAliases.some(script => ci.includes('npm run ' + script)),
  'CI must execute the shared delivery lifecycle/exception regression through one supported alias');

const logisticsJobStart = ci.search(/^  logistics_l18:\s*$/m);
assert.ok(logisticsJobStart >= 0, 'Dedicated logistics_l18 CI job missing');
const afterLogisticsJob = ci.slice(logisticsJobStart);
const nextJob = afterLogisticsJob.slice(1).search(/^  [A-Za-z0-9_]+:\s*$/m);
const logisticsJob = afterLogisticsJob.slice(0, nextJob >= 0 ? nextJob + 1 : undefined);
const directAssignmentCommand = 'node phase0/gap-2-delivery-assignment-authority-regression.mjs';
assert.ok(logisticsJob.includes(directAssignmentCommand),
  'Canonical delivery-assignment regression must run in logistics_l18');
assert.equal((logisticsJob.match(/node phase0\/gap-2-delivery-assignment-authority-regression\.mjs/g) || []).length, 1,
  'Canonical delivery-assignment regression must run exactly once in logistics_l18');

const migrations = [...store.matchAll(/if \(!applied\.includes\((\d+)\)\)/g)].map(m => Number(m[1]));
assert.equal(Math.max(...migrations), 84, 'latest migration must remain explicit');
for (const version of [45, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84]) {
  assert.ok(migrations.includes(version), 'missing explicit migration ' + version);
}
const migrationPosition = version => store.indexOf(`if (!applied.includes(${version}))`);
assert.ok(migrationPosition(45) >= 0, 'payment_evidence creation migration must remain explicit');
for (const version of [61, 62, 63, 64, 65, 66]) {
  assert.ok(migrationPosition(version) > migrationPosition(45),
    'payment evidence dependent migration ' + version + ' must follow payment_evidence creation');
}
for (const version of [69, 70, 71, 72, 73, 74, 75]) {
  assert.ok(migrationPosition(version) >= 0, 'missing explicit logistics lifecycle migration ' + version);
}
assert.ok(migrationPosition(69) > migrationPosition(68), 'fulfillment command fingerprint migration must follow migration 68');
assert.ok(migrationPosition(70) > migrationPosition(69), 'durable fulfillment command migration must follow migration 69');
assert.ok(migrationPosition(71) > migrationPosition(70), 'durable delivery assignment command migration must follow migration 70');
assert.ok(migrationPosition(72) > migrationPosition(71), 'durable service assessment command migration must follow migration 71');
assert.ok(migrationPosition(73) > migrationPosition(72), 'service booking persistence migration must follow migration 72');
assert.ok(migrationPosition(74) > migrationPosition(73), 'service execution evidence migration must follow migration 73');
assert.ok(migrationPosition(75) > migrationPosition(74), 'service booking status-reason migration must follow migration 74');
assert.ok(migrationPosition(76) > migrationPosition(75), 'tenant business-template persistence migration must follow migration 75');
assert.ok(migrationPosition(77) > migrationPosition(76), 'tenant creation replay persistence migration must follow business-template persistence');
assert.ok(migrationPosition(78) > migrationPosition(77), 'service resource foundation migration must follow tenant creation replay persistence');
assert.ok(migrationPosition(79) > migrationPosition(78), 'service availability migration must follow service resource foundation migration');
assert.ok(migrationPosition(80) > migrationPosition(79), 'service resource commitment migration must follow service availability migration');
assert.ok(migrationPosition(81) > migrationPosition(80), 'service resource compatibility bridge must follow migration 80');
assert.ok(migrationPosition(82) > migrationPosition(81), 'location timezone migration must follow service resource compatibility bridge');
assert.ok(migrationPosition(83) > migrationPosition(82), 'Restaurant Recipe persistence migration must follow location timezone migration');
assert.ok(migrationPosition(84) > migrationPosition(83), 'capacity observation metadata migration must follow Restaurant Recipe persistence migration');
assert.match(store, /if \(!applied\.includes\(77\)\)[\s\S]*?CREATE TABLE IF NOT EXISTS tenant_creation_requests[\s\S]*?challenge_token_hash TEXT PRIMARY KEY REFERENCES auth_challenges\(token_hash\)[\s\S]*?request_fingerprint TEXT NOT NULL[\s\S]*?result_json TEXT NOT NULL/,
  'tenant creation idempotency must durably bind a one-time challenge to its original request and result');
assert.match(store, /CREATE TABLE IF NOT EXISTS tenant_business_templates/);
assert.match(store, /PRAGMA foreign_keys = ON/);
assert.match(store, /PRAGMA journal_mode = WAL/);
assert.match(store, /CREATE TABLE IF NOT EXISTS schema_migrations/);
assert.match(store, /INSERT INTO schema_migrations/);
assert.match(store, /export async function createDatabaseBackup/);
assert.match(store, /VACUUM INTO/);
assert.match(store, /SELLIFY_BACKUP_RETENTION/);
assert.match(backup, /createDatabaseBackup/);
assert.match(store, /BEGIN IMMEDIATE/);
assert.match(store, /ROLLBACK/);

console.log('GAP-2.12 Production Readiness Regression: PASS');
console.log('Node 24 runtime floor and GAP-2 CI coverage: PASS');
console.log('Schema migration authority and latest migration continuity: PASS');
console.log('SQLite foreign-key and WAL runtime configuration: PASS');
console.log('Live backup/VACUUM INTO and retention contract: PASS');
console.log('Transactional rollback boundary: PASS');
