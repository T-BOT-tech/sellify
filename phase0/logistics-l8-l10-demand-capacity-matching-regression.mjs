import assert from 'node:assert/strict';
import { normalizeLogisticsDemand, logisticsDemandProfileContract } from '../app/src/verticals/logistics/logistics-demand-profile-contract.js';
import { normalizeLogisticsCapacityProfile, logisticsCapacityProfileContract } from '../app/src/verticals/logistics/logistics-capacity-profile-contract.js';
import { matchLogisticsProviders, logisticsProviderMatchingContract } from '../backend/lib/discovery/logistics-provider-matching.js';

const demand = normalizeLogisticsDemand({
  serviceProfile: 'B2C_DELIVERY',
  origin: { geoCode: 'ADDIS_BOLE' },
  destination: { geoCode: 'ADDIS_KIRKOS' },
  timing: { mode: 'immediate' },
  payload: { weightKg: 5 },
  capacityRequirements: { vehicleType: 'motorbike', payloadKg: 10 },
  sourceContext: { source: 'merchant_request' },
});

const capacity = normalizeLogisticsCapacityProfile({
  capacityRef: 'capacity-bike-1',
  organizationId: 'provider-org-1',
  vehicleType: demand.capacity_requirements.vehicleType,
  payloadCapacityKg: 10,
  operatingArea: { geoCode: 'ADDIS_KIRKOS' },
  serviceProfiles: ['B2C_DELIVERY', 'P2P_DELIVERY'],
  providerRef: 'provider-1',
});

const demandContract = logisticsDemandProfileContract();
const capacityContract = logisticsCapacityProfileContract();
const matchingContract = logisticsProviderMatchingContract();

assert.equal(demandContract.matching_authority, 'existing_discovery_matching');
assert.equal(capacityContract.matching_authority, 'existing_discovery_matching');
assert.equal(matchingContract.authority, 'discovery_matching');
assert.equal(matchingContract.duplicate_matching_authority, false);
assert.equal(demandContract.selection, false);
assert.equal(capacityContract.provider_selection, false);
assert.equal(capacityContract.assignment, false);
assert.equal(capacityContract.dispatch_execution, false);

const result = matchLogisticsProviders([
  {
    providerId: capacity.provider_ref,
    name: 'Provider One',
    capabilities: ['delivery'],
    serviceAreas: [{ geoCode: 'ADDIS_KIRKOS', countryCode: 'ET' }],
    capacitySignals: [{
      subjectId: 'parcel',
      quantity: capacity.payload_capacity_kg,
      unit: 'kg',
    }],
    relationshipActive: true,
  },
], {
  capability: 'delivery',
  geoCode: demand.destination.geoCode,
  minimumQuantity: demand.payload.weightKg,
  unit: 'kg',
  productId: 'parcel',
});

assert.equal(result.authority, 'discovery_matching');
assert.equal(result.selection, 'not_performed');
assert.equal(result.authorization, 'not_performed');
assert.equal(result.execution, false);
assert.equal(result.persistence, 'none');
assert.equal(result.provider_state, 'not_owned');
assert.equal(result.credentials, 'not_owned');
assert.equal(result.candidates.length, 1);
assert.equal(result.candidates[0].match.eligible, true);

const spoof = () => matchLogisticsProviders([{
  providerId: 'spoof-provider',
  name: 'Spoof',
  capabilities: ['delivery'],
  serviceAreas: [{ geoCode: 'ADDIS_KIRKOS' }],
  capacitySignals: [{ subjectId: 'parcel', quantity: 100, unit: 'kg' }],
}], {
  capability: 'delivery',
  geoCode: 'ADDIS_KIRKOS',
  minimumQuantity: 5,
  unit: 'kg',
  productId: 'parcel',
});
const spoofResult = spoof();
assert.equal(spoofResult.selection, 'not_performed');
assert.equal(spoofResult.authorization, 'not_performed');
assert.equal(spoofResult.execution, false);

for (const [name, value] of Object.entries({
  orderAuthority: demandContract.order_authority,
  shipmentAuthority: demandContract.shipment_authority,
  inventoryMutation: demandContract.inventory_mutation,
  paymentMutation: demandContract.payment_mutation,
  duplicateCapacityLedger: capacityContract.duplicate_capacity_ledger,
  duplicateMatchingAuthority: capacityContract.duplicate_matching_authority,
})) {
  assert.equal(value, false, name + ' must remain disabled');
}

console.log('L8-L10 Logistics Demand → Capacity → Discovery Matching Gate: PASS');
