import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'PHASE21.16_IMPLEMENTATION_HANDOFF.md',
  'PHASE21.16-SOURCE-HASHES.sha256',
  'package.json',
  'phase0/phase21.15-node24-verification.mjs',
  'phase0/phase21.14-cumulative-phase21-gate.mjs',
  'app/src/phase21-network-intelligence-control.js',
];
for (const rel of required) assert.equal(fs.existsSync(path.join(root, rel)), true, `missing artifact: ${rel}`);

const handoff = fs.readFileSync(path.join(root, 'PHASE21.16_IMPLEMENTATION_HANDOFF.md'), 'utf8');
assert.match(handoff, /Node v22\.16\.0/);
assert.match(handoff, /NOT CERTIFIED/);
assert.match(handoff, /220 PASS \/ 0 FAIL/);

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(pkg.scripts['test:phase21.16'], 'node phase0/phase21.16-hashes-documentation-regression.mjs');
assert.equal(pkg.engines?.node, '>=24');

const hashFile = fs.readFileSync(path.join(root, 'PHASE21.16-SOURCE-HASHES.sha256'), 'utf8').trim().split('\n').filter(Boolean);
assert.ok(hashFile.length > 0);
for (const line of hashFile) {
  const [expected, rel] = line.split(/\s+/, 2);
  assert.match(expected, /^[0-9a-f]{64}$/);
  const file = path.join(root, rel);
  assert.equal(fs.existsSync(file), true, `hashed file missing: ${rel}`);
  const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(actual, expected, `hash mismatch: ${rel}`);
}

console.log('PHASE 21.16 HASHES + DOCUMENTATION: 14 PASS / 0 FAIL');
