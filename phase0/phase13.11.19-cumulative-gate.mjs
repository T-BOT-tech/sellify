import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

const requiredControlArtifacts = [
  'phase0/PHASE13.11.0-CROSS-PACK-BASELINE-RELOCK.md',
  'phase0/PHASE13.11.1-CROSS-PACK-AUTHORITY-MATRIX.md',
  'phase0/PHASE13.11.2-CROSS-PACK-CONTRACT-BOUNDARIES.md',
  'phase0/PHASE13.11.3-PHYSICAL-COMMERCE-SPINE.md',
  'phase0/PHASE13.11.4-WAREHOUSE-INVENTORY-INTEGRATION.md',
  'phase0/PHASE13.11.5-RESTAURANT-COMMERCE-INVENTORY-INTEGRATION.md',
  'phase0/PHASE13.11.6-AGRICULTURE-COMMERCE-INVENTORY-INTEGRATION.md',
  'phase0/PHASE13.11.7-AGRICULTURE-WAREHOUSE-LOGISTICS-INTEGRATION.md',
  'phase0/PHASE13.11.8-RESTAURANT-WAREHOUSE-LOGISTICS-INTEGRATION.md',
  'phase0/PHASE13.11.9-UNIFIED-FULFILLMENT-CONTRACT.md',
  'phase0/PHASE13.11.10-EVENT-BOUNDARY.md',
  'phase0/PHASE13.11.11-IDEMPOTENCY-REPLAY.md',
  'phase0/PHASE13.11.12-FAILURE-ISOLATION.md',
  'phase0/PHASE13.11.13-CANCELLATION-RETURNS.md',
  'phase0/PHASE13.11.14-AUTHORIZATION-TENANT-ISOLATION.md',
  'phase0/PHASE13.11.15-AUDIT-OBSERVABILITY.md',
  'phase0/PHASE13.11.16-ADVERSARIAL-REGRESSION.md',
  'phase0/PHASE13.11.17-ARCHITECTURE-LINT.md',
  'phase0/PHASE13.11.18-INTEGRATION-MATRIX.md',
];
for (const rel of requiredControlArtifacts) assert.ok(exists(rel), `Missing cumulative control artifact: ${rel}`);

const requiredAuthorityAnchors = [
  'app/src/logistics/fulfillment.js',
  'app/src/warehouse/inventory.js',
  'app/src/warehouse/ledger.js',
  'app/src/sync/outbox.js',
  'app/src/events/event-boundary.js',
  'app/src/audit/audit-boundary.js',
  'backend/lib/store-sqlite.js',
  'backend/lib/event-replay.js',
  'backend/lib/event-failure-isolation.js',
  'backend/lib/tenant-isolation.js',
];
for (const rel of requiredAuthorityAnchors) assert.ok(exists(rel), `Missing authority anchor: ${rel}`);

const packageJson = JSON.parse(read('package.json'));
assert.equal(packageJson.engines?.node, '>=24');
assert.equal(packageJson.scripts['test:phase13.11.19'], 'node phase0/phase13.11.19-cumulative-gate.mjs');

// Keep the hub-and-contract architecture explicit at the cumulative boundary.
const forbiddenArtifacts = [
  'app/src/verticals/agriculture/restaurant-contract.js',
  'app/src/verticals/restaurant/agriculture-contract.js',
  'app/src/verticals/agriculture/restaurant-orchestrator.js',
  'app/src/verticals/restaurant/agriculture-orchestrator.js',
  'app/src/verticals/physical-commerce/orchestrator.js',
  'app/src/logistics/route-engine.js',
  'app/src/logistics/dispatch-engine.js',
];
for (const rel of forbiddenArtifacts) assert.equal(exists(rel), false, `Forbidden architecture artifact exists: ${rel}`);

const checks = [
  ['13.11.0 Cross-Pack Baseline', 'test:phase13.11.0'],
  ['13.11.3 Physical Commerce Spine', 'test:phase13.11.3'],
  ['13.11.4 Warehouse ↔ Inventory', 'test:phase13.11.4'],
  ['13.11.5 Restaurant ↔ Commerce/Inventory', 'test:phase13.11.5'],
  ['13.11.6 Agriculture ↔ Commerce/Inventory', 'test:phase13.11.6'],
  ['13.11.7 Agriculture ↔ Warehouse/Logistics', 'test:phase13.11.7'],
  ['13.11.8 Restaurant ↔ Warehouse/Logistics', 'test:phase13.11.8'],
  ['13.11.9 Unified Fulfillment', 'test:phase13.11.9'],
  ['13.11.10 Event Boundary', 'test:phase13.11.10'],
  ['13.11.11 Idempotency / Replay', 'test:phase13.11.11'],
  ['13.11.12 Failure Isolation', 'test:phase13.11.12'],
  ['13.11.13 Cancellation / Returns', 'test:phase13.11.13'],
  ['13.11.14 Authorization / Tenant Isolation', 'test:phase13.11.14'],
  ['13.11.15 Audit / Observability', 'test:phase13.11.15'],
  ['13.11.16 Adversarial Regression', 'test:phase13.11.16'],
  ['13.11.17 Architecture-Lint', 'test:phase13.11.17'],
  ['13.11.18 Integration Matrix', 'test:phase13.11.18'],
  ['13.9.13 Warehouse Cumulative', 'test:phase13.9.13'],
  ['13.10.15 Logistics Cumulative', 'test:phase13.10.15'],
  ['Golden Regression', 'phase0:test'],
];

for (const [label, script] of checks) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.status !== 0) {
    console.error(`Phase 13.11.19 Cumulative Gate: FAIL — ${label}`);
    process.exit(result.status || 1);
  }
  console.log(`Phase 13.11.19 cumulative check: PASS — ${label}`);
}

console.log('Phase 13.11.19 Cumulative Gate: PASS');
console.log(`Observed runtime: ${process.version}`);
console.log('Node >=24 remains the supported release runtime; this environment is regression evidence only unless process.version is >=24.');
console.log('Phase 13.11.0–13.11.18 control artifacts and canonical authority anchors are present.');
console.log('Hub-and-contract topology, no duplicate authority, and no route/dispatch implementation remain locked.');
