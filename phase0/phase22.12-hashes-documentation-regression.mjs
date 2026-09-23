import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const handoff = path.join(root, 'PHASE22.12_IMPLEMENTATION_HANDOFF.md');
const hashFile = path.join(root, 'PHASE22.12-SOURCE-HASHES.sha256');
const required = [
  'PHASE22.12_IMPLEMENTATION_HANDOFF.md',
  'PHASE22.12-SOURCE-HASHES.sha256',
  'package.json',
  'phase0/phase22.11-node24-verification.mjs',
  'phase0/phase22.10-cumulative-phase22-gate.mjs',
  'app/src/phase22-procurement-intent.js',
  'app/src/phase22-procurement-context.js',
  'app/src/phase22-evidence-supplier-intelligence.js',
  'app/src/phase22-procurement-preparation.js',
  'app/src/phase22-deterministic-result-explanation.js',
  'app/src/phase22-action-proposal-authorization.js',
  'app/src/phase22-procurement-integration.js',
];
for (const rel of required) assert.equal(fs.existsSync(path.join(root, rel)), true, `missing artifact: ${rel}`);

const text = fs.readFileSync(handoff, 'utf8');
assert.match(text, /Hashes \+ Documentation/);
assert.match(text, /Node v22\.16\.0/);
assert.match(text, /BLOCKED \/ NOT CERTIFIED/);
assert.match(text, /No historical hash evidence is rewritten/);

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(pkg.scripts['test:phase22.12'], 'node phase0/phase22.12-hashes-documentation-regression.mjs');
assert.equal(pkg.engines?.node, '>=24');

const lines = fs.readFileSync(hashFile, 'utf8').trim().split('\n').filter(Boolean);
assert.ok(lines.length >= 15, 'expected Phase 22 hash coverage');
for (const line of lines) {
  const [expected, rel] = line.split(/\s+/, 2);
  assert.match(expected, /^[0-9a-f]{64}$/);
  assert.ok(rel && rel !== 'PHASE22.12-SOURCE-HASHES.sha256');
  const file = path.join(root, rel);
  assert.equal(fs.existsSync(file), true, `hashed file missing: ${rel}`);
  const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(actual, expected, `hash mismatch: ${rel}`);
}

console.log('PHASE 22.12 HASHES + DOCUMENTATION: PASS');
