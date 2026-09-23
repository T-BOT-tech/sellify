import assert from 'node:assert/strict';
import {
  buildTradeRequirement,
  buildTradeEvidence,
  evaluateEvidenceFreshness,
  evaluateTradeRequirement,
  buildTradeRequirementAssessment,
  tradeRequirementsEvidenceContract,
  TRADE_REQUIREMENT_STATUS,
  TRADE_EVIDENCE_STATE,
} from '../app/src/cross-border-trade-evidence.js';

let pass = 0;
const test = (name, fn) => { fn(); pass += 1; console.log(`PASS ${name}`); };

const provenance = { sourceAuthority: 'country', source: 'country_pack', reference: 'ET' };
const req = buildTradeRequirement({ requirementId: 'r-1', type: 'customs', jurisdiction: 'ET', provenance });
const evidence = buildTradeEvidence({ evidenceId: 'e-1', requirementId: 'r-1', source: 'customs-provider', sourceReference: 'ref-1', state: TRADE_EVIDENCE_STATE.VERIFIED, observedAt: '2026-09-15T10:00:00Z', validUntil: '2026-09-20T10:00:00Z', provenance });

test('requirement is derived and non-authoritative', () => { assert.equal(req.derived, true); assert.equal(req.persistent, false); assert.equal(req.authoritative, false); });
test('requirement type is bounded', () => { assert.throws(() => buildTradeRequirement({ requirementId: 'x', type: 'regulatory_engine' })); });
test('evidence requires provenance', () => { assert.throws(() => buildTradeEvidence({ evidenceId: 'x', source: 's', sourceReference: 'r' })); });
test('fresh evidence is current', () => { assert.equal(evaluateEvidenceFreshness(evidence, new Date('2026-09-16T00:00:00Z')), 'current'); });
test('expired evidence is expired', () => { assert.equal(evaluateEvidenceFreshness(evidence, new Date('2026-09-21T00:00:00Z')), 'expired'); });
test('verified evidence satisfies requirement', () => { assert.equal(evaluateTradeRequirement({ requirement: req, evidence: [evidence], now: new Date('2026-09-16T00:00:00Z') }), TRADE_REQUIREMENT_STATUS.SATISFIED); });
test('missing evidence does not satisfy requirement', () => { assert.equal(evaluateTradeRequirement({ requirement: req, evidence: [], now: new Date('2026-09-16T00:00:00Z') }), TRADE_REQUIREMENT_STATUS.MISSING); });
test('expired evidence does not satisfy requirement', () => { assert.equal(evaluateTradeRequirement({ requirement: req, evidence: [evidence], now: new Date('2026-09-21T00:00:00Z') }), TRADE_REQUIREMENT_STATUS.EXPIRED); });
test('unknown evidence produces review', () => { const unknown = { ...evidence, state: TRADE_EVIDENCE_STATE.UNVERIFIED }; const assessment = buildTradeRequirementAssessment({ requirements: [req], evidence: [unknown], now: new Date('2026-09-16T00:00:00Z') }); assert.equal(assessment.overall, 'REVIEW_REQUIRED'); });
test('missing requirement produces blocked', () => { const assessment = buildTradeRequirementAssessment({ requirements: [req], evidence: [] }); assert.equal(assessment.overall, 'BLOCKED'); });
test('not applicable remains not applicable', () => { const na = { ...req, status: TRADE_REQUIREMENT_STATUS.NOT_APPLICABLE }; assert.equal(evaluateTradeRequirement({ requirement: na, evidence: [] }), TRADE_REQUIREMENT_STATUS.NOT_APPLICABLE); });
test('contract forbids duplicate authorities', () => { const c = tradeRequirementsEvidenceContract(); assert.equal(c.persistence, 'none'); assert.equal(c.mutation, false); assert.equal(c.duplicateComplianceAuthority, false); assert.equal(c.duplicateCustomsAuthority, false); assert.equal(c.duplicateTaxAuthority, false); });
test('contract forbids execution', () => { assert.equal(tradeRequirementsEvidenceContract().execution, false); });
test('unknown is not success', () => { assert.equal(tradeRequirementsEvidenceContract().unknownIsSuccess, false); });
test('assessment is deterministic and derived', () => { const a = buildTradeRequirementAssessment({ requirements: [req], evidence: [evidence], now: new Date('2026-09-16T00:00:00Z') }); assert.equal(a.deterministic, true); assert.equal(a.persistent, false); });
test('evidence remains source-referenced', () => { assert.equal(evidence.source, 'customs-provider'); assert.equal(evidence.sourceReference, 'ref-1'); });
test('failure vocabulary includes review and blocked', () => { const c = tradeRequirementsEvidenceContract(); assert.ok(c.failureStates.includes('REVIEW_REQUIRED')); assert.ok(c.failureStates.includes('BLOCKED')); });
console.log(`PHASE20.7 TRADE REQUIREMENTS/EVIDENCE: ${pass} PASS / 0 FAIL`);
