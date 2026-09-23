import assert from 'node:assert/strict';
import {
  LOGISTICS_NETWORK_CONTRACT_VERSION,
  normalizeLogisticsActor,
  defineLogisticsProvider,
  defineLogisticsAdapter,
  normalizeLogisticsNetworkAssignment,
  logisticsNetworkContract,
} from '../app/src/verticals/logistics/network-contract.js';

const internal = normalizeLogisticsActor({
  id: 'user-1', type: 'internal_logistics_user', organization_id: 'org-1'
});
assert.equal(internal.type, 'internal_logistics_user');
assert.equal(internal.organization_id, 'org-1');

const courier = normalizeLogisticsActor({
  id: 'courier-1', type: 'external_courier', provider_id: 'provider-1', source: 'provider'
});
assert.equal(courier.type, 'external_courier');
assert.equal(courier.provider_id, 'provider-1');

assert.throws(
  () => normalizeLogisticsActor({ id: 'bad', type: 'external_courier' }),
  /require provider_id/
);

const provider = defineLogisticsProvider({
  id: 'provider-1', type: 'courier', name: 'Example Courier',
  capabilities: ['pickup', 'delivery', 'proof'], source: 'provider'
});
assert.equal(provider.persistence, 'none');
assert.equal(provider.credential_authority, 'external_provider_or_existing_secret_boundary');

assert.throws(
  () => defineLogisticsProvider({ id: 'provider-2', type: 'carrier', capabilities: [], token: 'secret' }),
  /cannot contain token/
);

const adapter = defineLogisticsAdapter({
  id: 'example-courier-v1', provider_id: provider.id,
  provider_contract_version: '1.0', operations: ['create_shipment', 'track', 'proof'],
  status: 'declared'
});
assert.equal(adapter.execution, 'translate_and_delegate');
assert.equal(adapter.persistence, 'none');
assert.equal(adapter.authorization, 'existing_authorization');

const assignment = normalizeLogisticsNetworkAssignment({
  shipment_id: 'shipment-1', provider_id: provider.id, actor: courier, source: 'sellify'
});
assert.equal(assignment.authority, 'logistics-pack');
assert.equal(assignment.fulfillment_authority, 'app/src/logistics/fulfillment.js');
assert.match(assignment.idempotency_key, /^logistics-assignment:/);

assert.throws(
  () => normalizeLogisticsNetworkAssignment({
    shipment_id: 'shipment-1', provider_id: 'provider-2', actor: courier
  }),
  /conflicts/
);

const contract = logisticsNetworkContract();
assert.equal(contract.version, LOGISTICS_NETWORK_CONTRACT_VERSION);
assert.equal(contract.provider_registry, 'not_created');
assert.equal(contract.credential_store, 'not_created');
assert.equal(contract.duplicate_domain_authority, false);
assert.equal(contract.network_execution, 'deferred_until_explicit_provider_capability_and_authorization_policy');

console.log('Phase 16.13.1 Logistics Network Contract Regression: PASS');
console.log('Internal + external actor boundary: PASS');
console.log('Provider/adapter no-persistence boundary: PASS');
console.log('Courier/provider conflict and idempotency boundary: PASS');
console.log(`Verified runtime: ${process.version}`);
