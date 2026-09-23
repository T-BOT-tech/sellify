import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const required = [
  'phase0/PHASE13.12.16-NODE24-FULL-REGRESSION.md',
  'phase0/phase13.12.15-phase13-regression-gate.mjs',
  'phase0/PHASE13.12.15-SOURCE-HASHES.sha256',
  'SELLIFY_AI_HANDOFF.md',
  'package.json',
];
for (const rel of required) assert(fs.existsSync(path.join(root, rel)), `Missing Node >=24 gate artifact: ${rel}`);
assert.equal(pkg.engines?.node, '>=24', 'Node >=24 requirement changed');

const major = Number(process.versions.node.split('.')[0]);
const gate = pkg.scripts?.['test:phase13.12.15'];
assert(gate === 'node phase0/phase13.12.15-phase13-regression-gate.mjs', '13.12.15 gate command changed');

console.log(`Phase 13.12.16 runtime: ${process.version}`);
console.log('package.json Node engine >=24: PASS');

// Compatibility preflight is allowed on Node 22; certification is not.
const preflight = spawnSync(process.execPath, ['phase0/phase13.12.15-phase13-regression-gate.mjs'], { stdio: 'inherit' });
if (preflight.status !== 0) {
  throw new Error(`Phase 13.12.15 compatibility preflight failed with status ${preflight.status}`);
}
console.log('Phase 13.12.0 → 13.12.15 compatibility preflight: PASS');

if (major < 24) {
  console.error(`Phase 13.12.16 Node >=24 Full Regression: BLOCKED (runtime is ${process.version})`);
  console.error('A real Node >=24 runtime is required for certification. No Node 22 result is promoted to Node >=24 certification.');
  process.exitCode = 2;
} else {
  console.log('Phase 13.12.16 Node >=24 Full Regression: PASS');
  console.log(`Certified runtime: ${process.version}`);
}
