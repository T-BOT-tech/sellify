import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'PHASE21.17_SOURCE_SNAPSHOT_EXIT.md',
  'PHASE21.16_IMPLEMENTATION_HANDOFF.md',
  'PHASE21.16-SOURCE-HASHES.sha256',
  'phase0/phase21.14-cumulative-phase21-gate.mjs',
  'phase0/phase21.15-node24-verification.mjs',
  'phase0/phase21.16-hashes-documentation-regression.mjs',
  'app/src/phase21-network-intelligence-control.js',
];
for (const rel of required) assert.equal(fs.existsSync(path.join(root, rel)), true, `missing exit artifact: ${rel}`);

const exitDoc = fs.readFileSync(path.join(root, 'PHASE21.17_SOURCE_SNAPSHOT_EXIT.md'), 'utf8');
assert.match(exitDoc, /PHASE 21 FUNCTIONAL EXIT: PASS/);
assert.match(exitDoc, /RELEASE CERTIFICATION: BLOCKED/);
assert.match(exitDoc, /Node v22\.16\.0/);
assert.match(exitDoc, /Node >=24/);

const cumulative = spawnSync(process.execPath, ['phase0/phase21.14-cumulative-phase21-gate.mjs'], { cwd: root, encoding: 'utf8' });
assert.equal(cumulative.status, 0, `${cumulative.stdout}\n${cumulative.stderr}`);
assert.match(`${cumulative.stdout}\n${cumulative.stderr}`, /220 PASS \/ 0 FAIL/);

const docs = spawnSync(process.execPath, ['phase0/phase21.16-hashes-documentation-regression.mjs'], { cwd: root, encoding: 'utf8' });
assert.equal(docs.status, 0, `${docs.stdout}\n${docs.stderr}`);
assert.match(`${docs.stdout}\n${docs.stderr}`, /14 PASS \/ 0 FAIL/);

console.log('PHASE 21.17 SOURCE SNAPSHOT / EXIT: 16 PASS / 0 FAIL');
console.log('Functional exit: PASS');
console.log('Node >=24 release certification: BLOCKED (available runtime is Node 22.x)');
