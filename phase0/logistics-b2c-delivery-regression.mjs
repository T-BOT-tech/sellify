import assert from 'node:assert/strict';
import { normalizeB2CDeliveryRequest, validateB2CDeliveryFlow, assertB2CDeliveryBoundary, b2cDeliveryContract } from '../app/src/verticals/logistics/b2c-delivery-contract.js';

const c=b2cDeliveryContract();
assert.equal(c.version,'1.0');
assert.deepEqual(c.stages,['MERCHANT_ORDER','DELIVERY_REQUEST','DESTINATION_CONTEXT','CAPACITY_MATCHING','NEARBY_COURIER','ASSIGNMENT','TRACKING','OTP_PROOF','EXISTING_FULFILLMENT']);
assert.equal(c.service_profile,'B2C_DELIVERY');
assert.equal(c.order_authority,'commerce');
assert.equal(c.destination_authority,'locations');
assert.equal(c.courier_authority,'logistics-pack');
assert.equal(c.tracking_authority,'existing_core_order');
assert.equal(c.proof_authority,'existing_delivery_proof');
assert.equal(c.fulfillment_authority,'existing_core_fulfillment');

const request=normalizeB2CDeliveryRequest({organizationId:'org-1',merchantOrderRef:'order-1',deliveryRequestRef:'delivery-1',destinationRef:'loc-2'});
assert.equal(request.stage,'MERCHANT_ORDER');
assert.equal(request.service_profile,'B2C_DELIVERY');
const parts={deliveryRequest:{},destinationContext:{},capacityMatching:{},nearbyCourier:{},assignment:{},tracking:{},otpProof:{},existingFulfillment:{}};
assert.equal(validateB2CDeliveryFlow({request,...parts}).valid,true);
assert.equal(validateB2CDeliveryFlow({request,...parts,otpProof:null}).reason,'B2C_DELIVERY_OTP_PROOF_REQUIRED');
assert.throws(()=>normalizeB2CDeliveryRequest({organizationId:'org-1'}),/merchant_order_ref/);

assert.deepEqual(assertB2CDeliveryBoundary(),{valid:true,reason:'B2C_DELIVERY_BOUNDARY_VALIDATED'});
for(const [key,reason] of [
 ['createsOrderAuthority','DUPLICATE_ORDER_AUTHORITY_FORBIDDEN'],
 ['createsLocationAuthority','DUPLICATE_LOCATION_AUTHORITY_FORBIDDEN'],
 ['createsCourierRegistry','DUPLICATE_COURIER_REGISTRY_FORBIDDEN'],
 ['createsShipmentAuthority','DUPLICATE_SHIPMENT_AUTHORITY_FORBIDDEN'],
 ['createsProofAuthority','DUPLICATE_PROOF_AUTHORITY_FORBIDDEN'],
 ['createsFulfillmentAuthority','DUPLICATE_FULFILLMENT_AUTHORITY_FORBIDDEN'],
 ['createsInventoryAuthority','DUPLICATE_INVENTORY_AUTHORITY_FORBIDDEN'],
 ['createsPaymentAuthority','DUPLICATE_PAYMENT_AUTHORITY_FORBIDDEN'],
 ['mutatesStockOutsideInventory','STOCK_MUTATION_OUTSIDE_INVENTORY_FORBIDDEN'],
 ['mutatesFulfillmentOutsideCore','FULFILLMENT_MUTATION_OUTSIDE_CORE_FORBIDDEN'],
 ['mutatesPaymentOutsidePayments','PAYMENT_MUTATION_OUTSIDE_PAYMENTS_FORBIDDEN'],
]) assert.equal(assertB2CDeliveryBoundary({[key]:true}).reason,reason);

console.log('L17 B2C Delivery Product Boundary Regression: PASS');
