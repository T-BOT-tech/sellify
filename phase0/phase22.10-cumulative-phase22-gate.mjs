import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tests = [
  ['22.1', 'phase0/phase22.1-ai-procurement-constitution-regression.mjs'],
  ['22.2', 'phase0/phase22.2-procurement-intent-regression.mjs'],
  ['22.3', 'phase0/phase22.3-procurement-context-regression.mjs'],
  ['22.4', 'phase0/phase22.4-evidence-supplier-intelligence-regression.mjs'],
  ['22.5', 'phase0/phase22.5-procurement-preparation-regression.mjs'],
  ['22.6', 'phase0/phase22.6-deterministic-result-explanation-regression.mjs'],
  ['22.7', 'phase0/phase22.7-action-proposal-authorization-regression.mjs'],
  ['22.8', 'phase0/phase22.8-procurement-integration-regression.mjs'],
  ['22.9', 'phase0/phase22.9-adversarial-idempotency-regression.mjs'],
];
let pass = 0;
for (const [phase, script] of tests) {
  const r = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, `${phase} failed:\n${r.stdout}\n${r.stderr}`);
  pass++;
  console.log(`PASS ${phase} regression`);
}

const required = [
  'PHASE22.0_BASELINE_RELOCK.md',
  'PHASE22.1_AI_PROCUREMENT_CONSTITUTION.md',
  'PHASE22.2_IMPLEMENTATION_HANDOFF.md',
  'PHASE22.3_IMPLEMENTATION_HANDOFF.md',
  'PHASE22.4_IMPLEMENTATION_HANDOFF.md',
  'PHASE22.5_IMPLEMENTATION_HANDOFF.md',
  'phase0/PHASE22.6_IMPLEMENTATION_HANDOFF.md',
  'PHASE22.7_IMPLEMENTATION_HANDOFF.md',
  'phase0/PHASE22.8_IMPLEMENTATION_HANDOFF.md',
  'PHASE22.9_IMPLEMENTATION_HANDOFF.md',
  'app/src/phase22-procurement-intent.js',
  'app/src/phase22-procurement-context.js',
  'app/src/phase22-evidence-supplier-intelligence.js',
  'app/src/phase22-procurement-preparation.js',
  'app/src/phase22-deterministic-result-explanation.js',
  'app/src/phase22-action-proposal-authorization.js',
  'app/src/phase22-procurement-integration.js',
];
for (const rel of required) {
  assert.equal(fs.existsSync(path.join(root, rel)), true, `missing cumulative artifact: ${rel}`);
  pass++;
  console.log(`PASS artifact ${rel}`);
}

const baseline = fs.readFileSync(path.join(root, 'PHASE22.0_BASELINE_RELOCK.md'), 'utf8');
assert.match(baseline, /No new Phase 22 transaction\/state authority/);
assert.match(baseline, /Node `v22\.16\.0`/);
pass++; console.log('PASS constitutional baseline remains locked');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(pkg.engines?.node, '>=24');
pass++; console.log('PASS runtime requirement remains Node >=24');

console.log(`PHASE 22.10 CUMULATIVE GATE: ${pass} PASS / 0 FAIL`);
console.log('Functional cumulative gate: PASS');
console.log('Node >=24 release certification: BLOCKED (available runtime is Node 22.x)');
console.log('Historical Phase 22.0 hash drift: NOT REWRITTEN; retained as source-of-truth evidence and documented separately.');
