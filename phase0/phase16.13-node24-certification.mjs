import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

const pkg = readJson('package.json');
const backendPkg = readJson('backend/package.json');
const required = [
  'phase0/PHASE16.12-PLATFORM-REGRESSION.md',
  'phase0/phase16.12-platform-regression.mjs',
  'phase0/PHASE16.12-SOURCE-HASHES.sha256',
  'phase0/PHASE16.13-NODE24-CERTIFICATION.md',
  'phase0/phase16.13-node24-certification.mjs',
  'package.json',
  'backend/package.json',
];
for (const rel of required) assert(exists(rel), `Missing Phase 16.13 artifact: ${rel}`);

assert.equal(pkg.engines?.node, '>=24', 'Root Node engine requirement changed');
assert.equal(backendPkg.engines?.node, '>=24', 'Backend Node engine requirement changed');
assert.equal(pkg.scripts?.['test:phase16.12'], 'node phase0/phase16.12-platform-regression.mjs', 'Phase 16.12 command changed');
assert.equal(pkg.scripts?.['test:phase16.13'], 'node phase0/phase16.13-node24-certification.mjs', 'Phase 16.13 command changed');

const major = Number(process.versions.node.split('.')[0]);
console.log(`Phase 16.13 runtime observed: ${process.version}`);
console.log('Root package Node >=24 requirement: PASS');
console.log('Backend package Node >=24 requirement: PASS');

const preflight = spawnSync(process.execPath, ['phase0/phase16.12-platform-regression.mjs'], {
  cwd: ROOT,
  stdio: 'inherit',
});
if (preflight.status !== 0) {
  throw new Error(`Phase 16.12 cumulative regression failed with status ${preflight.status}`);
}
console.log('Phase 16.12 cumulative regression: PASS');

if (major < 24) {
  console.error(`Phase 16.13 Node >=24 Certification: BLOCKED (runtime is ${process.version})`);
  console.error('A real Node >=24 runtime is required. Node 22 compatibility evidence is not promoted to certification.');
  process.exitCode = 2;
} else {
  console.log(`Phase 16.13 Node >=24 Certification: PASS (${process.version})`);
}
