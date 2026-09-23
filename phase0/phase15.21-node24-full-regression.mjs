import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const required = [
  'phase0/PHASE15.20-CROSS-COUNTRY-REGRESSION-GATE.md',
  'phase0/phase15.20-cross-country-regression-gate.mjs',
  'phase0/PHASE15.20-SOURCE-HASHES.sha256',
  'SELLIFY_AI_HANDOFF.md',
  'package.json',
];
for (const rel of required) assert(fs.existsSync(path.join(root, rel)), `Missing Node >=24 gate artifact: ${rel}`);
assert.equal(pkg.engines?.node, '>=24', 'Node >=24 requirement changed');

const major = Number(process.versions.node.split('.')[0]);
assert.equal(pkg.scripts?.['test:phase15.20'], 'node phase0/phase15.20-cross-country-regression-gate.mjs', 'Phase 15.20 gate command changed');

console.log(`Phase 15.21 runtime: ${process.version}`);
console.log('package.json Node engine >=24: PASS');

const preflight = spawnSync(process.execPath, ['phase0/phase15.20-cross-country-regression-gate.mjs'], { stdio: 'inherit' });
if (preflight.status !== 0) throw new Error(`Phase 15.20 compatibility preflight failed with status ${preflight.status}`);
console.log('Phase 15.20 compatibility preflight: PASS');

if (major < 24) {
  console.error(`Phase 15.21 Node >=24 Full Regression: BLOCKED (runtime is ${process.version})`);
  console.error('A real Node >=24 runtime is required for certification. No Node 22 result is promoted to Node >=24 certification.');
  process.exitCode = 2;
} else {
  console.log(`Phase 15.21 Node >=24 Full Regression: PASS (${process.version})`);
}
