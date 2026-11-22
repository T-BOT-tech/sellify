import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const manifest = read('phase0/PHASE13.11.20-SOURCE-HASHES.sha256');
const lines = manifest.split(/\r?\n/).filter(Boolean);
assert.equal(lines.length, 81, 'Historical Phase 13.11.20 manifest entry count changed');
const expectedHistoricalEntries = [
  'cdfbd8acad71f936175fa2ed94a94b375e2452184807ff18f00422012737a7c6  app/src/logistics/fulfillment.js',
  'cff63e0575124e150eb276b76a082ebd9f1031ce5e2fc25771d914ac08b492c7  phase0/phase13.11.12-failure-isolation-regression.mjs',
  'a428efaac827e95e96d118c52aa8e6a2bf2b946bf453ce78c3adce80fa9807ed  phase0/phase13.11.19-cumulative-gate.mjs',
  '7cd11e9048d0e14feae695d100b58b94a5d6d72b1ef5a3aa60ee19e4d5f266da  phase0/PHASE13.11.20-HASHES-DOCUMENTATION.md',
];
for (const entry of expectedHistoricalEntries) assert(lines.includes(entry), `Historical Phase 13.11.20 evidence changed: ${entry}`);

const handoff = read('SELLIFY_AI_HANDOFF.md');
assert(handoff.includes('Phase 13.11.20'), 'AI handoff missing Phase 13.11.20 status');
assert(handoff.includes('13.11.21 Snapshot / Exit'), 'AI handoff missing Phase 13.11.21 next-step status');
const phaseDocs = fs.readdirSync(path.join(root, 'phase0')).filter(name =>
  /^PHASE13\.11\.(?:0|1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19)-.*\.md$/.test(name));
assert(phaseDocs.length >= 19, `Expected cumulative Phase 13.11 documentation, found ${phaseDocs.length}`);
const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.engines?.node, '>=24');
assert(pkg.scripts?.['test:phase13.11.20'], 'Historical Phase 13.11.20 package alias missing');

console.log('Phase 13.11.20 Current Historical Documentation Continuity: PASS');
console.log('Historical 81-entry manifest and pinned snapshot identities preserved: PASS');
console.log('AI handoff / phase documentation continuity: PASS');
console.log('Node >=24 requirement and historical package alias preserved: PASS');
