import assert from 'node:assert/strict';
import {
  normalizeLogisticsServiceDelivery,
  logisticsServiceDeliveryContract,
} from '../app/src/verticals/logistics/service-delivery-model-contract.js';

const instant = normalizeLogisticsServiceDelivery({ item_type: 'service', service_profile: 'B2C_DELIVERY', delivery_model: 'instant' });
assert.equal(instant.delivery_model, 'instant');
assert.equal(instant.customer_commitment, 'check_eligibility_and_availability_before_acceptance');
assert.equal(instant.assignment_guaranteed, false);
assert.equal(instant.persistence, 'none');

const request = normalizeLogisticsServiceDelivery({ itemType: 'service', serviceProfile: 'P2P_DELIVERY', deliveryModel: 'request' });
assert.equal(request.delivery_model, 'request');
assert.equal(request.customer_commitment, 'request_details_and_assess_before_confirmation');
assert.equal(request.order_authority, 'canonical_commerce_order');

assert.throws(() => normalizeLogisticsServiceDelivery({ item_type: 'product', service_profile: 'B2C_DELIVERY', delivery_model: 'instant' }),
  error => error.code === 'LOGISTICS_SERVICE_DELIVERY_REQUIRES_SERVICE');
assert.throws(() => normalizeLogisticsServiceDelivery({ item_type: 'service', service_profile: 'B2C_DELIVERY', delivery_model: 'guaranteed' }), /delivery_model must be one of/);
assert.throws(() => normalizeLogisticsServiceDelivery({ item_type: 'service', service_profile: 'B2C_DELIVERY', delivery_model: 'instant', payment_id: 'client-controlled' }),
  error => error.code === 'LOGISTICS_SERVICE_DELIVERY_AUTHORITY_FIELD_FORBIDDEN');
assert.throws(() => normalizeLogisticsServiceDelivery({ item_type: 'service', service_profile: 'UNSUPPORTED', delivery_model: 'request' }), /Unsupported logistics service profile/);

const contract = logisticsServiceDeliveryContract();
assert.deepEqual(contract.delivery_models, ['request', 'instant']);
assert.equal(contract.creates_order, false);
assert.equal(contract.creates_payment, false);
assert.equal(contract.assigns_courier, false);
console.log('Logistics Service Delivery Model Contract Regression: PASS');
