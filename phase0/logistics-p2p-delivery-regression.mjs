import assert from 'node:assert/strict';
import { normalizeP2PDeliveryRequest, validateP2PDeliveryFlow, assertP2PDeliveryBoundary, p2pDeliveryContract } from '../app/src/verticals/logistics/p2p-delivery-contract.js';

const c=p2pDeliveryContract();
assert.equal(c.version,'1.0');
assert.deepEqual(c.stages,['P2P_REQUEST','SENDER_VERIFICATION','RECIPIENT_CONTEXT','ITEM_REQUIREMENTS','COURIER_ELIGIBILITY','CAPACITY_MATCHING','ASSIGNMENT','PICKUP_OTP','MOVEMENT','DELIVERY_OTP','PROOF']);
assert.equal(c.service_profile,'P2P_DELIVERY');
assert.equal(c.sender_verification_authority,'identity_compliance');
assert.equal(c.movement_authority,'existing_movement');
assert.equal(c.proof_authority,'existing_delivery_proof');

const request=normalizeP2PDeliveryRequest({
  organizationId:'org-1',requestRef:'p2p-1',senderRef:'sender-1',
  recipientRef:'recipient-1',destinationRef:'loc-2',
});
const parts={senderVerification:{},recipientContext:{},itemRequirements:{},courierEligibility:{},capacityMatching:{},assignment:{},pickupOtp:{},movement:{},deliveryOtp:{},proof:{}};
assert.equal(validateP2PDeliveryFlow({request,...parts}).valid,true);
assert.equal(validateP2PDeliveryFlow({request,...parts,movement:null}).reason,'P2P_DELIVERY_MOVEMENT_REQUIRED');
assert.throws(()=>normalizeP2PDeliveryRequest({organizationId:'org-1'}),/request_ref/);

assert.deepEqual(assertP2PDeliveryBoundary(),{valid:true,reason:'P2P_DELIVERY_BOUNDARY_VALIDATED'});
assert.equal(assertP2PDeliveryBoundary({senderVerificationAuthority:'logistics-pack'}).reason,'SENDER_VERIFICATION_MUST_USE_IDENTITY_COMPLIANCE');

for(const [key,reason] of [
 ['createsP2POrderAuthority','DUPLICATE_P2P_ORDER_AUTHORITY_FORBIDDEN'],
 ['createsIdentityAuthority','DUPLICATE_IDENTITY_AUTHORITY_FORBIDDEN'],
 ['createsRecipientAuthority','DUPLICATE_RECIPIENT_AUTHORITY_FORBIDDEN'],
 ['createsItemRegistry','DUPLICATE_ITEM_REGISTRY_FORBIDDEN'],
 ['createsCourierRegistry','DUPLICATE_COURIER_REGISTRY_FORBIDDEN'],
 ['createsCapacityAuthority','DUPLICATE_CAPACITY_AUTHORITY_FORBIDDEN'],
 ['createsShipmentAuthority','DUPLICATE_SHIPMENT_AUTHORITY_FORBIDDEN'],
 ['createsProofAuthority','DUPLICATE_PROOF_AUTHORITY_FORBIDDEN'],
 ['createsFulfillmentAuthority','DUPLICATE_FULFILLMENT_AUTHORITY_FORBIDDEN'],
 ['createsPaymentAuthority','DUPLICATE_PAYMENT_AUTHORITY_FORBIDDEN'],
 ['createsP2PLedger','P2P_LEDGER_FORBIDDEN'],
 ['createsRouteAuthority','ROUTE_AUTHORITY_FORBIDDEN'],
 ['createsGpsAuthority','GPS_AUTHORITY_FORBIDDEN'],
]) assert.equal(assertP2PDeliveryBoundary({[key]:true}).reason,reason);

console.log('L18 P2P Delivery Product Boundary Regression: PASS');
