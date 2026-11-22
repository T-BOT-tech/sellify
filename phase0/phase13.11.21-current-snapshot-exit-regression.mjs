import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const manifest = read('phase0/PHASE13.11.21-SOURCE-HASHES.sha256');
const lines = manifest.split(/\r?\n/).filter(Boolean);
assert.equal(lines.length, 86, 'Historical Phase 13.11.21 manifest entry count changed');
const expectedHistoricalEntries = [
  'a24db10269002c85c574f1f96e96520928e1330af7b54dd434185d73213054ac  package.json',
  '4767299d8352d581983c419e9bd157fa83b84f7c9c6d903fe18310367bfe479c  phase0/PHASE13.11.20-SOURCE-HASHES.sha256',
  'cff63e0575124e150eb276b76a082ebd9f1031ce5e2fc25771d914ac08b492c7  phase0/phase13.11.12-failure-isolation-regression.mjs',
  'a428efaac827e95e96d118c52aa8e6a2bf2b946bf453ce78c3adce80fa9807ed  phase0/phase13.11.19-cumulative-gate.mjs',
  '5bcc9ec6a089f32ec425818f3ca831e46e36318ca9fa82c0d56e613a8831d362  phase0/phase13.11.21-snapshot-exit-regression.mjs',
];
for (const entry of expectedHistoricalEntries) assert(lines.includes(entry), `Historical Phase 13.11.21 evidence changed: ${entry}`);

const handoff = read('SELLIFY_AI_HANDOFF.md');
assert(handoff.includes('Phase 13.11.21 Snapshot / Exit'), 'AI handoff missing final phase');
assert(handoff.includes('Phase 13.11 status: COMPLETE / EXITED'), 'AI handoff missing Phase 13.11 completion');
assert(handoff.includes('Do not lower the Node >=24 requirement'), 'AI handoff lost Node requirement control');
const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.engines?.node, '>=24', 'Node >=24 requirement changed');
assert(pkg.scripts?.['test:phase13.11.21'], 'Historical Phase 13.11.21 package alias missing');

console.log('Phase 13.11.21 Current Historical Snapshot / Exit Continuity: PASS');
console.log('Historical 86-entry manifest, Phase 13.11.20 manifest, and package identity preserved: PASS');
console.log('AI handoff final-exit continuity: PASS');
console.log('Node >=24 requirement and historical package alias preserved: PASS');
