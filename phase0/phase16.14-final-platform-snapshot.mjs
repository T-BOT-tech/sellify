import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const required = [
  'phase0/PHASE16.12-PLATFORM-REGRESSION.md',
  'phase0/phase16.12-platform-regression.mjs',
  'phase0/PHASE16.13-NODE24-CERTIFICATION.md',
  'phase0/phase16.13-node24-certification.mjs',
  'phase0/PHASE16.14-FINAL-PLATFORM-SNAPSHOT.md',
  'phase0/phase16.14-final-platform-snapshot.mjs',
  'SELLIFY_AI_HANDOFF.md',
  'package.json',
  'backend/package.json',
];
for (const rel of required) assert(exists(rel), `Missing Phase 16.14 artifact: ${rel}`);

const pkg = readJson('package.json');
const backendPkg = readJson('backend/package.json');
assert.equal(pkg.engines?.node, '>=24', 'Root Node engine requirement changed');
assert.equal(backendPkg.engines?.node, '>=24', 'Backend Node engine requirement changed');
assert.equal(pkg.scripts?.['test:phase16.13'], 'node phase0/phase16.13-node24-certification.mjs', 'Phase 16.13 command changed');

const major = Number(process.versions.node.split('.')[0]);
console.log(`Phase 16.14 runtime observed: ${process.version}`);
console.log('Final snapshot structure: PASS');
console.log('Root/backend Node >=24 requirement: PASS');
console.log('Phase 16.13 certification gate remains wired: PASS');

const certification = spawnSync(process.execPath, ['phase0/phase16.13-node24-certification.mjs'], {
  cwd: ROOT,
  stdio: 'inherit',
});

if (certification.status === 0 && major >= 24) {
  console.log('Phase 16.13 Node >=24 certification: PASS');
  console.log('Phase 16.14 Final Platform Snapshot: CERTIFICATION-READY');
} else {
  console.error('Phase 16.14 Final Platform Snapshot: PREPARED / NOT CERTIFIED');
  console.error(`Phase 16.13 certification remains blocked (runtime ${process.version}).`);
  process.exitCode = 2;
}
