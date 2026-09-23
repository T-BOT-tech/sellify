import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const required = [
  'P1-IMPLEMENTATION-22-PACK-CUMULATIVE-CERTIFICATION.md',
  'P1-IMPLEMENTATION-23-NODE24-RUNTIME-RELEASE-GATE.md',
  'P1-IMPLEMENTATION-24-P1-FINAL-SNAPSHOT.md',
  'P1-IMPLEMENTATION-25-P1-FINAL-RELEASE-EVIDENCE-HANDOFF.md',
  'phase0/p1-22-pack-cumulative-certification.mjs',
  'phase0/p1-23-node24-runtime-gate.mjs',
  'phase0/p1-24-p1-final-snapshot.mjs',
];
for (const rel of required) assert(exists(rel), `Missing handoff evidence: ${rel}`);

const rootPkg = JSON.parse(read('package.json'));
const backendPkg = JSON.parse(read('backend/package.json'));
assert.equal(rootPkg.engines?.node, '>=24');
assert.equal(backendPkg.engines?.node, '>=24');
assert.equal(rootPkg.scripts?.['test:p1-22'], 'node phase0/p1-22-pack-cumulative-certification.mjs');
assert.equal(rootPkg.scripts?.['test:p1-23'], 'node phase0/p1-23-node24-runtime-gate.mjs');
assert.equal(rootPkg.scripts?.['test:p1-24'], 'node phase0/p1-24-p1-final-snapshot.mjs');

const handoff = read('P1-IMPLEMENTATION-25-P1-FINAL-RELEASE-EVIDENCE-HANDOFF.md');
assert.match(handoff, /HANDOFF PACKAGE PREPARED/);
assert.match(handoff, /FINAL RELEASE CERTIFICATION DEFERRED/);
assert.match(handoff, /Node >=24/);
assert.match(handoff, /npm run test:p1-24/);

const cumulative = spawnSync(process.execPath, ['phase0/p1-22-pack-cumulative-certification.mjs'], { cwd: ROOT, encoding: 'utf8' });
assert.equal(cumulative.status, 0, `P1-22 failed:\n${cumulative.stdout}\n${cumulative.stderr}`);

const runtime = spawnSync(process.execPath, ['phase0/p1-23-node24-runtime-gate.mjs'], { cwd: ROOT, encoding: 'utf8' });
console.log(`P1-25 observed runtime: ${process.version}`);
console.log('P1-22 cumulative certification: PASS');
if (runtime.status === 0) {
  console.log('P1-23 Node >=24 runtime gate: PASS');
  console.log('P1-25 FINAL RELEASE EVIDENCE: CERTIFICATION-READY');
} else if (runtime.status === 2) {
  console.log('P1-23 Node >=24 runtime gate: BLOCKED');
  console.log('P1-25 FINAL RELEASE EVIDENCE: HANDOFF-PREPARED / CERTIFICATION-DEFERRED');
  process.exitCode = 2;
} else {
  console.error(`P1-23 runtime gate failed unexpectedly with status ${runtime.status}`);
  process.exitCode = runtime.status ?? 1;
}
