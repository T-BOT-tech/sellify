import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const catalogSource = await readFile(new URL('../app/src/sync/catalog.js', import.meta.url), 'utf8');
const ordersSource = await readFile(new URL('../app/src/sync/orders.js', import.meta.url), 'utf8');
const tenantAuthSource = await readFile(new URL('../app/src/auth/tenant.js', import.meta.url), 'utf8');

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


// Exercise the real catalog creation handler so item_type is not only
// present in markup/source: selecting Service must persist a service locally
// before the existing catalog sync sends it to the backend.
const catalogExecutableSource = catalogSource
  .replace(/^import[\\s\\S]*?from ['"][^'"]+['"];\\s*/gm, '')
  .replace(/^export /gm, '')
  + '\\nglobalThis.__addProduct = addProduct;';
const catalogInputs = {
  newProdName: { value: 'Consultation' },
  newProdPrice: { value: '250.00' },
  newProdCategory: { value: '' },
  newProdUnit: { value: '' },
  newProdType: { value: 'service' },
  newProdModifiers: { value: '' },
  newProdMarketListed: { checked: false },
  newProdImgPreview: { innerHTML: '' },
  newProdImgInput: { value: '' },
};
const locallySavedCatalogs = [];
const runtimeCatalog = [];
const catalogContext = {
  CS: () => 'ETB ',
  toMinorUnits: value => Math.round(Number(value) * 100),
  fromMinorUnits: value => value / 100,
  formatMoney: value => String(value),
  getNichePreset: () => null,
  isRestaurant: () => false,
  escapeHtml: value => String(value),
  escapeAttr: value => String(value),
  uid: () => 'service-created-in-ui',
  STORAGE_KEYS: { products: 'products' },
  RESTAURANT_COURSES: [],
  products: runtimeCatalog,
  currentOrder: {},
  currentOrderNotes: {},
  currentStaff: { role: 'owner' },
  saveJSON: (key, value) => { if (key === 'products') locallySavedCatalogs.push(structuredClone(value)); },
  hasPermission: () => true,
  t: key => key,
  renderAll() {},
  showToast() {},
  markCatalogDirty() {},
  document: { getElementById: id => catalogInputs[id] || null },
  prompt: () => '',
  confirm: () => true,
};
vm.runInNewContext(catalogExecutableSource, catalogContext, { timeout: 1000 });
catalogContext.__addProduct();
assert.equal(runtimeCatalog.length, 1);
assert.equal(runtimeCatalog[0].id, 'service-created-in-ui');
assert.equal(runtimeCatalog[0].item_type, 'service');
assert.equal(runtimeCatalog[0].price, 25000);
assert.equal(locallySavedCatalogs.at(-1)[0].item_type, 'service',
  'service type must be saved locally before catalog sync');
assert.equal(catalogInputs.newProdType.value, 'product',
  'new-item form resets to the safe physical-product default after save');

// Exercise the actual syncOrders implementation with a small isolated browser
// boundary. The first POST represents a server commit whose response is lost;
// the second POST returns the idempotent canonical acknowledgement.
const executableOrdersSource = ordersSource
  .replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '')
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
