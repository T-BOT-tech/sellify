import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const manifest = path.join(root, 'phase0', 'PHASE13.11.20-SOURCE-HASHES.sha256');
const docs = path.join(root, 'phase0', 'PHASE13.11.20-HASHES-DOCUMENTATION.md');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(fs.existsSync(manifest), 'Phase 13.11.20 hash manifest missing');
assert(fs.existsSync(docs), 'Phase 13.11.20 documentation missing');

const lines = fs.readFileSync(manifest, 'utf8').split(/\r?\n/).filter(Boolean);
assert(lines.length > 0, 'Phase 13.11.20 hash manifest is empty');

for (const line of lines) {
  const match = line.match(/^([0-9a-f]{64})  (.+)$/);
  assert(match, `Invalid hash manifest line: ${line}`);
  const [, expected, relative] = match;
  const file = path.join(root, relative);
  assert(fs.existsSync(file), `Hashed file missing: ${relative}`);
  const actual = sha256(file);
  assert(actual === expected, `Hash mismatch: ${relative}`);
}

const handoff = fs.readFileSync(path.join(root, 'SELLIFY_AI_HANDOFF.md'), 'utf8');
assert(handoff.includes('Phase 13.11.20'), 'AI handoff missing Phase 13.11.20 status');
assert(handoff.includes('13.11.21 Snapshot / Exit'), 'AI handoff missing Phase 13.11.21 next-step status');

const phaseDocs = fs.readdirSync(path.join(root, 'phase0')).filter(name => /^PHASE13\.11\.(?:0|1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19)-.*\.md$/.test(name));
assert(phaseDocs.length >= 19, `Expected cumulative Phase 13.11 documentation, found ${phaseDocs.length}`);

console.log('Phase 13.11.20 Hashes / Documentation Regression: PASS');
console.log(`Hash manifest entries verified: ${lines.length}`);
console.log('Phase 13.11 documentation continuity: PASS');
console.log('AI handoff phase continuity: PASS');
console.log('Self-contained documentation controls: PASS');
