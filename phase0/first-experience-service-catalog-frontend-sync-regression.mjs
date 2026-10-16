import assert from 'node:assert/strict';

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalLocalStorage = globalThis.localStorage;
const originalDocument = globalThis.document;
const originalGetComputedStyle = globalThis.getComputedStyle;
const localValues = new Map();
const requests = [];

const noop = () => {};
const fakeElement = {
  style: { setProperty: noop, removeProperty: noop, getPropertyValue: () => '' },
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  setAttribute: noop, getAttribute: () => null, appendChild: noop,
  addEventListener: noop, removeEventListener: noop, dataset: {}, children: [],
  options: [], value: '', textContent: '', innerHTML: '',
};
globalThis.window = {
  location: { origin: 'http://sellify.test' },
  addEventListener: noop,
  matchMedia: () => ({ addEventListener: noop }),
};
globalThis.localStorage = {
  getItem(key) { return localValues.has(key) ? localValues.get(key) : null; },
  setItem(key, value) { localValues.set(key, String(value)); },
  removeItem(key) { localValues.delete(key); },
  clear() { localValues.clear(); },
};
globalThis.document = new Proxy({
  documentElement: fakeElement, head: fakeElement, body: fakeElement,
  querySelector: () => null, querySelectorAll: () => [],
  getElementById: () => ({ ...fakeElement, style: { ...fakeElement.style }, classList: { ...fakeElement.classList } }),
  createElement: () => ({ ...fakeElement, style: { ...fakeElement.style }, classList: { ...fakeElement.classList } }),
  addEventListener: noop,
}, { get(target, key) { return key in target ? target[key] : noop; } });
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });

const service = { id: 'svc-client', name: 'Consultation', price: 25000, item_type: 'service' };
const physical = { id: 'prd-client', name: 'Soap', price: 5000, item_type: 'product' };
let serverProducts = [service, physical];
let submittedOrders = [];
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

try {
  const state = await import('../app/src/state.js');
  const idb = await import('../app/src/storage/idb.js');
  idb.setIdbUnavailable(true);
  state.setConfig({
    chatId: 'tenant-client-journey',
    syncUrl: 'http://sellify.test',
    sessionToken: 'session-client-journey',
    currencyCode: 'ETB',
    lang: 'en',
  });
  state.setProducts([{ ...service }, { ...physical }]);
  state.setOrders([{
    id: 'local-service-order',
    status: 'queued',
    currency: 'ETB',
    items: [{ id: service.id, name: service.name, price: service.price, qty: 1, item_type: 'service' }],
  }]);

  globalThis.fetch = async (url, options = {}) => {
    const entry = { url: String(url), method: options.method || 'GET', headers: options.headers || {}, body: options.body };
    requests.push(entry);
    const parsed = options.body ? JSON.parse(options.body) : null;

    if (entry.url.endsWith('/catalog/tenant-client-journey') && entry.method === 'POST') {
      assert.equal(entry.headers.Authorization, 'Bearer session-client-journey');
      assert.equal(parsed.products.find(p => p.id === service.id).item_type, 'service',
        'syncCatalog must send the service type unchanged');
      assert.equal(parsed.products.find(p => p.id === physical.id).item_type, 'product');
      return response(200, { products: serverProducts });
    }
    if (entry.url.endsWith('/sync/tenant-client-journey') && entry.method === 'POST') {
      submittedOrders = parsed.orders;
      assert.equal(entry.headers.Authorization, 'Bearer session-client-journey');
      return response(200, { results: parsed.orders.map(order => ({
        local_id: order.id, status: 'synced', order_id: 'canonical-order-1',
        payment_id: 'canonical-payment-1',
      })) });
    }
    if (entry.url.includes('/orders/tenant-client-journey')) return response(200, { orders: [] });
    if (entry.url.endsWith('/sync/tenant-client-journey') && entry.method === 'GET') return response(200, { new_orders: [] });
    if (entry.url.includes('/payments/')) return response(200, { payment: { id: 'canonical-payment-1', state: 'PENDING' } });
    return response(200, {});
  };

  const catalogClient = await import('../app/src/sync/catalog.js');
  const ordersClient = await import('../app/src/sync/orders.js');

  await catalogClient.syncCatalog();
  assert.equal(state.products.find(p => p.id === service.id).item_type, 'service',
    'client must preserve service type from persisted catalog response');
  assert.equal(state.products.find(p => p.id === physical.id).item_type, 'product');

  await ordersClient.syncOrders();
  assert.equal(submittedOrders.length, 1, 'queued service order should be submitted');
  assert.equal(submittedOrders[0].items[0].item_type, 'service',
    'syncOrders must submit service line item metadata unchanged');
  assert.equal(state.orders.find(o => o.id === 'local-service-order').server_order_id, 'canonical-order-1',
    'frontend must preserve canonical order identity from sync acknowledgement');
  assert.ok(requests.some(r => r.method === 'POST' && r.url.endsWith('/catalog/tenant-client-journey')));
  assert.ok(requests.some(r => r.method === 'POST' && r.url.endsWith('/sync/tenant-client-journey')));
  console.log('PASS: actual frontend catalog and order sync preserve service type and canonical order identity');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
  if (originalLocalStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = originalLocalStorage;
  if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
  if (originalGetComputedStyle === undefined) delete globalThis.getComputedStyle; else globalThis.getComputedStyle = originalGetComputedStyle;
}
