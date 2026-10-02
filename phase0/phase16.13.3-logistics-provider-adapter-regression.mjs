import assert from 'node:assert/strict';
import {
  defineLogisticsProviderAdapter,
  logisticsProviderAdapterContract,
  assertLogisticsProviderAdapterBoundary,
} from '../app/src/verticals/logistics/provider-adapter-contract.js';
import {
  registerPlatformAdapter,
  registerPlatformAdapterExecution,
  executePlatformAdapter,
  resolveAdapterBoundary,
} from '../app/src/platform/adapter-framework.js';

let pass = 0;
const test = (name, fn) => { fn(); pass += 1; console.log(`PASS ${name}`); };
const throwsCode = (fn, code) => assert.throws(fn, (e) => e.code === code);

test('contract version', () => assert.equal(logisticsProviderAdapterContract().version, '1.0'));
test('canonical logistics authority', () => assert.equal(logisticsProviderAdapterContract().canonical_authority, 'logistics'));
test('fulfillment remains existing authority', () => assert.equal(logisticsProviderAdapterContract().fulfillment_authority, 'app/src/logistics/fulfillment.js'));
test('no persistence', () => assert.equal(logisticsProviderAdapterContract().persistence, 'none'));
test('existing authorization', () => assert.equal(logisticsProviderAdapterContract().authorization, 'backend/lib/authorization.js'));
test('no provider selection', () => assert.equal(logisticsProviderAdapterContract().provider_selection, false));
test('valid adapter', () => {
  const a = defineLogisticsProviderAdapter({ id:'local-courier-adapter', provider:'local-courier', provider_type:'courier', operations:['pickup','delivery','tracking'], status:'declared' });
  assert.equal(a.capability, 'logistics.operations');
  assert.equal(a.canonical_authority, 'logistics');
  assert.deepEqual(a.operations, ['pickup','delivery','tracking']);
});
test('unsupported operation rejected', () => throwsCode(() => defineLogisticsProviderAdapter({ id:'x', provider:'p', operations:['teleport'] }), 'LOGISTICS_PROVIDER_ADAPTER_INVALID'));
test('credentials rejected', () => throwsCode(() => defineLogisticsProviderAdapter({ id:'x', provider:'p', operations:[], credentials:{token:'x'} }), 'LOGISTICS_PROVIDER_ADAPTER_INVALID'));
test('database claim rejected', () => throwsCode(() => defineLogisticsProviderAdapter({ id:'x', provider:'p', operations:[], ownsDatabase:true }), 'LOGISTICS_PROVIDER_ADAPTER_INVALID'));
test('wrong capability rejected', () => throwsCode(() => defineLogisticsProviderAdapter({ id:'x', provider:'p', capability:'payments.core', operations:[] }), 'LOGISTICS_PROVIDER_ADAPTER_INVALID'));
test('boundary assertion', () => assert.equal(assertLogisticsProviderAdapterBoundary({ id:'assert-logistics', provider:'p', operations:['delivery'] }), true));
test('execution delegate remains runtime-only and adapter-scoped', async () => {
  registerPlatformAdapter({ id:'runtime-exec-adapter', capability:'logistics.operations', provider:'runtime-provider', operations:['delivery'], status:'active' }, { replace: true });
  registerPlatformAdapterExecution('runtime-exec-adapter', async (input, context) => ({
    accepted: input.operation === 'delivery' && context.adapter.provider === 'runtime-provider',
  }));
  const result = await executePlatformAdapter('runtime-exec-adapter', { operation:'delivery' });
  assert.equal(result.accepted, true);
});

test('missing adapter executor fails closed', async () => {
  await assert.rejects(() => executePlatformAdapter('registered-logistics-adapter', { operation:'delivery' }), (e) => e.code === 'PLATFORM_ADAPTER_EXECUTOR_UNAVAILABLE');
});

test('generic adapter resolves logistics authority', () => {
  registerPlatformAdapter({ id:'registered-logistics-adapter', capability:'logistics.operations', provider:'network-x', operations:['delivery'] });
  const b = resolveAdapterBoundary('registered-logistics-adapter');
  assert.equal(b.authority.authority, 'logistics');
  assert.equal(b.capability.capability, 'logistics.operations');
});
console.log(`PHASE16.13.3_RESULT ${pass} PASS / 0 FAIL`);
