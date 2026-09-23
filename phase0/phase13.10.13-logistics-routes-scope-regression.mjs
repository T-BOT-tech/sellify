import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOGISTICS_PACK } from '../app/src/verticals/logistics/pack.js';
import { LOGISTICS_AUTHORITY_MAP } from '../app/src/verticals/logistics/authority-map.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logisticsDir = path.join(root, 'app/src/verticals/logistics');
const migrationFile = path.join(root, 'app/src/storage/migration.js');
const constantsFile = path.join(root, 'app/src/constants.js');
const decisionFile = path.join(root, 'phase0/PHASE13.10.13-ROUTES-SCOPE-DECISION.md');

assert.ok(LOGISTICS_PACK.domain_entities.includes('Route'));
assert.ok(LOGISTICS_PACK.capabilities.includes('logistics-routes'));
assert.deepEqual(LOGISTICS_PACK.routes, []);
assert.equal(LOGISTICS_AUTHORITY_MAP.logistics.route, 'logistics-pack');

const sourceFiles = fs.readdirSync(logisticsDir).filter(name => name.endsWith('.js'));
assert.equal(sourceFiles.some(name => /(^|[-_])route(s)?([-.]|$)/i.test(name)), false,
  'Route implementation module must not be introduced by this non-build step');

const migration = fs.readFileSync(migrationFile, 'utf8');
assert.doesNotMatch(migration, /route/i, 'No Route-specific migration may be introduced');

const constants = fs.readFileSync(constantsFile, 'utf8');
assert.doesNotMatch(constants, /route/i, 'No Route-specific STORAGE_KEYS entry may be introduced');

const decision = fs.readFileSync(decisionFile, 'utf8');
assert.match(decision, /explicit non-build/i);
assert.match(decision, /Canonical Route Contract → Adapter → Provider/);
assert.match(decision, /\*\*Persistence:\*\* none/);
assert.match(decision, /\*\*Migration:\*\* none/);
assert.match(decision, /Route execution is deferred/i);
assert.match(decision, /route optimization/i);

const forbiddenPatterns = [
  /route[-_ ]?(engine|planner|optimizer)/i,
  /maps?[-_ ]?(api|provider|sdk)/i,
  /carrier[-_ ]?route/i,
];
for (const name of sourceFiles) {
  const content = fs.readFileSync(path.join(logisticsDir, name), 'utf8');
  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(content, pattern, `Unexpected Route implementation pattern in ${name}`);
  }
}

console.log('Phase 13.10.13 Logistics Routes Scope Regression: PASS');
