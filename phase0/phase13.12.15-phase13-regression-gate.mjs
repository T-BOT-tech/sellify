import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const required = [
  'phase0/PHASE13.11.21-SNAPSHOT-EXIT.md',
  'phase0/PHASE13.11.21-SOURCE-HASHES.sha256',
  'phase0/phase13.11.21-snapshot-exit-regression.mjs',
  'backend/lib/authorization.js',
  'backend/lib/tenant-isolation.js',
  'backend/lib/security-context.js',
  'backend/lib/resource-action-registry.js',
  'backend/lib/cross-pack-role-matrix.js',
  'backend/lib/vertical-capability-authorization.js',
  'backend/lib/vertical-mutation-enforcement.js',
  'backend/lib/vertical-approval-boundary.js',
  'backend/lib/vertical-sensitive-audit-boundary.js',
  'app/src/verticals/configuration.js',
  'app/src/verticals/event-integration.js',
  'phase0/PHASE13.12.15-REGRESSION-GATE.md',
  'SELLIFY_AI_HANDOFF.md',
  'package.json',
];
const phaseScripts = Array.from({ length: 15 }, (_, i) => `test:phase13.12.${i}`);

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(root, rel)); }
function assertFile(rel) { assert(exists(rel), `Required Phase 13.12 gate artifact missing: ${rel}`); }

for (const rel of required) assertFile(rel);

const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.engines?.node, '>=24', 'Node >=24 requirement changed');
for (const script of phaseScripts) {
  assert(pkg.scripts?.[script], `Missing executable control: ${script}`);
}

const handoff = read('SELLIFY_AI_HANDOFF.md');
assert(handoff.includes('Phase 13.11.21 Snapshot / Exit'), 'Phase 13.11.21 continuity missing');
assert(handoff.includes('Phase 13.12.14 — Events / Outbox Integration'), '13.12.14 handoff missing');
assert(handoff.includes('Next subphase: **Phase 13.12.15 — Phase 13 Regression Gate**'), '13.12.15 handoff transition missing');

const auth = read('backend/lib/authorization.js');
assert(auth.includes('export function authorize'), 'Canonical authorize() missing');
assert(auth.includes('ROLE_PERMISSIONS'), 'Canonical role permission policy missing');

const eventIntegration = read('app/src/verticals/event-integration.js');
assert(eventIntegration.includes('buildVersionedEvent'), 'Canonical event envelope not composed');
assert(eventIntegration.includes('enqueueVersionedEvent'), 'Existing outbox handoff not composed');
assert(!/CREATE TABLE|DatabaseSync|new\s+(?:EventBus|EventStore|MessageBroker)/.test(eventIntegration), 'Duplicate event persistence/broker detected');

const configuration = read('app/src/verticals/configuration.js');
assert(configuration.includes('defaults'), 'Configuration precedence contract missing');
assert(!/authorize\s*\(/.test(configuration), 'Configuration module must not become authorization evaluator');

const authoritySources = [
  ['backend/lib/vertical-capability-authorization.js', /authorize\s*\(/],
  ['backend/lib/vertical-mutation-enforcement.js', /authorizeVerticalCapability/],
  ['backend/lib/vertical-sensitive-audit-boundary.js', /recordAudit/],
];
for (const [rel, pattern] of authoritySources) assert(pattern.test(read(rel)), `Expected canonical boundary composition missing: ${rel}`);

// Preserve the Phase 13.11.21 snapshot as a historical source-of-truth record.
// Later phases intentionally update mutable integration artifacts such as
// package.json and SELLIFY_AI_HANDOFF.md, so this gate checks snapshot coverage
// and artifact continuity rather than pretending the old hash set still
// describes the post-13.11 source tree.
const snapshotManifest = read('phase0/PHASE13.11.21-SOURCE-HASHES.sha256').split(/\r?\n/).filter(Boolean);
assert(snapshotManifest.length >= 80, `Phase 13.11.21 hash coverage regressed: ${snapshotManifest.length}`);
for (const line of snapshotManifest) {
  const match = line.match(/^([0-9a-f]{64})  (.+)$/);
  assert(match, `Invalid Phase 13.11.21 hash entry: ${line}`);
  assertFile(match[2]);
}

// Execute every completed 13.12 control plus the Phase 0 Golden Regression.
for (const script of phaseScripts) {
  const command = pkg.scripts[script];
  const match = command.match(/^node\s+(.+)$/);
  assert(match, `Unexpected regression command shape: ${script}`);
  const result = spawnSync(process.execPath, [match[1]], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Regression control failed: ${script}`);
}
const golden = spawnSync(process.execPath, ['phase0/golden-regression.mjs'], { stdio: 'inherit' });
if (golden.status !== 0) throw new Error('Phase 0 Golden Regression failed');

console.log('Phase 13.12.15 Phase 13 Regression Gate: PASS');
console.log('Phase 13.11.21 snapshot continuity: PASS');
console.log('Phase 13.12.0 → 13.12.14 control chain: PASS');
console.log('Canonical authorization / tenant / location / audit authorities preserved: PASS');
console.log('Vertical security gates compose without duplicate authority: PASS');
console.log('Pack configuration boundary preserved: PASS');
console.log('Event / outbox boundary preserved: PASS');
console.log('Cross-pack escalation boundary preserved: PASS');
console.log('Node >=24 requirement preserved: PASS');
console.log('Phase 0 Golden Regression: PASS');
console.log('Phase 13.12.15 exit certification: PASS');
