import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0;
let fail = 0;
function check(label, fn) {
  try { fn(); pass++; console.log(`PASS: ${label}`); }
  catch (error) { fail++; console.error(`FAIL: ${label}\n${error.message}`); }
}
function exists(rel) { assert.equal(fs.existsSync(path.join(root, rel)), true, `missing: ${rel}`); }
function text(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

for (const rel of [
  'PHASE21.17_SOURCE_SNAPSHOT_EXIT.md',
  'PHASE21.17_IMPLEMENTATION_HANDOFF.md',
  'PHASE21.16-SOURCE-HASHES.sha256',
  'phase0/phase21.14-cumulative-phase21-gate.mjs',
  'phase0/phase21.17-source-snapshot-exit-regression.mjs',
  'app/src/procurement/demand-contract.js',
  'app/src/procurement/rfq-contract.js',
  'app/src/procurement/comparison-contract.js',
  'app/src/procurement/award-contract.js',
  'app/src/procurement/execution-contract.js',
  'app/src/platform/ai-capability-boundary.js',
  'app/src/cross-border-ai-intent.js',
  'app/src/phase21-procurement-commerce-handoff.js',
  'app/src/platform/authority-registry.js',
  'app/src/platform/event-outbox-platform.js',
  'PHASE22.0_BASELINE_RELOCK.md',
  'PHASE22.0-SOURCE-HASHES.sha256',
]) check(`required artifact: ${rel}`, () => exists(rel));

check('Phase 21.17 functional exit remains PASS and release remains blocked', () => {
  const doc = text('PHASE21.17_SOURCE_SNAPSHOT_EXIT.md');
  assert.match(doc, /PHASE 21 FUNCTIONAL EXIT: PASS/);
  assert.match(doc, /RELEASE CERTIFICATION: BLOCKED/);
  assert.match(doc, /Node v22\.16\.0/);
  assert.match(doc, /Node >=24/);
});

check('Phase 21 cumulative gate remains PASS', () => {
  const run = spawnSync(process.execPath, ['phase0/phase21.14-cumulative-phase21-gate.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(`${run.stdout}\n${run.stderr}`, /220 PASS \/ 0 FAIL/);
});

check('Phase 21.17 exit regression remains PASS', () => {
  const run = spawnSync(process.execPath, ['phase0/phase21.17-source-snapshot-exit-regression.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(`${run.stdout}\n${run.stderr}`, /16 PASS \/ 0 FAIL/);
});

check('Procurement contracts remain owned by procurement authority', () => {
  assert.match(text('app/src/procurement/demand-contract.js'), /authority: 'procurement'/);
  assert.match(text('app/src/procurement/rfq-contract.js'), /authority:'procurement'/);
  assert.match(text('app/src/procurement/comparison-contract.js'), /authority:'procurement'/);
  assert.match(text('app/src/procurement/award-contract.js'), /decisionAuthority:'procurement'/);
  assert.match(text('app/src/procurement/execution-contract.js'), /existing_b2b_purchase_order_authority/);
});

check('Procurement comparison remains deterministic and AI-free', () => {
  assert.match(text('app/src/procurement/comparison-contract.js'), /aiRequired: false/);
  assert.match(text('app/src/procurement/comparison-contract.js'), /deterministic comparison contract/);
});

check('Existing AI capability boundary remains non-executable', () => {
  const doc = text('app/src/platform/ai-capability-boundary.js');
  assert.match(doc, /execution: 'none'/);
  assert.match(doc, /persistence: 'none'/);
  assert.match(doc, /directDatabaseAccess: false/);
  assert.match(doc, /directCredentialsAccess: false/);
  assert.match(doc, /directExecution: false/);
  assert.match(doc, /existing_authorization/);
});

check('Cross-border AI remains translation-only', () => {
  const doc = text('app/src/cross-border-ai-intent.js');
  assert.match(doc, /Structured Cross-Border Intent|structured/i);
  assert.match(doc, /deterministic/i);
  assert.match(doc, /execution/i);
});

check('Phase 21 procurement handoff delegates to existing procurement', () => {
  const doc = text('app/src/phase21-procurement-commerce-handoff.js');
  assert.match(doc, /procurement/i);
  assert.match(doc, /authority|existing/i);
});

check('Phase 22 baseline explicitly forbids duplicate transaction/state authority', () => {
  const doc = text('PHASE22.0_BASELINE_RELOCK.md');
  assert.match(doc, /No new Phase 22 transaction\/state authority/);
  assert.match(doc, /second Procurement Demand store/);
  assert.match(doc, /second RFQ store/);
  assert.match(doc, /AI ranking\/decision engine/);
  assert.match(doc, /direct database access/);
});

check('Phase 22 baseline records intent/context/proposal as non-authoritative provisional concepts', () => {
  const doc = text('PHASE22.0_BASELINE_RELOCK.md');
  assert.match(doc, /ProcurementIntent/);
  assert.match(doc, /ProcurementContext/);
  assert.match(doc, /ProcurementProposal/);
  assert.match(doc, /request-scoped/);
});

check('Phase 22 baseline preserves authorization/execution distinction', () => {
  const doc = text('PHASE22.0_BASELINE_RELOCK.md');
  assert.match(doc, /INTENT ≠ FEASIBILITY ≠ AUTHORIZATION ≠ EXECUTION/);
  assert.match(doc, /UNKNOWN ≠ SUCCESS/);
});

check('No Phase 22 production transaction files exist at 22.0', () => {
  const forbidden = [
    'app/src/phase22-procurement-engine.js',
    'app/src/phase22-procurement-store.js',
    'app/src/phase22-procurement-db.js',
    'app/src/procurement/phase22-authority.js',
  ];
  for (const rel of forbidden) assert.equal(fs.existsSync(path.join(root, rel)), false, `unexpected Phase 22 authority: ${rel}`);
});

check('Runtime requirement remains Node >=24', () => {
  const pkg = JSON.parse(text('package.json'));
  assert.equal(pkg.engines?.node, '>=24');
});

check('Phase 22 baseline hash manifest is internally valid', () => {
  const lines = text('PHASE22.0-SOURCE-HASHES.sha256').trim().split('\n').filter(Boolean);
  assert.ok(lines.length >= 8);
  for (const line of lines) {
    const [expected, rel] = line.split(/\s+/, 2);
    assert.match(expected, /^[0-9a-f]{64}$/);
    exists(rel);
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
    assert.equal(actual, expected, `hash mismatch: ${rel}`);
  }
});

check('Baseline hash manifest excludes itself to avoid recursive hashing', () => {
  const lines = text('PHASE22.0-SOURCE-HASHES.sha256');
  assert.equal(lines.includes('PHASE22.0-SOURCE-HASHES.sha256'), false);
});

check('Phase 22 baseline handoff fields are present', () => {
  const doc = text('PHASE22.0_BASELINE_RELOCK.md');
  for (const heading of ['CURRENT PHASE','OBJECTIVE','SOURCE INSPECTION','CURRENT STATE','SOURCE OF TRUTH','PROPOSED CHANGE','FILES INSPECTED / ADDED','MIGRATION','TEST PLAN','RISKS','DELIBERATELY NOT CHANGED','EXIT DECISION']) assert.match(doc, new RegExp(`## ${heading}`));
});

check('Available runtime is explicitly treated as non-certifying for Node >=24', () => {
  const version = process.versions.node;
  assert.match(version, /^22\./, `expected current implementation environment to remain Node 22.x, got ${version}`);
  const doc = text('PHASE22.0_BASELINE_RELOCK.md');
  assert.match(doc, /Node `v22\.16\.0`/);
  assert.match(doc, /NOT CERTIFIED/);
});

console.log(`PHASE 22.0 BASELINE RE-LOCK: ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
console.log('Functional baseline: PASS');
console.log('Node >=24 release certification: BLOCKED (available runtime is Node 22.x)');
