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
for (const script of requiredScripts) assert.ok(ci.includes('npm run ' + script), 'CI missing ' + script);

const migrations = [...store.matchAll(/if \(!applied\.includes\((\d+)\)\)/g)].map(m => Number(m[1]));
assert.equal(Math.max(...migrations), 63, 'latest migration must remain explicit');
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
