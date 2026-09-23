// Phase 22.1 — AI Procurement Constitution regression.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const constitution = fs.readFileSync(path.join(root, 'PHASE22.1_AI_PROCUREMENT_CONSTITUTION.md'), 'utf8');
const aiBoundary = fs.readFileSync(path.join(root, 'app/src/platform/ai-capability-boundary.js'), 'utf8');
const procurement = fs.readFileSync(path.join(root, 'app/src/procurement/comparison-contract.js'), 'utf8');
const handoff = fs.readFileSync(path.join(root, 'app/src/phase21-procurement-commerce-handoff.js'), 'utf8');
const baseline = fs.readFileSync(path.join(root, 'PHASE22.0_BASELINE_RELOCK.md'), 'utf8');

const checks = [];
function check(label, fn) {
  try { fn(); checks.push(`PASS: ${label}`); }
  catch (error) { console.error(`FAIL: ${label}\n${error.message}`); process.exitCode = 1; }
}

check('constitution artifact exists', () => assert.equal(fs.existsSync(path.join(root, 'PHASE22.1_AI_PROCUREMENT_CONSTITUTION.md')), true));
check('constitution defines AI procurement intelligence/orchestration boundary', () => {
  assert.match(constitution, /interpret, compose, explain, prepare, and route/i);
  assert.match(constitution, /must not own/);
  assert.match(constitution, /procurement truth/);
});
check('constitutional authority flow preserves existing domains', () => {
  for (const term of ['Phase 19 Discovery', 'Phase 21 Supply Intelligence', 'Phase 20 Cross-Border Context', 'Existing Procurement Authority', 'Commerce / Inventory / Payment / Fulfillment / Logistics']) assert.match(constitution, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
check('AI cannot execute, persist, access DB, or credentials through existing boundary', () => {
  assert.match(aiBoundary, /execution: 'none'/);
  assert.match(aiBoundary, /persistence: 'none'/);
  assert.match(aiBoundary, /directDatabaseAccess: false/);
  assert.match(aiBoundary, /directCredentialsAccess: false/);
  assert.match(aiBoundary, /directExecution: false/);
});
check('AI cannot grant authorization', () => assert.match(aiBoundary, /authorization: 'existing_authorization'/));
check('deterministic procurement comparison remains authoritative', () => {
  assert.match(procurement, /aiRequired: false/);
  assert.match(procurement, /deterministic comparison contract/);
});
check('Phase 21 handoff still delegates instead of creating procurement truth', () => {
  assert.match(handoff, /creates_procurement_demand: false/);
  assert.match(handoff, /creates_rfq: false/);
  assert.match(handoff, /creates_award: false/);
  assert.match(handoff, /creates_purchase_order|creates_order/);
});
check('constitutional invariants are explicit', () => {
  assert.match(constitution, /INTENT ≠ FEASIBILITY ≠ AUTHORIZATION ≠ EXECUTION/);
  assert.match(constitution, /UNKNOWN ≠ SUCCESS/);
});
check('no Phase 22 transaction/state authority is authorized', () => {
  assert.match(constitution, /no independent transaction\/state authority/i);
  assert.match(constitution, /No Phase 22 table, ledger, event store/i);
});
check('baseline and constitution agree on provisional concepts', () => {
  for (const term of ['ProcurementIntent', 'ProcurementContext', 'ProcurementProposal']) {
    assert.match(baseline, new RegExp(term));
    assert.match(constitution, new RegExp(term));
  }
});
check('external providers remain behind controlled adapter boundary', () => assert.match(constitution, /Canonical Contract → Adapter → External Provider/));
check('downstream Phase 23/24 compatibility is explicitly preserved', () => {
  assert.match(constitution, /Phase 23 — AI Negotiation/);
  assert.match(constitution, /Phase 24 — Agent Commerce/);
});

console.log(checks.join('\n'));
const failed = checks.filter(x => x.startsWith('FAIL')).length;
console.log(`${checks.length} PASS / ${failed} FAIL`);
if (failed) process.exit(1);
