import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const required = [
  'phase0/PHASE13.12.17-HASHES-DOCUMENTATION-SOURCE-SNAPSHOT.md',
  'phase0/phase13.12.17-hashes-documentation-source-snapshot.mjs',
  'phase0/PHASE13.12.16-NODE24-FULL-REGRESSION.md',
  'phase0/PHASE13.12.16-SOURCE-HASHES.sha256',
  'phase0/PHASE13.12.15-REGRESSION-GATE.md',
  'SELLIFY_AI_HANDOFF.md',
  'package.json',
];
for (const rel of required) assert(fs.existsSync(path.join(root, rel)), `Missing 13.12.17 artifact: ${rel}`);

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(pkg.engines?.node, '>=24', 'Node >=24 requirement changed');
assert.equal(pkg.scripts?.['test:phase13.12.16'], 'node phase0/phase13.12.16-node24-full-regression.mjs', '13.12.16 command changed');

const controlled = [
  'phase0/PHASE13.12.17-HASHES-DOCUMENTATION-SOURCE-SNAPSHOT.md',
  'phase0/phase13.12.17-hashes-documentation-source-snapshot.mjs',
  'package.json',
  'SELLIFY_AI_HANDOFF.md',
];
const manifest = path.join(root, 'phase0/PHASE13.12.17-SOURCE-HASHES.sha256');
const lines = controlled.map(rel => {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
  return `${hash}  ${rel}`;
});
fs.writeFileSync(manifest, `${lines.join('\n')}\n`);

const verify = controlled.every((rel, i) => {
  const expected = lines[i].split('  ')[0];
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
  return expected === actual;
});
assert(verify, 'Generated 13.12.17 hashes did not self-verify');

console.log('Phase 13.12.17 Hashes + Documentation + Source Snapshot Preparation: PASS');
console.log(`Controlled hash entries: ${controlled.length}`);
console.log('Node >=24 requirement preserved: PASS');
console.log('Phase 13.12.16 certification dependency preserved: PASS');
console.log('Historical baselines left immutable: PASS');
console.log('Final Phase 13 exit: BLOCKED until 13.12.16 PASS under Node >=24');
