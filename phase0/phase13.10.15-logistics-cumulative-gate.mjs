import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const sha256 = (rel) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');

// 13.10.8 is a historical re-lock, not a current-source hash gate. Its
// frozen manifest must remain immutable while later approved phases may evolve
// the locked source (proof-return-contract.js changed in 13.10.10/11).
const baselineManifest = 'phase0/PHASE13.10.8-BASELINE-SOURCE-HASHES.sha256';
const baselineText = read(baselineManifest);
assert.match(baselineText, /^24c09322a838e174a57b7171e1a8394ea9febae8da902de91618bd963246cfd0  app\/src\/verticals\/logistics\/proof-return-contract\.js$/m);
assert.equal(sha256('app/src/verticals/logistics/proof-return-contract.js'), '76baac4451af53ff0121b23ad5409fae1fd08153c7921177d8164159038bce16');
assert.match(read('phase0/PHASE13.10.11-SOURCE-HASHES.sha256'), /^76baac4451af53ff0121b23ad5409fae1fd08153c7921177d8164159038bce16  app\/src\/verticals\/logistics\/proof-return-contract\.js$/m);
assert.match(read('phase0/PHASE13.10.8-BASELINE-RELOCK.md'), /historical|baseline/i);

const requiredProduction = [
  'app/src/verticals/logistics/pack.js',
  'app/src/verticals/logistics/authority-map.js',
  'app/src/verticals/logistics/fulfillment-boundary.js',
  'app/src/verticals/logistics/config-contract.js',
  'app/src/verticals/logistics/shipment-tracking-contract.js',
  'app/src/verticals/logistics/proof-return-contract.js',
  'app/src/verticals/logistics/courier-assignment-contract.js',
  'app/src/logistics/fulfillment.js',
  'app/src/logistics/physical-flow.js',
  'app/src/storage/migration.js',
  'app/src/constants.js',
];
for (const rel of requiredProduction) assert.equal(fs.existsSync(path.join(root, rel)), true, `Missing cumulative source: ${rel}`);

const forbidden = [
  'LogisticsOrder', 'LogisticsInventory', 'LogisticsPayment', 'LogisticsCustomer',
  'LogisticsLocation', 'LogisticsFulfillment', 'LogisticsLedger',
];
for (const rel of requiredProduction) {
  const text = read(rel);
  for (const token of forbidden) {
    const declaration = new RegExp(`(?:export\\s+)?(?:const|let|var|class|function)\\s+${token}\\b`);
    assert(!declaration.test(text), `${rel} declares forbidden parallel authority ${token}`);
  }
}

const checks = [
  ['13.10.7 Logistics Regression Gate', 'test:phase13.10.7'],
  ['13.10.9 Shipment / Tracking', 'test:phase13.10.9'],
  ['13.10.10 Proof Capture', 'test:phase13.10.10'],
  ['13.10.11 Returns Workflow', 'test:phase13.10.11'],
  ['13.10.12 Courier Assignment', 'test:phase13.10.12'],
  ['13.10.13 Routes Scope', 'test:phase13.10.13'],
  ['13.10.14 Cross-Feature Adversarial', 'test:phase13.10.14'],
];

for (const [label, script] of checks) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.status !== 0) {
    console.error(`Phase 13.10.15 Cumulative Gate: FAIL — ${label}`);
    process.exit(result.status || 1);
  }
  console.log(`Phase 13.10.15 cumulative check: PASS — ${label}`);
}

const packageJson = JSON.parse(read('package.json'));
assert.equal(packageJson.engines?.node, '>=24');
assert.equal(packageJson.scripts['test:phase13.10.15'], 'node phase0/phase13.10.15-logistics-cumulative-gate.mjs');

// Routes must remain semantic-only at the cumulative boundary.
// Route manifest metadata is canonicalized in the shared Pack manifest; pack.js
// now consumes that shared authority instead of duplicating manifest fields.
const packManifest = read('shared/vertical-pack-manifests.js');
assert.match(packManifest, /logistics:[\s\S]*routes:\s*Object\.freeze\(\[\]\)/);
assert.equal(fs.existsSync(path.join(root, 'app/src/verticals/logistics/routes.js')), false);
assert.equal(read('app/src/storage/migration.js').includes('route'), false);
assert.equal(read('app/src/constants.js').toLowerCase().includes('route'), false);

console.log('Phase 13.10.15 Logistics Cumulative Gate: PASS');
console.log(`Observed runtime: ${process.version}`);
console.log('Node >=24 remains the supported release runtime; this environment is regression evidence only unless process.version is >=24.');
console.log('Historical Phase 13.10.8 baseline manifest remains preserved; its proof-return hash is intentionally superseded by later approved Phase 13.10.10/11 evolution and is not overwritten.');
