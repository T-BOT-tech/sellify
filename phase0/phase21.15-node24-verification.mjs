import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const engine = String(pkg.engines?.node || '');
assert.equal(engine, '>=24', `Node engine changed: ${engine || '(missing)'}`);

const requiredMajor = 24;
const actual = process.versions.node;
const actualMajor = Number(actual.split('.')[0]);

const requiredScripts = [
  'test:phase21.0','test:phase21.1','test:phase21.2','test:phase21.3',
  'test:phase21.4','test:phase21.5','test:phase21.6','test:phase21.7',
  'test:phase21.8','test:phase21.9','test:phase21.10','test:phase21.11',
  'test:phase21.12','test:phase21.13','test:phase21.14'
];
for (const key of requiredScripts) assert.equal(typeof pkg.scripts?.[key], 'string', `Missing ${key}`);

const requiredArtifacts = [
  'app/src/phase21-network-intelligence-control.js',
  'phase0/phase21.14-cumulative-phase21-gate.mjs',
  'PHASE21.14-CUMULATIVE-EXIT.md',
];
for (const rel of requiredArtifacts) assert.equal(fs.existsSync(path.join(root, rel)), true, `Missing artifact: ${rel}`);

console.log(`Phase 21.15 declaration/artifact checks: PASS (Node engine ${engine})`);
if (actualMajor < requiredMajor) {
  console.error(`Phase 21.15 Node >=24 Verification: BLOCKED (runtime is Node ${actual})`);
  console.error('Node >=24 release certification requires execution under a real Node.js 24+ runtime.');
  process.exitCode = 2;
} else {
  console.log(`Phase 21.15 Node >=24 Verification: PASS (Node ${actual})`);
}
