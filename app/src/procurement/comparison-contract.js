// Phase 17.4 — deterministic comparison contract.
// This is a declarative consumer contract only; persistence and execution
// remain in the existing backend procurement authority.
export const PROCUREMENT_COMPARISON_CONTRACT_VERSION = '1.0';
export const PROCUREMENT_COMPARISON_POLICY = Object.freeze({
  version: '1.0',
  supplierOrder: ['eligible', 'coverageRatio', 'completeCoverage', 'comparableTotalMinor', 'maxLeadTimeDays', 'validUntil', 'supplierOrganizationName', 'supplierOrganizationId'],
  lineOrder: ['coverageComplete', 'unitPriceMinor', 'leadTimeDays', 'validUntil', 'supplierOrganizationId'],
  comparableCost: 'covered_quantity * unit_price_minor',
  landedCost: false,
  aiRequired: false,
});
export function comparisonContract(){return Object.freeze({version:PROCUREMENT_COMPARISON_CONTRACT_VERSION,authority:'procurement',resource:'procurement_comparison',actions:['view','create'],policy:PROCUREMENT_COMPARISON_POLICY,persistence:'existing procurement authority only'});}

