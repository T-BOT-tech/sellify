import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CROSS_BORDER_RESULTS,
  CROSS_BORDER_REQUIREMENT_STATUS,
  CROSS_BORDER_FAILURE_STATES,
  CROSS_BORDER_AUTHORITY_MAP,
  buildTradeLane,
  buildCrossBorderOpportunity,
  buildCrossBorderPlan,
  crossBorderContract,
  assertCrossBorderBoundary,
} from '../app/src/cross-border-contract.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let checks = 0;
const ok = (v, m) => { checks += 1; assert.equal(Boolean(v), true, m); };
const eq = (a, b, m) => { checks += 1; assert.deepEqual(a, b, m); };

const contract = assertCrossBorderBoundary();
eq(contract.version, '1.0', 'cross-border contract version');
eq(contract.persistence, 'none', 'no persistence authority');
eq(contract.mutation, 'none', 'no mutation authority');
eq(contract.transactionAuthority, 'existing_domain_transaction', 'existing transaction authority remains canonical');
eq(contract.authorization, 'existing_authorization', 'existing authorization remains canonical');
eq(contract.eventStorage, 'existing_outbox_only', 'existing outbox remains canonical');
eq(contract.providerExecution, 'canonical_contract_to_adapter_to_provider', 'external execution remains adapter controlled');
eq(contract.aiExecution, 'translation_only', 'AI remains translation-only');
eq(contract.discoveryExecution, 'read_only_derived', 'discovery remains read-only and derived');
eq(contract.unknownIsSuccess, false, 'UNKNOWN cannot become SUCCESS');
eq(contract.feasibilityIsAuthorization, false, 'feasibility is not authorization');
eq(contract.authorizationIsExecution, false, 'authorization is not execution');
eq(contract.duplicateAuthority, false, 'duplicate authority is forbidden');

eq(CROSS_BORDER_RESULTS.UNKNOWN, 'unknown', 'unknown feasibility state exists');
eq(CROSS_BORDER_REQUIREMENT_STATUS.EXPIRED, 'expired', 'expired requirement state exists');
eq(CROSS_BORDER_FAILURE_STATES.REVIEW_REQUIRED, 'review_required', 'review-required failure state exists');
eq(CROSS_BORDER_AUTHORITY_MAP.inventory, 'inventory', 'inventory authority remains canonical');
eq(CROSS_BORDER_AUTHORITY_MAP.payments, 'payments', 'payment authority remains canonical');
eq(CROSS_BORDER_AUTHORITY_MAP.fx, 'external_fx_provider_via_adapter', 'FX remains external adapter boundary');

const lane = buildTradeLane({
  origin: 'ET',
  destination: 'KE',
  capabilities: { commerce: 'available', payment: 'review_required' },
  requirements: [{ type: 'customs', status: 'required' }],
  provenance: { source: 'test', reference: 'lane-1' },
});
eq(lane.origin, 'ET', 'trade lane origin');
eq(lane.destination, 'KE', 'trade lane destination');
eq(lane.persistent, false, 'trade lane is non-persistent at 20.1');
eq(lane.authoritative, false, 'trade lane is not legal authority');

const opportunity = buildCrossBorderOpportunity({
  opportunityId: 'cb-op-1',
  discoveryOpportunity: { opportunityId: 'disc-1', derived: true },
  origin: 'ET',
  destination: 'KE',
  productReference: { id: 'product-1', type: 'product' },
  supplierReference: { id: 'supplier-1', type: 'organization' },
  quantity: 100,
  tradeLaneReference: { id: 'ET-KE', type: 'trade_lane' },
});
eq(opportunity.persistent, false, 'opportunity remains derived/non-persistent');
eq(opportunity.createsOrder, false, 'opportunity cannot create an order');
eq(opportunity.mutatesInventory, false, 'opportunity cannot mutate inventory');
eq(opportunity.mutatesPayment, false, 'opportunity cannot mutate payment');

const plan = buildCrossBorderPlan({
  opportunity,
  tradeLane: lane,
  requirements: [{ type: 'customs', status: 'required' }],
  evidence: [{ source: 'test', observedAt: '2026-09-15T00:00:00Z' }],
  feasibility: { result: 'conditionally_feasible' },
  references: { paymentReference: { id: 'pay-1' }, shipmentReference: { id: 'ship-1' } },
});
eq(plan.persistent, false, 'cross-border plan remains derived/non-persistent');
eq(plan.actionExecution, false, 'plan does not execute actions');
eq(plan.owningDomainExecutesActions, true, 'owning domain executes actions');

assert.throws(() => buildTradeLane({ origin: 'ET', destination: 'ET' }), /cross country/i); checks += 1;
assert.throws(() => buildCrossBorderPlan({ opportunity, tradeLane: lane, references: { ownsPayments: true } }), /duplicate authority|cannot declare/i); checks += 1;

const source = read('app/src/cross-border-contract.js');
ok(!/CREATE\s+TABLE|new\s+Database|sqlite|platform[-_]?(store|ledger|database)/i.test(source), '20.1 contract creates no store/database');
ok(!/enqueueEvent\s*\(/.test(source), '20.1 contract does not directly enqueue events');
ok(!/fetch\s*\(|axios|providerCredentials|secret|tokenStore/i.test(source), '20.1 contract does not execute providers or handle credentials');

console.log(`PHASE20.1 CROSS-BORDER CONTRACT: ${checks} PASS / 0 FAIL`);
