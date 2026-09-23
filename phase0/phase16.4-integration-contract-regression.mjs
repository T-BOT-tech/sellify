import assert from 'node:assert/strict';
import {
  definePlatformIntegration, registerPlatformIntegration, getPlatformIntegration,
  listPlatformIntegrations, resolveIntegrationBoundary, platformIntegrationContract,
  assertIntegrationBoundary,
} from '../app/src/platform/integration-contract.js';
import { registerPlatformAdapter } from '../app/src/platform/adapter-framework.js';

let pass = 0;
const check = (condition, message) => { assert.equal(Boolean(condition), true, message); pass += 1; };
const throwsCode = (fn, code, message) => { assert.throws(fn, (e) => e?.code === code, message); pass += 1; };

check(platformIntegrationContract().version === '1.0', 'contract version');
check(platformIntegrationContract().persistence === 'none', 'no persistence');
check(platformIntegrationContract().transactionAuthority === 'existing_domain_transaction', 'existing transaction authority');
check(platformIntegrationContract().authorization === 'existing_authorization', 'existing authorization');
check(platformIntegrationContract().eventStorage === 'existing_outbox_only', 'existing outbox only');
check(platformIntegrationContract().duplicateAuthority === false, 'no duplicate authority');
check(platformIntegrationContract().duplicatePersistence === false, 'no duplicate persistence');
check(platformIntegrationContract().duplicateLedger === false, 'no duplicate ledger');
check(platformIntegrationContract().duplicateEventStore === false, 'no duplicate event store');

const inbound = definePlatformIntegration({
  id: 'b2b-order-int', source: 'external-buyer', target: 'sellify', capability: 'commerce.orders',
  direction: 'inbound', operations: ['create', 'read'], scope: 'tenant_scoped', status: 'declared',
});
check(inbound.authority === 'commerce', 'orders authority');
check(inbound.persistence === 'none', 'inbound persistence none');
check(inbound.transactionAuthority === 'existing_domain_transaction', 'inbound transaction boundary');
check(inbound.authorization === 'existing_authorization', 'inbound authorization boundary');
check(inbound.eventStorage === 'existing_outbox_only', 'inbound event boundary');
check(inbound.direction === 'inbound', 'inbound direction');
check(inbound.scope === 'tenant_scoped', 'tenant scope');
check(inbound.operations.length === 2, 'operations preserved');

const adapter = registerPlatformAdapter({
  id: 'test-orders-provider', capability: 'commerce.orders', provider: 'test-provider',
  version: '1', operations: ['create'], status: 'declared', persistence: 'none',
  transactionAuthority: 'existing_domain_transaction', authorization: 'existing_authorization',
});
check(adapter.id === 'test-orders-provider', 'adapter registered');

const outbound = definePlatformIntegration({
  id: 'orders-provider-sync', source: 'sellify', target: 'test-provider', capability: 'commerce.orders',
  direction: 'outbound', operations: ['create'], adapterId: 'test-orders-provider',
  scope: 'tenant_scoped', status: 'active',
});
check(outbound.adapterId === 'test-orders-provider', 'adapter link');
check(outbound.status === 'active', 'active status');

const registered = registerPlatformIntegration(outbound);
check(registered.id === 'orders-provider-sync', 'integration registered');
check(getPlatformIntegration('orders-provider-sync')?.id === 'orders-provider-sync', 'integration lookup');
check(listPlatformIntegrations().length === 1, 'integration listing');

const boundary = resolveIntegrationBoundary('orders-provider-sync');
check(boundary.adapter?.id === 'test-orders-provider', 'boundary adapter');
check(boundary.authority.authority === 'commerce', 'boundary authority');
check(boundary.persistence === 'none', 'boundary persistence');
check(boundary.execution === 'integration_to_adapter_to_existing_authority', 'boundary execution');
check(assertIntegrationBoundary(outbound) === true, 'boundary assertion');

throwsCode(() => definePlatformIntegration({ id: '', source: 'a', target: 'b', capability: 'commerce.orders' }), 'PLATFORM_INTEGRATION_INVALID', 'empty id rejected');
throwsCode(() => definePlatformIntegration({ id: 'x', source: 'a', target: 'b', capability: 'commerce.orders', direction: 'sideways' }), 'PLATFORM_INTEGRATION_INVALID', 'invalid direction rejected');
throwsCode(() => definePlatformIntegration({ id: 'x', source: 'a', target: 'b', capability: 'commerce.orders', persistence: 'sqlite' }), 'PLATFORM_INTEGRATION_INVALID', 'persistence claim rejected');
throwsCode(() => definePlatformIntegration({ id: 'x', source: 'a', target: 'b', capability: 'commerce.orders', ownsPayments: true }), 'PLATFORM_INTEGRATION_INVALID', 'forbidden authority claim rejected');
throwsCode(() => definePlatformIntegration({ id: 'x', source: 'a', target: 'b', capability: 'commerce.orders', adapterId: 'missing-adapter' }), 'PLATFORM_INTEGRATION_ADAPTER_UNKNOWN', 'unknown adapter rejected');
throwsCode(() => definePlatformIntegration({ id: 'x', source: 'a', target: 'b', capability: 'missing.capability' }), 'PLATFORM_CAPABILITY_UNKNOWN', 'unknown capability rejected');
throwsCode(() => registerPlatformIntegration(outbound), 'PLATFORM_INTEGRATION_ALREADY_REGISTERED', 'duplicate integration rejected');
throwsCode(() => resolveIntegrationBoundary('missing-integration'), 'PLATFORM_INTEGRATION_UNKNOWN', 'unknown integration rejected');

console.log(`Phase 16.4 Integration Contract Regression: ${pass} PASS / 0 FAIL`);
