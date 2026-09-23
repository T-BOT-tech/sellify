import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const required = [
  'P1-IMPLEMENTATION-22-PACK-CUMULATIVE-CERTIFICATION.md',
  'phase0/p1-22-pack-cumulative-certification.mjs',
  'P1-IMPLEMENTATION-23-NODE24-RUNTIME-RELEASE-GATE.md',
  'phase0/p1-23-node24-runtime-gate.mjs',
  'P1-IMPLEMENTATION-24-P1-FINAL-SNAPSHOT.md',
  'phase0/p1-24-p1-final-snapshot.mjs',
  'package.json',
  'backend/package.json',
];
for (const rel of required) assert(exists(rel), `Missing P1-24 artifact: ${rel}`);

const pkg = readJson('package.json');
const backendPkg = readJson('backend/package.json');
assert.equal(pkg.engines?.node, '>=24', 'Root Node engine requirement changed');
assert.equal(backendPkg.engines?.node, '>=24', 'Backend Node engine requirement changed');
assert.equal(pkg.scripts?.['test:p1-22'], 'node phase0/p1-22-pack-cumulative-certification.mjs', 'P1-22 command changed');
assert.equal(pkg.scripts?.['test:p1-23'], 'node phase0/p1-23-node24-runtime-gate.mjs', 'P1-23 command changed');

console.log(`P1-24 runtime observed: ${process.version}`);
console.log('P1 final snapshot structure: PASS');
console.log('Root/backend Node >=24 requirement: PASS');
console.log('P1-22 cumulative certification command: WIRED');
console.log('P1-23 Node >=24 release gate: WIRED');

const cumulative = spawnSync(process.execPath, ['phase0/p1-22-pack-cumulative-certification.mjs'], {
  cwd: ROOT,
  stdio: 'inherit',
});
assert.equal(cumulative.status, 0, `P1-22 cumulative certification failed with status ${cumulative.status}`);
console.log('P1-22 cumulative certification: PASS');

const runtimeGate = spawnSync(process.execPath, ['phase0/p1-23-node24-runtime-gate.mjs'], {
  cwd: ROOT,
  stdio: 'inherit',
});

if (runtimeGate.status === 0) {
  console.log('P1-23 Node >=24 release gate: PASS');
  console.log('P1-24 FINAL SNAPSHOT: CERTIFICATION-READY');
} else if (runtimeGate.status === 2) {
  console.error('P1-24 FINAL SNAPSHOT: PREPARED / NOT CERTIFIED');
  console.error(`P1-23 remains blocked by runtime ${process.version}.`);
  process.exitCode = 2;
} else {
  console.error(`P1-23 release gate failed unexpectedly with status ${runtimeGate.status}`);
  process.exitCode = runtimeGate.status ?? 1;
}
