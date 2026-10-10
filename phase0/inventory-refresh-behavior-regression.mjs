import assert from 'node:assert/strict';

// Exercise the real ES modules with a deterministic browser/storage boundary.
// No backend or network is contacted; fetch is replaced per scenario.
const storage = new Map();
globalThis.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); },
};
globalThis.window = {
  __APP_CONFIG__: {},
  location: { origin: 'https://sellify-test.invalid' },
  addEventListener() {},
  removeEventListener() {},
};
const rootElement = {
  style: { setProperty() {}, removeProperty() {} },
  setAttribute() {},
};
globalThis.document = {
  documentElement: rootElement,
  getElementById() { return null; },
  addEventListener() {},
  removeEventListener() {},
  querySelector() { return { setAttribute() {} }; },
  querySelectorAll() { return []; },
  createElement() { return { setAttribute() {} }; },
  head: { appendChild() {} },
};
globalThis.getComputedStyle = () => ({ getPropertyValue() { return ''; } });
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { onLine: true },
});

const state = await import('../app/src/state.js');
const ledger = await import('../app/src/warehouse/ledger.js');
const { setConfig, setInventoryBalances, setInventoryMovements } = state;
const { loadInventoryBalances, loadInventoryMovements, getInventoryBalanceRefreshState, getInventoryBalance } = ledger;

function configure(overrides = {}) {
  setConfig({
    ...state.config,
    chatId: 'tenant-a',
    sessionToken: 'session-a',
    syncUrl: 'https://api.sellify-test.invalid',
    locationId: 'location-a',
    ...overrides,
  });
}

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; },
  };
}

function currentState(locationId = 'location-a') {
  return getInventoryBalanceRefreshState({ locationId });
}

setInventoryBalances([]);
configure();
let calls = [];
globalThis.fetch = async (url, options) => {
  calls.push({ url: String(url), options });
  return response(200, {
    balances: [
      { productId: 'product-1', locationId: 'location-a', quantity: 12 },
      { productId: 'product-2', locationId: 'location-a', quantity: 0 },
    ],
  });
};

const freshBalances = await loadInventoryBalances({ locationId: 'location-a' });
assert.equal(freshBalances.length, 2, 'valid balance response is returned');
assert.equal(currentState().status, 'FRESH', 'valid successful response becomes FRESH');
assert.ok(currentState().refreshedAt, 'successful client refresh records its local observation time');
assert.equal(calls.length, 1);
assert.match(calls[0].url, /\/tenants\/tenant-a\/inventory\/balances\?location_id=location-a$/);
assert.equal(calls[0].options.headers.Authorization, 'Bearer session-a');
assert.deepEqual(state.inventoryBalances, freshBalances, 'successful response updates the existing projection');

const lastRefresh = currentState().refreshedAt;
globalThis.fetch = async () => response(500, { error: 'temporary failure' });
const afterServerFailure = await loadInventoryBalances({ locationId: 'location-a' });
assert.equal(currentState().status, 'CACHED', 'server failure after a success is not labelled FRESH');
assert.equal(currentState().httpStatus, 500);
assert.equal(currentState().refreshedAt, lastRefresh, 'failed refresh preserves last successful timestamp');
assert.deepEqual(afterServerFailure, freshBalances, 'failed refresh does not overwrite balances');

globalThis.fetch = async () => response(403, { error: 'forbidden' });
await loadInventoryBalances({ locationId: 'location-a' });
assert.equal(currentState().status, 'PERMISSION_DENIED', 'authorization failure is distinct from transport failure');
assert.equal(currentState().httpStatus, 403);
assert.deepEqual(state.inventoryBalances, freshBalances, 'permission failure does not mutate the cached projection');

globalThis.fetch = async () => { throw new Error('network down'); };
await assert.rejects(loadInventoryBalances({ locationId: 'location-a' }), /network down/);
assert.equal(currentState().status, 'CACHED', 'transport failure with prior success falls back to CACHED');
assert.deepEqual(state.inventoryBalances, freshBalances, 'transport failure does not overwrite balances');

globalThis.fetch = async () => response(200, { balances: 'not-an-array' });
await loadInventoryBalances({ locationId: 'location-a' });
assert.equal(currentState().status, 'CACHED', 'malformed payload cannot be labelled FRESH');
assert.deepEqual(state.inventoryBalances, freshBalances, 'malformed payload does not overwrite balances');

globalThis.fetch = async () => response(200, {
  balances: [{ productId: 'product-1', locationId: 'location-a', quantity: 'not-a-number' }],
});
await loadInventoryBalances({ locationId: 'location-a' });
assert.equal(currentState().status, 'CACHED', 'invalid row values cannot be labelled FRESH');
assert.deepEqual(state.inventoryBalances, freshBalances, 'invalid row values do not overwrite balances');

let offlineFetchCount = 0;
globalThis.fetch = async () => { offlineFetchCount += 1; return response(200, { balances: [] }); };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
await loadInventoryBalances({ locationId: 'location-a' });
assert.equal(currentState().status, 'CACHED', 'offline with same-scope success reports CACHED');
assert.equal(offlineFetchCount, 0, 'offline refresh does not issue a network request');
assert.deepEqual(state.inventoryBalances, freshBalances);

configure({ chatId: 'tenant-b', sessionToken: 'session-b', locationId: 'location-b' });
assert.equal(getInventoryBalanceRefreshState({ locationId: 'location-b' }).status, 'UNKNOWN',
  'refresh state from another tenant/location must not be reused');
await loadInventoryBalances({ locationId: 'location-b' });
assert.equal(getInventoryBalanceRefreshState({ locationId: 'location-b' }).status, 'OFFLINE',
  'offline without a successful refresh for this scope is OFFLINE');
assert.equal(offlineFetchCount, 0);

Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
globalThis.fetch = async () => response(500, {});
await loadInventoryBalances({ locationId: 'location-b' });
assert.equal(getInventoryBalanceRefreshState({ locationId: 'location-b' }).status, 'UNKNOWN',
  'server failure without a successful refresh for this scope remains UNKNOWN');

// A second tenant gets its own cached rows without deleting or exposing the
// first tenant's rows. Switching back must select the matching scoped cache.
configure({ chatId: 'tenant-b', sessionToken: 'session-b', locationId: 'location-b' });
setInventoryMovements([{
  productId: 'legacy-product',
  locationId: 'location-b',
  quantity: 500,
}]);
assert.equal(getInventoryBalance('legacy-product', 'location-b'), 0,
  'unscoped legacy movement rows must not become an authenticated tenant balance fallback');
globalThis.fetch = async () => response(200, {
  balances: [{ productId: 'product-1', locationId: 'location-b', quantity: 99 }],
});
const tenantBBalances = await loadInventoryBalances({ locationId: 'location-b' });
assert.equal(tenantBBalances[0].tenantChatId, 'tenant-b');
assert.equal(getInventoryBalance('product-1', 'location-b'), 99,
  'active tenant reads its own cached balance');
configure({ chatId: 'tenant-a', sessionToken: 'session-a', locationId: 'location-a' });
assert.equal(getInventoryBalance('product-1', 'location-a'), 12,
  'switching back reads tenant A cached balance');
configure({ chatId: 'tenant-b', sessionToken: 'session-b', locationId: 'location-b' });
assert.equal(getInventoryBalance('product-1', 'location-b'), 99,
  'tenant B balance remains available from its own scoped cache');
assert.equal(getInventoryBalance('product-1', 'location-a'), 0,
  'tenant B cannot read tenant A balance by requesting tenant A location');

configure({ sessionToken: '' });
await loadInventoryBalances({ locationId: 'location-a' });
assert.equal(currentState().status, 'UNKNOWN', 'missing authentication cannot imply fresh data');

// An older request that resolves after the active tenant/location changes must
// not overwrite the new scope's balances or refresh status.
setInventoryBalances([]);
configure({ chatId: 'tenant-a', sessionToken: 'session-a', locationId: 'location-a' });
let resolveTenantA;
globalThis.fetch = async (url) => {
  if (String(url).includes('/tenants/tenant-a/')) {
    return new Promise(resolve => { resolveTenantA = resolve; });
  }
  if (String(url).includes('/tenants/tenant-b/')) {
    return response(200, {
      balances: [{ productId: 'product-b', locationId: 'location-b', quantity: 22 }],
    });
  }
  throw new Error('Unexpected tenant in race test URL: ' + url);
};
const pendingTenantARefresh = loadInventoryBalances({ locationId: 'location-a' });
configure({ chatId: 'tenant-b', sessionToken: 'session-b', locationId: 'location-b' });
await loadInventoryBalances({ locationId: 'location-b' });
assert.equal(currentState('location-b').status, 'FRESH',
  'active tenant refresh succeeds while an older tenant request is pending');
resolveTenantA(response(200, {
  balances: [{ productId: 'product-a', locationId: 'location-a', quantity: 11 }],
}));
await pendingTenantARefresh;
assert.equal(currentState('location-b').status, 'FRESH',
  'late response from the previous tenant cannot overwrite active refresh status');
assert.equal(getInventoryBalance('product-b', 'location-b'), 22,
  'active tenant balance remains after an older request resolves');
assert.equal(getInventoryBalance('product-a', 'location-a'), 0,
  'late response from previous tenant is ignored instead of entering the shared projection');

// Movement-list responses must also be discarded when the active scope changes.
// Persisted tenant-A records must also be excluded from tenant-B's projection.
setInventoryMovements([{
  eventId: 'tenant-a-persisted-event', tenantChatId: 'tenant-a',
  organizationId: 'org-a', productId: 'product-a', locationId: 'location-a',
  quantity: 99, occurredAt: '2026-10-10T10:00:00.000Z',
}]);
configure({ chatId: 'tenant-a', organizationId: 'org-a', sessionToken: 'session-a', locationId: 'location-a' });
let resolveTenantAMovements;
globalThis.fetch = async (url) => {
  if (String(url).includes('/tenants/tenant-a/inventory/movements')) {
    return new Promise(resolve => { resolveTenantAMovements = resolve; });
  }
  if (String(url).includes('/tenants/tenant-b/inventory/movements')) {
    return response(200, { movements: [{
      eventId: 'tenant-b-event', organizationId: 'org-b', productId: 'product-b',
      locationId: 'location-b', quantity: 2, occurredAt: '2026-10-10T12:00:00.000Z',
    }] });
  }
  throw new Error('Unexpected movement URL in scope-race test: ' + url);
};
const pendingTenantAMovements = loadInventoryMovements({ locationId: 'location-a' });
configure({ chatId: 'tenant-b', organizationId: 'org-b', sessionToken: 'session-b', locationId: 'location-b' });
await loadInventoryMovements({ locationId: 'location-b' });
assert.equal(state.inventoryMovements.some(m => m.eventId === 'tenant-b-event'), true,
  'active tenant movement history is loaded');
assert.equal(state.inventoryMovements.some(m => m.eventId === 'tenant-a-persisted-event'), false,
  'persisted movement records from another tenant are excluded from the active projection');
resolveTenantAMovements(response(200, { movements: [{
  eventId: 'tenant-a-event', organizationId: 'org-a', productId: 'product-a',
  locationId: 'location-a', quantity: 99, occurredAt: '2026-10-10T11:00:00.000Z',
}] }));
await pendingTenantAMovements;
assert.equal(state.inventoryMovements.some(m => m.eventId === 'tenant-a-event'), false,
  'late movement response from previous tenant is discarded');
assert.equal(state.inventoryMovements.some(m => m.eventId === 'tenant-b-event'), true,
  'late previous-tenant response does not remove active tenant movement history');

console.log('Inventory refresh behavior regression: PASS');
console.log('Success, failures, offline, malformed payloads, tenant/location isolation, and scope changes: PASS');
