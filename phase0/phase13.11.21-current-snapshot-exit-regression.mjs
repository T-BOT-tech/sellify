import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'phase0/PHASE13.11.20-HASHES-DOCUMENTATION.md',
  'phase0/PHASE13.11.20-SOURCE-HASHES.sha256',
  'phase0/phase13.11.20-documentation-hash-regression.mjs',
  'phase0/PHASE13.11.21-SNAPSHOT-EXIT.md',
  'phase0/PHASE13.11.21-SOURCE-HASHES.sha256',
  'SELLIFY_AI_HANDOFF.md',
  'package.json',
];
for (const relative of required) {
  assert.ok(fs.existsSync(path.join(root, relative)), 'Snapshot artifact missing: ' + relative);
}
const manifestPath = path.join(root, 'phase0/PHASE13.11.21-SOURCE-HASHES.sha256');
const lines = fs.readFileSync(manifestPath, 'utf8').split(/\r?\n/).filter(Boolean);
assert.ok(lines.length >= 80, 'Phase 13.11.21 historical snapshot coverage incomplete');
assert.ok(lines.some(line => line.endsWith('  phase0/PHASE13.11.20-SOURCE-HASHES.sha256')),
  'Final snapshot does not pin the Phase 13.11.20 historical manifest');
for (const line of lines) {
  const match = line.match(/^([0-9a-f]{64})  (.+)$/);
  assert.ok(match, 'Invalid Phase 13.11.21 historical manifest entry: ' + line);
  assert.ok(fs.existsSync(path.join(root, match[2])), 'Historical snapshot path missing: ' + match[2]);
}

const handoff = fs.readFileSync(path.join(root, 'SELLIFY_AI_HANDOFF.md'), 'utf8');
assert.ok(handoff.includes('Phase 13.11.21 Snapshot / Exit'), 'AI handoff missing final phase');
assert.ok(handoff.includes('Phase 13.11 status: COMPLETE / EXITED'), 'AI handoff missing Phase 13.11 completion');
assert.ok(handoff.includes('Do not lower the Node >=24 requirement'), 'AI handoff lost Node requirement control');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(pkg.engines?.node, '>=24', 'Node >=24 requirement changed');
assert.ok(pkg.scripts?.['test:phase13.11.21'], 'Historical Phase 13.11.21 package script missing');

console.log('Phase 13.11.21 Current Snapshot / Exit Regression: PASS');
console.log('Historical snapshot manifest entries structurally verified: ' + lines.length);
console.log('AI handoff final-exit continuity: PASS');
console.log('Node >=24 requirement preserved: PASS');
console.log('Historical snapshot preserved as an immutable record: PASS');
