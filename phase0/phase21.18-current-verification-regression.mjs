import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

// Phase 21.16 is a historical snapshot, not a current-source hash gate.
const historical = read('PHASE21.16-SOURCE-HASHES.sha256').trim().split(/\r?\n/).filter(Boolean);
assert.equal(historical.length, 30, 'Historical Phase 21.16 manifest entry count changed');
for (const entry of [
  '1095c31a482244d7267fb85f9a614ac6b262df71eaff934cae441a70fd73ea11  app/src/phase21-capacity-availability-evidence.js',
  'a24db10269002c85c574f1f96e96520928e1330af7b54dd434185d73213054ac  package.json',
  'cae78e5920c4a292d837b3eb9830d320ecd9e4507db622892fef621d066ea71e  app/src/phase21-network-intelligence-control.js',
]) assert(historical.includes(entry), `Historical Phase 21.16 snapshot identity changed: ${entry}`);

const handoff = read('PHASE21.16_IMPLEMENTATION_HANDOFF.md');
assert.match(handoff, /Node v22\.16\.0/);
assert.match(handoff, /NOT CERTIFIED/);
assert.match(handoff, /220 PASS \/ 0 FAIL/);

const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.engines?.node, '>=24');
assert.equal(pkg.scripts?.['test:phase21.16'], 'node phase0/phase21.16-hashes-documentation-regression.mjs');
assert.equal(pkg.scripts?.['test:phase21.3'], 'node phase0/phase21.3-capacity-availability-regression.mjs');

const manifest = read('PHASE21.18-SOURCE-HASHES.sha256').trim().split(/\r?\n/).filter(Boolean);
assert.equal(manifest.length, 11, 'Current Phase 21.18 manifest entry count changed');
for (const line of manifest) {
  const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
  assert.ok(match, `Malformed Phase 21.18 hash entry: ${line}`);
  const [, expected, rel] = match;
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
  assert.equal(actual, expected, `Current Phase 21.18 source hash mismatch: ${rel}`);
}

const currentDoc = read('PHASE21.18_CURRENT_VERIFICATION.md');
assert.match(currentDoc, /SELF_REPORTED/);
assert.match(currentDoc, /UNKNOWN[\s\S]*STALE[\s\S]*CONFLICTING/);
assert.match(currentDoc, /historical Phase 21.16 snapshot/);
console.log('Phase 21.18 current evidence verification: PASS');
console.log('Historical Phase 21.16 manifest and Node 22 handoff preserved: PASS');
console.log('Current 11-entry SHA-256 source manifest: PASS');
