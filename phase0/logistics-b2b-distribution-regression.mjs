import assert from 'node:assert/strict';
import { normalizeB2BDistributionRequest, validateB2BDistributionFlow, assertB2BDistributionBoundary, b2bDistributionContract } from '../app/src/verticals/logistics/b2b-distribution-contract.js';

const c=b2bDistributionContract();
assert.equal(c.version,'1.0');
assert.deepEqual(c.stages,['RESTOCK_REQUEST','COMMERCE_CONTEXT','INVENTORY','FULFILLMENT','CAPACITY_MATCHING','ASSIGNMENT','DELIVERY','RECEIVER_CONFIRMATION']);
assert.equal(c.service_profile,'B2B_DISTRIBUTION');
assert.equal(c.commerce_authority,'commerce');
assert.equal(c.inventory_authority,'inventory');
assert.equal(c.fulfillment_authority,'existing_core_fulfillment');
assert.equal(c.payment_authority,'payments');

const request=normalizeB2BDistributionRequest({
 organizationId:'org-1',restockRef:'restock-1',commerceRef:'order-1',
 inventoryRef:'inventory-1',fulfillmentRef:'fulfillment-1',destinationRef:'loc-2'
});
assert.equal(request.stage,'RESTOCK_REQUEST');
assert.equal(request.service_profile,'B2B_DISTRIBUTION');
const parts={commerceContext:{},inventory:{},fulfillment:{},capacityMatching:{},assignment:{},delivery:{},receiverConfirmation:{}};
assert.equal(validateB2BDistributionFlow({request,...parts}).valid,true);
assert.equal(validateB2BDistributionFlow({request,...parts,delivery:null}).reason,'B2B_DISTRIBUTION_DELIVERY_REQUIRED');
assert.throws(()=>normalizeB2BDistributionRequest({organizationId:'org-1'}),/restock_ref/);

assert.deepEqual(assertB2BDistributionBoundary(),{valid:true,reason:'B2B_DISTRIBUTION_BOUNDARY_VALIDATED'});
for(const [key,reason] of [
 ['createsOrderAuthority','DUPLICATE_ORDER_AUTHORITY_FORBIDDEN'],
 ['createsInventoryAuthority','DUPLICATE_INVENTORY_AUTHORITY_FORBIDDEN'],
 ['createsFulfillmentAuthority','DUPLICATE_FULFILLMENT_AUTHORITY_FORBIDDEN'],
 ['createsPaymentAuthority','DUPLICATE_PAYMENT_AUTHORITY_FORBIDDEN'],
 ['createsCustomerAuthority','DUPLICATE_CUSTOMER_AUTHORITY_FORBIDDEN'],
 ['createsLocationAuthority','DUPLICATE_LOCATION_AUTHORITY_FORBIDDEN'],
 ['mutatesStockOutsideInventory','STOCK_MUTATION_OUTSIDE_INVENTORY_FORBIDDEN'],
 ['mutatesFulfillmentOutsideCore','FULFILLMENT_MUTATION_OUTSIDE_CORE_FORBIDDEN'],
 ['mutatesPaymentOutsidePayments','PAYMENT_MUTATION_OUTSIDE_PAYMENTS_FORBIDDEN'],
 ['createsDistributionLedger','DISTRIBUTION_LEDGER_FORBIDDEN'],
]) assert.equal(assertB2BDistributionBoundary({[key]:true}).reason,reason);

console.log('L16 B2B Distribution Product Boundary Regression: PASS');
