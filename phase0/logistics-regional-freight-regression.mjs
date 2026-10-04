import assert from 'node:assert/strict';
import { normalizeRegionalFreightRequest, validateRegionalFreightFlow, assertRegionalFreightBoundary, regionalFreightContract } from '../app/src/verticals/logistics/regional-freight-contract.js';

const c = regionalFreightContract();
assert.equal(c.version, '1.0');
assert.deepEqual(c.stages, ['DEMAND','CAPACITY','CORRIDOR','MATCHING','SELECTION','ASSIGNMENT','LOADING','MOVEMENT','CHECKPOINT','ARRIVAL','PROOF']);
assert.equal(c.service_profile, 'REGIONAL_FREIGHT');
assert.equal(c.payment_authority, 'payments');
assert.equal(c.inventory_authority, 'inventory');
assert.equal(c.fulfillment_authority, 'existing_core_fulfillment');
assert.equal(c.shipment_authority, 'existing_core_order');

const request = normalizeRegionalFreightRequest({
  organizationId: 'org-1', demandRef: 'demand-1', originRef: 'loc-a',
  destinationRef: 'loc-b', cargoRef: 'cargo-1',
});
assert.equal(request.stage, 'DEMAND');
assert.equal(request.service_profile, 'REGIONAL_FREIGHT');

const parts = { capacity:{}, corridor:{}, matching:{}, selection:{}, assignment:{}, loading:{}, movement:{}, checkpoint:{}, arrival:{}, proof:{} };
assert.equal(validateRegionalFreightFlow({ request, ...parts }).valid, true);
assert.equal(validateRegionalFreightFlow({ request, ...parts, checkpoint: null }).reason, 'REGIONAL_FREIGHT_CHECKPOINT_REQUIRED');
assert.throws(() => normalizeRegionalFreightRequest({ organizationId:'org-1' }), /demand_ref/);

assert.deepEqual(assertRegionalFreightBoundary(), { valid:true, reason:'REGIONAL_FREIGHT_BOUNDARY_VALIDATED' });
for (const [key, reason] of [
  ['createsOrderAuthority','DUPLICATE_ORDER_AUTHORITY_FORBIDDEN'],
  ['createsShipmentAuthority','DUPLICATE_SHIPMENT_AUTHORITY_FORBIDDEN'],
  ['createsInventoryAuthority','DUPLICATE_INVENTORY_AUTHORITY_FORBIDDEN'],
  ['createsFulfillmentAuthority','DUPLICATE_FULFILLMENT_AUTHORITY_FORBIDDEN'],
  ['createsPaymentAuthority','DUPLICATE_PAYMENT_AUTHORITY_FORBIDDEN'],
  ['createsProviderRegistry','DUPLICATE_PROVIDER_REGISTRY_FORBIDDEN'],
  ['createsRouteEngine','ROUTE_ENGINE_FORBIDDEN'],
  ['mutatesStockOutsideInventory','STOCK_MUTATION_OUTSIDE_INVENTORY_FORBIDDEN'],
  ['mutatesFulfillmentOutsideCore','FULFILLMENT_MUTATION_OUTSIDE_CORE_FORBIDDEN'],
  ['mutatesPaymentOutsidePayments','PAYMENT_MUTATION_OUTSIDE_PAYMENTS_FORBIDDEN'],
]) assert.equal(assertRegionalFreightBoundary({[key]:true}).reason, reason);

console.log('L15 Regional Freight Product Boundary Regression: PASS');
