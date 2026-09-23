import assert from 'node:assert/strict';
import {
  definePlatformAdapter,
  registerPlatformAdapter,
  getPlatformAdapter,
  listPlatformAdapters,
  resolveAdapterBoundary,
  platformAdapterContract,
  assertAdapterBoundary,
} from '../app/src/platform/adapter-framework.js';

let pass = 0;
const test = (name, fn) => { fn(); pass += 1; console.log(`PASS ${name}`); };
const throwsCode = (fn, code) => assert.throws(fn, (e) => e.code === code);

test('contract version', () => assert.equal(platformAdapterContract().version, '1.0'));
test('canonical flow', () => assert.equal(platformAdapterContract().flow, 'canonical_capability_to_adapter_to_external_provider'));
test('no persistence', () => assert.equal(platformAdapterContract().persistence, 'none'));
test('existing transaction authority', () => assert.equal(platformAdapterContract().transactionAuthority, 'existing_domain_transaction'));
test('existing authorization', () => assert.equal(platformAdapterContract().authorization, 'existing_authorization'));
test('no duplicate authority', () => assert.equal(platformAdapterContract().duplicateAuthority, false));
test('no duplicate ledger', () => assert.equal(platformAdapterContract().duplicateLedger, false));
test('no duplicate event store', () => assert.equal(platformAdapterContract().duplicateEventStore, false));
test('valid payment adapter', () => {
  const a = definePlatformAdapter({ id:'mpesa-adapter', capability:'payments.core', provider:'mpesa', operations:['verify','initiate'], status:'deferred' });
  assert.equal(a.authority, 'payments');
});
test('valid inventory adapter', () => assert.equal(definePlatformAdapter({ id:'inventory-x', capability:'inventory.stock', provider:'external-warehouse', operations:['sync'], status:'declared' }).authority, 'inventory'));
test('capability must resolve', () => throwsCode(() => definePlatformAdapter({ id:'x', capability:'unknown.x', provider:'p', operations:[] }), 'PLATFORM_AUTHORITY_UNRESOLVED'));
test('provider required', () => throwsCode(() => definePlatformAdapter({ id:'x', capability:'payments.core', operations:[] }), 'PLATFORM_ADAPTER_INVALID'));
test('id required', () => throwsCode(() => definePlatformAdapter({ capability:'payments.core', provider:'p', operations:[] }), 'PLATFORM_ADAPTER_INVALID'));
test('operations array', () => throwsCode(() => definePlatformAdapter({ id:'x', capability:'payments.core', provider:'p', operations:'verify' }), 'PLATFORM_ADAPTER_INVALID'));
test('duplicate operations rejected', () => throwsCode(() => definePlatformAdapter({ id:'x', capability:'payments.core', provider:'p', operations:['verify','VERIFY'] }), 'PLATFORM_ADAPTER_INVALID'));
test('invalid status rejected', () => throwsCode(() => definePlatformAdapter({ id:'x', capability:'payments.core', provider:'p', operations:[], status:'live' }), 'PLATFORM_ADAPTER_INVALID'));
test('database claim rejected', () => throwsCode(() => definePlatformAdapter({ id:'x', capability:'payments.core', provider:'p', operations:[], ownsDatabase:true }), 'PLATFORM_ADAPTER_INVALID'));
test('ledger claim rejected', () => throwsCode(() => definePlatformAdapter({ id:'x', capability:'payments.core', provider:'p', operations:[], ownsLedger:true }), 'PLATFORM_ADAPTER_INVALID'));
test('authorization claim rejected', () => throwsCode(() => definePlatformAdapter({ id:'x', capability:'payments.core', provider:'p', operations:[], ownsAuthorization:true }), 'PLATFORM_ADAPTER_INVALID'));
test('persistence claim rejected', () => throwsCode(() => definePlatformAdapter({ id:'x', capability:'payments.core', provider:'p', operations:[], persistence:'sqlite' }), 'PLATFORM_ADAPTER_INVALID'));
test('transaction claim rejected', () => throwsCode(() => definePlatformAdapter({ id:'x', capability:'payments.core', provider:'p', operations:[], transactionAuthority:'adapter' }), 'PLATFORM_ADAPTER_INVALID'));
test('authorization mode rejected', () => throwsCode(() => definePlatformAdapter({ id:'x', capability:'payments.core', provider:'p', operations:[], authorization:'adapter' }), 'PLATFORM_ADAPTER_INVALID'));
test('register adapter', () => { const a = registerPlatformAdapter({ id:'test-provider-adapter', capability:'payments.core', provider:'test-provider', operations:['verify'] }); assert.equal(a.id, 'test-provider-adapter'); });
test('get adapter', () => assert.equal(getPlatformAdapter('TEST-PROVIDER-ADAPTER').provider, 'test-provider'));
test('list adapter', () => assert.ok(listPlatformAdapters().some(a => a.id === 'test-provider-adapter')));
test('duplicate registration rejected', () => throwsCode(() => registerPlatformAdapter({ id:'test-provider-adapter', capability:'payments.core', provider:'test-provider', operations:['verify'] }), 'PLATFORM_ADAPTER_ALREADY_REGISTERED'));
test('replace registration', () => assert.equal(registerPlatformAdapter({ id:'test-provider-adapter', capability:'payments.core', provider:'test-provider-v2', operations:['verify','getStatus'] }, { replace:true }).provider, 'test-provider-v2'));
test('boundary resolution', () => { const b = resolveAdapterBoundary('test-provider-adapter'); assert.equal(b.capability.capability, 'payments.core'); assert.equal(b.authority.authority, 'payments'); });
test('unknown adapter rejected', () => throwsCode(() => resolveAdapterBoundary('does-not-exist'), 'PLATFORM_ADAPTER_UNKNOWN'));
test('boundary assertion', () => assert.equal(assertAdapterBoundary({ id:'assert-x', capability:'commerce.orders', provider:'marketplace', operations:['push'] }), true));
test('metadata-only registry', () => assert.equal(platformAdapterContract().registry, 'process_local_metadata_only'));
test('outbox-only event storage', () => assert.equal(platformAdapterContract().eventStorage, 'existing_outbox_only'));

console.log(`PHASE16.3_RESULT ${pass} PASS / 0 FAIL`);
