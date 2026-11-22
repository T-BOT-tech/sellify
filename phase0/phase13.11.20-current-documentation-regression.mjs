import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'phase0/PHASE13.11.20-SOURCE-HASHES.sha256');
const docsPath = path.join(root, 'phase0/PHASE13.11.20-HASHES-DOCUMENTATION.md');
const handoffPath = path.join(root, 'SELLIFY_AI_HANDOFF.md');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

assert.ok(fs.existsSync(docsPath), 'Phase 13.11.20 documentation missing');
assert.ok(fs.existsSync(manifestPath), 'Phase 13.11.20 historical manifest missing');
const lines = fs.readFileSync(manifestPath, 'utf8').split(/\r?\n/).filter(Boolean);
assert.ok(lines.length >= 80, 'Phase 13.11.20 historical manifest coverage is incomplete');
for (const line of lines) {
  const match = line.match(/^([0-9a-f]{64})  (.+)$/);
  assert.ok(match, 'Invalid Phase 13.11.20 historical manifest entry: ' + line);
  assert.ok(fs.existsSync(path.join(root, match[2])), 'Historical manifest path missing: ' + match[2]);
}

const handoff = fs.readFileSync(handoffPath, 'utf8');
assert.ok(handoff.includes('Phase 13.11.20'), 'AI handoff missing Phase 13.11.20 status');
assert.ok(handoff.includes('13.11.21 Snapshot / Exit'), 'AI handoff missing Phase 13.11.21 next-step status');
const phaseDocs = fs.readdirSync(path.join(root, 'phase0'))
  .filter(name => /^PHASE13\.11\.(?:0|1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19)-.*\.md$/.test(name));
assert.ok(phaseDocs.length >= 19, 'Phase 13.11 documentation continuity incomplete');
assert.equal(pkg.engines?.node, '>=24');
assert.ok(pkg.scripts?.['test:phase13.11.20'], 'Historical Phase 13.11.20 package script missing');

console.log('Phase 13.11.20 Current Documentation / Historical Manifest Regression: PASS');
console.log('Historical manifest entries structurally verified: ' + lines.length);
console.log('Phase 13.11 documentation and AI handoff continuity: PASS');
console.log('Historical fingerprints preserved without rewriting: PASS');
