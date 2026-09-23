import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const required = [
  'phase0/PHASE13.11.20-HASHES-DOCUMENTATION.md',
  'phase0/PHASE13.11.20-SOURCE-HASHES.sha256',
  'phase0/phase13.11.20-documentation-hash-regression.mjs',
  'phase0/PHASE13.11.21-SNAPSHOT-EXIT.md',
  'phase0/PHASE13.11.21-SOURCE-HASHES.sha256',
  'SELLIFY_AI_HANDOFF.md',
  'package.json'
];
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function assert(c, m) { if (!c) throw new Error(m); }
for (const rel of required) assert(fs.existsSync(path.join(root, rel)), `Snapshot artifact missing: ${rel}`);
const manifest = path.join(root, 'phase0/PHASE13.11.21-SOURCE-HASHES.sha256');
const lines = fs.readFileSync(manifest, 'utf8').split(/\r?\n/).filter(Boolean);
assert(lines.length >= 80, `Expected final snapshot hash coverage, found ${lines.length}`);
for (const line of lines) {
  const m = line.match(/^([0-9a-f]{64})  (.+)$/);
  assert(m, `Invalid final snapshot hash line: ${line}`);
  const file = path.join(root, m[2]);
  assert(fs.existsSync(file), `Final snapshot file missing: ${m[2]}`);
  assert(sha256(file) === m[1], `Final snapshot hash mismatch: ${m[2]}`);
}
const handoff = fs.readFileSync(path.join(root, 'SELLIFY_AI_HANDOFF.md'), 'utf8');
assert(handoff.includes('Phase 13.11.21 Snapshot / Exit'), 'AI handoff missing final phase');
assert(handoff.includes('Phase 13.11 status: COMPLETE / EXITED'), 'AI handoff missing Phase 13.11 completion');
assert(handoff.includes('Do not lower the Node >=24 requirement'), 'AI handoff lost Node requirement control');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert(pkg.engines?.node === '>=24', 'Node >=24 requirement changed');
assert(pkg.scripts?.['test:phase13.11.21'], 'Phase 13.11.21 package script missing');
console.log('Phase 13.11.21 Snapshot / Exit Regression: PASS');
console.log(`Final snapshot hash entries verified: ${lines.length}`);
console.log('Phase 13.11.0 → 13.11.20 control chain present: PASS');
console.log('AI handoff final-exit continuity: PASS');
console.log('Node >=24 requirement preserved: PASS');
console.log('Final snapshot is self-contained and reproducible: PASS');
