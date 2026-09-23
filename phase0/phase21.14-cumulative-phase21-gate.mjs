import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const phases = [
  ['21.0', 'phase0/phase21.0-baseline-relock-regression.mjs', 20],
  ['21.1', 'phase0/phase21.1-commodity-supply-boundary-regression.mjs', 17],
  ['21.2', 'phase0/phase21.2-supply-capability-regression.mjs', 13],
  ['21.3', 'phase0/phase21.3-capacity-availability-regression.mjs', 15],
  ['21.4', 'phase0/phase21.4-demand-requirement-regression.mjs', 18],
  ['21.5', 'phase0/phase21.5-deterministic-commodity-match-regression.mjs', 13],
  ['21.6', 'phase0/phase21.6-sourcing-opportunity-regression.mjs', 17],
  ['21.7', 'phase0/phase21.7-supply-gap-alternative-sourcing-regression.mjs', 17],
  ['21.8', 'phase0/phase21.8-discovery-ranking-integration-regression.mjs', 15],
  ['21.9', 'phase0/phase21.9-procurement-commerce-handoff-regression.mjs', 19],
  ['21.10', 'phase0/phase21.10-agriculture-supply-integration-regression.mjs', 13],
  ['21.11', 'phase0/phase21.11-cross-border-integration-regression.mjs', 15],
  ['21.12', 'phase0/phase21.12-network-intelligence-control-regression.mjs', 15],
  ['21.13', 'phase0/phase21.13-adversarial-idempotency-regression.mjs', 13],
];

for (const [phase, rel, expectedPasses] of phases) {
  assert.equal(fs.existsSync(path.join(root, rel)), true, `missing Phase ${phase} regression`);
  const run = spawnSync(process.execPath, [rel], { cwd: root, encoding: 'utf8' });
  if (run.status !== 0) {
    console.error(run.stdout);
    console.error(run.stderr);
    throw new Error(`Phase ${phase} regression failed`);
  }
  const combined = `${run.stdout}\n${run.stderr}`;
  const match = combined.match(/(\d+) PASS \/ 0 FAIL/);
  assert.ok(match, `Phase ${phase} did not report a PASS/FAIL result`);
  assert.equal(Number(match[1]), expectedPasses, `Phase ${phase} pass count changed`);
  console.log(`Phase ${phase}: PASS (${expectedPasses})`);
}

// Explicitly verify the previously disputed 21.12 source artifacts are present.
for (const rel of [
  'app/src/phase21-network-intelligence-control.js',
  'phase0/phase21.12-network-intelligence-control-regression.mjs',
  'PHASE21.12_IMPLEMENTATION_HANDOFF.md',
]) assert.equal(fs.existsSync(path.join(root, rel)), true, `missing 21.12 artifact: ${rel}`);

const total = phases.reduce((sum, [, , count]) => sum + count, 0);
assert.equal(total, 220);
console.log(`PHASE 21.14 CUMULATIVE GATE: ${total} PASS / 0 FAIL`);
console.log('Node >=24 certification: DEFERRED_TO_PHASE_21.15');
