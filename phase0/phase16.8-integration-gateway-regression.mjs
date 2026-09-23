import assert from 'node:assert/strict';
import { AUTHZ } from '../backend/lib/authorization.js';
import {
  registerPlatformIntegration,
  getPlatformIntegration,
} from '../app/src/platform/integration-contract.js';
import {
  validateIntegrationGatewayRequest,
  resolveIntegrationGatewayRequest,
  executeIntegrationGatewayRequest,
  platformIntegrationGatewayContract,
  assertIntegrationGatewayBoundary,
} from '../app/src/platform/integration-gateway.js';

let passed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) { console.error(`FAIL ${name}: ${error.message}`); process.exitCode = 1; throw error; }
}


const integrationId = 'phase16.8.orders.inbound';
if (!getPlatformIntegration(integrationId)) {
  registerPlatformIntegration({
    id: integrationId,
    source: 'external.test.consumer',
    target: 'sellify.orders',
    capability: 'commerce.orders',
    version: '1.0',
    direction: 'inbound',
    operations: ['view'],
    status: 'active',
    scope: 'tenant_scoped',
    persistence: 'none',
    transactionAuthority: 'existing_domain_transaction',
    authorization: 'existing_authorization',
    eventStorage: 'existing_outbox_only',
  });
}

async function main() {
await check('gateway contract is non-owning', () => {
  const c = platformIntegrationGatewayContract();
  assert.equal(c.persistence, 'none');
  assert.equal(c.providerExecution, 'outside_gateway');
  assert.equal(c.duplicateDomainAuthority, false);
});
await check('boundary assertion passes', () => assertIntegrationGatewayBoundary());
await check('request normalization works', () => {
  const r = validateIntegrationGatewayRequest({ integrationId: integrationId.toUpperCase(), action: ' VIEW ', context: { tenantId: 't1' }, payload: {} });
  assert.equal(r.integrationId, integrationId);
  assert.equal(r.action, 'view');
});
await check('tenant scope is required', () => assert.throws(() => resolveIntegrationGatewayRequest({ integrationId, action: 'view', context: {} }), /tenant-scoped/));
await check('unknown integration fails closed', () => assert.throws(() => resolveIntegrationGatewayRequest({ integrationId: 'unknown', action: 'view', context: { tenantId: 't1' } }), /unknown integration/));
await check('undeclared operation fails closed', () => assert.throws(() => resolveIntegrationGatewayRequest({ integrationId, action: 'delete', context: { tenantId: 't1' } }), /not declared/));
await check('forbidden storage input fails closed', () => assert.throws(() => validateIntegrationGatewayRequest({ integrationId, action: 'view', database: {} }), /database/));
await check('capability action mismatch fails closed', () => {
  registerPlatformIntegration({ id: 'phase16.8.invalid-action', source: 'x', target: 'y', capability: 'commerce.orders', direction: 'inbound', operations: ['manage'], status: 'active', scope: 'tenant_scoped' });
  assert.throws(() => resolveIntegrationGatewayRequest({ integrationId: 'phase16.8.invalid-action', action: 'manage', context: { tenantId: 't1' } }), /not exposed/);
});
await check('authorization is mandatory', async () => {
  await assert.rejects(() => executeIntegrationGatewayRequest({ integrationId, action: 'view', context: { tenantId: 't1', actor: { userId: 'u1', role: 'viewer' } } }, { capabilityHandlers: { 'commerce.orders': async () => ({ ok: true }) } }), /authorization function is required/);
});
await check('authorization denial fails closed', async () => {
  await assert.rejects(() => executeIntegrationGatewayRequest({ integrationId, action: 'view', context: { tenantId: 't1', actor: { userId: 'u1', role: 'viewer' } } }, { authorize: () => AUTHZ.DENY, capabilityHandlers: { 'commerce.orders': async () => ({ ok: true }) } }), /Authorization denied/);
});
await check('authorized delegation reaches injected existing handler', async () => {
  let called = false;
  const result = await executeIntegrationGatewayRequest({ integrationId, action: 'view', context: { tenantId: 't1', actor: { userId: 'u1', role: 'owner', organizationId: 't1' } }, payload: { orderId: 'o1' } }, {
    authorize: () => AUTHZ.ALLOW,
    capabilityHandlers: { 'commerce.orders': async ({ action, payload }) => { called = true; return { action, payload }; } },
  });
  assert.equal(called, true);
  assert.equal(result.authority, 'commerce');
  assert.equal(result.persistence, 'none');
  assert.deepEqual(result.result.payload, { orderId: 'o1' });
});
await check('gateway never owns transaction/persistence/event infrastructure', () => {
  const c = platformIntegrationGatewayContract();
  assert.equal(c.transactionAuthority, 'existing_domain_transaction');
  assert.equal(c.eventStorage, 'existing_outbox_only');
  assert.equal(c.credentials, 'never_owned_or_stored');
});

  console.log(`Phase 16.8 regression: ${passed} PASS / 0 FAIL`);
}

main().catch(() => { process.exitCode = 1; });
