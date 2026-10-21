import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const catalogSource = await readFile(new URL('../app/src/sync/catalog.js', import.meta.url), 'utf8');
const ordersSource = await readFile(new URL('../app/src/sync/orders.js', import.meta.url), 'utf8');
const tenantAuthSource = await readFile(new URL('../app/src/auth/tenant.js', import.meta.url), 'utf8');
const checkoutSource = await readFile(new URL('../app/src/orders/checkout.js', import.meta.url), 'utf8');
const marketplaceCheckoutSource = await readFile(new URL('../app/src/marketplace/checkout.js', import.meta.url), 'utf8');
const mainSource = await readFile(new URL('../app/src/main.js', import.meta.url), 'utf8');
const onboardingHtml = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
const windowBridgeSource = await readFile(new URL('../app/src/window-bridge.js', import.meta.url), 'utf8');

const tenantStoreSource = await readFile(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
const backendServerSource = await readFile(new URL('../backend/server.js', import.meta.url), 'utf8');
assert.match(tenantStoreSource, /if \(!applied\.includes\(76\)\)[\s\S]*?CREATE TABLE IF NOT EXISTS tenant_business_templates[\s\S]*?schema_migrations[^\n]*76/,
  'merchant template persistence must be installed by a versioned SQLite migration');
assert.match(tenantStoreSource, /chat_id TEXT PRIMARY KEY REFERENCES tenants\(chat_id\) ON DELETE CASCADE/,
  'template configuration must be tenant-scoped and cascade with its canonical tenant');
assert.match(tenantStoreSource, /const MERCHANT_BUSINESS_TEMPLATE_KEYS = new Set\([\s\S]*?'retail-shop'[\s\S]*?'repair'[\s\S]*?'other'/,
  'server must validate template keys against a fixed allowlist');
assert.match(tenantStoreSource, /tenant\.business_template\.updated/,
  'template changes must emit a tenant audit event');
assert.match(backendServerSource, /async function handleBusinessTemplateConfig[\s\S]*?requireSession\(req, tenant\.chatId\)[\s\S]*?requireOwnerRole\(session\)/,
  'template reads and writes must require an authenticated owner session');
assert.match(backendServerSource, /\/business-template\//,
  'the tenant business-template endpoint must be routed');

// Guard the real sanitizer implementation used by catalog pull/push. The
// spread preserves item_type while the following fields normalize ID and price.
assert.match(onboardingHtml, /Choose your business type/,
  'merchant onboarding must make business type selection a primary entry point');
assert.match(onboardingHtml, /value="rental" data-business-type="services"/,
  'rental is configured through the existing services business type');
assert.match(onboardingHtml, /value="repair" data-business-type="services"/,
  'repair template supports hybrid service and product merchants without a new vertical');
assert.match(onboardingHtml, /id="onboardingItemType"[\s\S]*?value="product"[\s\S]*?value="service"/,
  'first catalog item setup must distinguish physical products from services');
assert.match(tenantAuthSource, /item_type: itemType,[\s\S]*?itemType === 'product' && stock !== undefined/,
  'service onboarding must preserve canonical item_type and must not attach physical stock');
assert.match(tenantAuthSource, /business-template[\\s\\S]*?method: 'PUT'[\\s\\S]*?templateKey: selectedTemplate/,
  'onboarding must persist the selected template through the tenant API, not only local storage');
assert.match(tenantAuthSource, /businessTemplateSchemaVersion: 1/,
  'the local template cache must carry an explicit schema version');
assert.match(windowBridgeSource, /applyOnboardingBusinessTemplate, toggleOnboardingItemType/,
  'new onboarding actions must be available to the inline HTML event handlers');

assert.match(catalogSource, /return \{\s*\.\.\.p,/);
assert.match(catalogSource, /id:\s*sanitizeId\(p\.id\)/);
assert.match(catalogSource, /price:\s*Number\.isFinite\(numericPrice\)/);
assert.match(catalogSource, /item_type:\s*String\(l\.item_type \|\| 'product'\)[\s\S]*?\? 'service' : 'product'/,
  'cached and remote marketplace listings must normalize item_type with a legacy-safe product default');
assert.match(marketplaceCheckoutSource, /const listing = marketplaceListings\.find\(l => l\.listing_id === e\.listing\.listing_id\) \|\| e\.listing/,
  'checkout must resolve the current listing after a marketplace refresh instead of trusting a stale cart snapshot');
assert.match(marketplaceCheckoutSource, /item_type:\s*listing\.item_type === 'service' \? 'service' : 'product'/,
  'marketplace checkout transport payloads must preserve canonical listing type for Telegram/local-queue paths');
assert.match(marketplaceCheckoutSource, /Idempotency-Key':\s*intent\.idempotencyKey/,
  'marketplace API checkout must send the durable intent idempotency key');
assert.match(marketplaceCheckoutSource, /await writePendingMarketplaceIntent\(intent\)[\s\S]*?await postMarketplaceCheckoutIntent\(intent\)/,
  'checkout intent must be persisted before the API request');
assert.match(marketplaceCheckoutSource, /export async function retryPendingMarketplaceCheckouts\(/,
  'pending marketplace checkouts must have a recovery path');
assert.match(marketplaceCheckoutSource, /let marketplaceCheckoutSubmission = null;[\s\S]*?if \(marketplaceCheckoutSubmission\) return marketplaceCheckoutSubmission/,
  'concurrent submit events must share one in-flight marketplace checkout promise');
assert.match(
  marketplaceCheckoutSource,
  /if \(twaResult && twaResult\.ok\) \{[\s\S]*?showToast\('Marketplace order sent to Telegram for processing\.'\);\s*return;\s*\}[\s\S]*?await writePendingMarketplaceIntent\(intent\)/,
  'successful Telegram handoff must return before the direct API checkout path to avoid duplicate orders'
);
assert.match(marketplaceCheckoutSource, /Checkout was rejected/,
  'definitive marketplace 4xx errors must not be reported as pending ambiguous checkouts');
assert.match(mainSource, /window\.addEventListener\('online', \(\) => \{ retryPendingMarketplaceCheckouts\(\); \}\)/,
  'pending marketplace checkout recovery must run when connectivity returns');

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
