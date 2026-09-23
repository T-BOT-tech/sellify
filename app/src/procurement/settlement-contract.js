// Phase 17.9 — Procurement settlement contract.
// Settlement is a Payment Core allocation/reconciliation capability. It does
// not create a procurement ledger and does not reuse Marketplace settlement
// semantics.
export const PROCUREMENT_SETTLEMENT_CONTRACT_VERSION = '1.0';
export const PROCUREMENT_SETTLEMENT_CONTRACT = Object.freeze({
  version: PROCUREMENT_SETTLEMENT_CONTRACT_VERSION,
  authority: 'payments',
  capability: 'payments.procurement-settlement',
  source: 'payment.outbound',
  prerequisites: Object.freeze(['approved_procurement_po','confirmed_outbound_payment','same_organization','matching_currency','no_over_allocation']),
  lifecycle: Object.freeze(['OPEN','PARTIALLY_SETTLED','SETTLED','CANCELLED']),
  statusDerivedFromAllocations: true,
  partialPayments: true,
  paymentExecutionEqualsSettlement: false,
  createsSecondLedger: false,
  copiesMarketplaceSettlement: false,
  mutatesInventory: false,
  mutatesOrder: false,
  createsInvoice: false,
  aiRequired: false,
});
export function procurementSettlementContract(){ return PROCUREMENT_SETTLEMENT_CONTRACT; }
