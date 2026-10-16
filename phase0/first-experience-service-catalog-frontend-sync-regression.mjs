import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const catalogSource = await readFile(new URL('../app/src/sync/catalog.js', import.meta.url), 'utf8');
const ordersSource = await readFile(new URL('../app/src/sync/orders.js', import.meta.url), 'utf8');
const tenantAuthSource = await readFile(new URL('../app/src/auth/tenant.js', import.meta.url), 'utf8');
const checkoutSource = await readFile(new URL('../app/src/orders/checkout.js', import.meta.url), 'utf8');

// Guard the real sanitizer implementation used by catalog pull/push. The
// spread preserves item_type while the following fields normalize ID and price.
assert.match(catalogSource, /return \{\s*\.\.\.p,/);
assert.match(catalogSource, /id:\s*sanitizeId\(p\.id\)/);
assert.match(catalogSource, /price:\s*Number\.isFinite\(numericPrice\)/);

// Contract guards for the actual client methods: catalog POST sends the live
// products array; order POST sends queued orders; both use tenant-session auth.
assert.match(catalogSource, /body:\s*JSON\.stringify\(\{\s*products\s*\}\)/);
assert.match(catalogSource, /\.\.\.p/);
assert.match(catalogSource, /headers:\s*\{\s*'Content-Type':\s*'application\/json',\s*\.\.\.tenantAuthHeaders\(\)\s*\}/);
assert.match(ordersSource, /body:\s*JSON\.stringify\(\{\s*orders:\s*queued\s*\}\)/);
assert.match(ordersSource, /\.\.\.tenantAuthHeaders\(\)/);
assert.doesNotMatch(ordersSource, /\bauthHeaders\(\)/,
  'extracted order sync must not call the undefined legacy authHeaders helper');
assert.match(ordersSource, /server_order_id:\s*result\.order_id/);

// Response-loss recovery contract: only a canonical "synced" acknowledgement
// changes local status. A thrown fetch, non-2xx response, or unreadable JSON
// falls into the catch path, where queued orders remain queued and are saved
// with retry metadata so the next sync reuses the same local IDs.
assert.match(ordersSource, /orders\.filter\(o => o\.status === 'queued'\)/);
assert.match(ordersSource, /if \(!res\.ok\) throw new Error/);
assert.match(ordersSource, /catch \(e\) \{[\s\S]*?setOrders\(orders\.map\(o => queued\.some\(q => q\.id === o\.id\)[\s\S]*?sync_attempts: \(o\.sync_attempts \|\| 0\) \+ 1[\s\S]*?saveJSON\(STORAGE_KEYS\.orders, orders\)/);
assert.match(ordersSource, /if \(result && result\.status === 'synced'\) \{[\s\S]*?status: 'synced', server_order_id: result\.order_id/);
assert.match(ordersSource, /if \(result && result\.status === 'rejected'\) \{[\s\S]*?status: 'sync_rejected'/);
assert.match(tenantAuthSource, /export function authHeaders\(/);

// Both the Telegram order payload and the local queued checkout derive their
// line-item type from the local catalog. This is presentation/transport
// metadata only; backend catalog data remains authoritative for stock effects.
assert.equal(
  (checkoutSource.match(/item_type: p\.item_type === 'service' \? 'service' : 'product'/g) || []).length,
  2,
  'Telegram checkout and local queued checkout must both preserve catalog item type'
);


// Exercise the actual syncOrders implementation with a small isolated browser
// boundary. The first POST represents a server commit whose response is lost;
// the second POST returns the idempotent canonical acknowledgement.
const executableOrdersSource = ordersSource
  .replace(/^import.*;$/gm, '')
  .replace('export async function syncOrders()', 'async function syncOrders()')
  + '\nglobalThis.__syncOrders = syncOrders;';

let runtimeOrders = [{
  id: 'local-order-response-loss',
  status: 'queued',
  currency: 'ETB',
  items: [{ id: 'service-consult', name: 'Consultation', price: 25000, qty: 1, item_type: 'service' }],
}];
const persistedOrders = [];
const postBodies = [];
let postAttempts = 0;
const runtimeContext = {
  STORAGE_KEYS: { orders: 'orders' },
  config: { syncUrl: 'https://sync.example.test', chatId: 'tenant-1', sessionToken: 'session-test' },
  get orders() { return runtimeOrders; },
  set orders(next) { runtimeOrders = next; },
  setOrders(next) { runtimeOrders = next; },
  saveJSON(key, value) { if (key === 'orders') persistedOrders.push(structuredClone(value)); },
  tenantAuthHeaders() { return { Authorization: 'Bearer test-session' }; },
  applyStoreBranding() {},
  t(key) { return key; },
  renderAll() {},
  refreshPaymentProjection: async () => {},
  ensurePaymentForSyncedOrder: async () => {},
  console: { error() {}, warn() {}, log() {} },
  Date,
  fetch: async (url, options = {}) => {
    if (options.method === 'POST') {
      postAttempts += 1;
      postBodies.push(JSON.parse(options.body));
      if (postAttempts === 1) {
        // Server committed, but the client receives a network error instead
        // of the response. The local queue must remain retryable.
        throw new Error('simulated response loss after server commit');
      }
      return {
        ok: true,
        json: async () => ({
          results: [{ local_id: 'local-order-response-loss', status: 'synced', order_id: 'canonical-order-1' }],
        }),
      };
    }
    return {
      ok: true,
      json: async () => url.includes('/orders/')
        ? { orders: [] }
        : { new_orders: [] },
    };
  },
};
vm.runInNewContext(executableOrdersSource, runtimeContext, { timeout: 1000 });
const syncOrdersRuntime = runtimeContext.__syncOrders;
assert.equal(typeof syncOrdersRuntime, 'function');
assert.equal(await syncOrdersRuntime(), 'orderSyncFailed');
assert.equal(runtimeOrders[0].status, 'queued');
assert.equal(runtimeOrders[0].sync_attempts, 1);
assert.equal(persistedOrders.at(-1)[0].id, 'local-order-response-loss');
assert.equal(persistedOrders.at(-1)[0].status, 'queued');

assert.match(await syncOrdersRuntime(), /orderSyncedMsg/);
assert.equal(postAttempts, 2);
assert.equal(postBodies[0].orders[0].id, 'local-order-response-loss');
assert.equal(postBodies[1].orders[0].id, 'local-order-response-loss');
assert.equal(runtimeOrders[0].status, 'synced');
assert.equal(runtimeOrders[0].server_order_id, 'canonical-order-1');
assert.equal(persistedOrders.at(-1)[0].status, 'synced');

console.log('PASS: frontend sync contracts and actual queued-order response-loss recovery');
