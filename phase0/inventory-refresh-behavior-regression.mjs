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
};
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { onLine: true },
});

const state = await import('../app/src/state.js');
const ledger = await import('../app/src/warehouse/ledger.js');
const { setConfig, setInventoryBalances } = state;
const { loadInventoryBalances, getInventoryBalanceRefreshState } = ledger;

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

configure({ sessionToken: '' });
await loadInventoryBalances({ locationId: 'location-a' });
assert.equal(currentState().status, 'UNKNOWN', 'missing authentication cannot imply fresh data');

console.log('Inventory refresh behavior regression: PASS');
console.log('Success, server errors, permission denial, transport errors, malformed payloads, offline, and scope changes: PASS');
