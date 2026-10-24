import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const catalogSource = await readFile(new URL('../app/src/sync/catalog.js', import.meta.url), 'utf8');
const productsSource = await readFile(new URL('../app/src/products/catalog.js', import.meta.url), 'utf8');
const ordersSource = await readFile(new URL('../app/src/sync/orders.js', import.meta.url), 'utf8');
const tenantAuthSource = await readFile(new URL('../app/src/auth/tenant.js', import.meta.url), 'utf8');
const checkoutSource = await readFile(new URL('../app/src/orders/checkout.js', import.meta.url), 'utf8');
const marketplaceCheckoutSource = await readFile(new URL('../app/src/marketplace/checkout.js', import.meta.url), 'utf8');
const mainSource = await readFile(new URL('../app/src/main.js', import.meta.url), 'utf8');
const onboardingHtml = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
const windowBridgeSource = await readFile(new URL('../app/src/window-bridge.js', import.meta.url), 'utf8');

const appSourceForTemplateSync = await readFile(new URL('../app/src/auth/tenant.js', import.meta.url), 'utf8');
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
assert.match(backendServerSource, /business-template/,
  'the tenant business-template endpoint must be routed');
assert.match(backendServerSource, /const session = await requireSession\(req, tenant\.chatId\);[\s\S]*?if \(req\.method === 'GET'\)[\s\S]*?getBusinessTemplateConfig\(chatId\)[\s\S]*?if \(req\.method !== 'PUT' && req\.method !== 'PATCH'\)[\s\S]*?await requireOwnerRole\(session\)[\s\S]*?saveBusinessTemplateConfig\(chatId, body, session\)/,
  'authenticated tenant members may read shared template configuration while only owners may change it');
assert.match(appSourceForTemplateSync, /async function loadBusinessTemplateConfig[\s\S]*?businessTemplate: saved\.templateKey[\s\S]*?businessTemplateSchemaVersion: saved\.schemaVersion/,
  'authenticated devices must hydrate their cached template from server-owned configuration');
assert.match(appSourceForTemplateSync, /String\(config\.chatId\) !== chatId \|\| String\(config\.sessionToken\) !== sessionToken/,
  'a late template response from a previous tenant or session must not overwrite the active tenant cache');

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
assert.match(tenantAuthSource, /import \{ saveJSON, saveJSONAsync, loadJSONAsync \} from '\.\.\/storage\/json\.js';[\s\S]*?const locallySaved = await saveJSONAsync\(STORAGE_KEYS\.products, products\)/,
  'first-offering onboarding must wait for local persistence before reporting or syncing');
assert.match((await readFile(new URL('../app/src/storage/json.js', import.meta.url), 'utf8')), /export async function saveJSONAsync[\s\S]*?await idbSet\(key, value\)/,
  'critical onboarding persistence must await the IndexedDB transaction instead of fire-and-forget saveJSON');
assert.match(tenantAuthSource, /business-template[\s\S]*?method: 'PUT'[\s\S]*?templateKey: selectedTemplate/,
  'onboarding must persist the selected template through the tenant API, not only local storage');
assert.match(tenantAuthSource, /businessTemplateSchemaVersion: 1/,
  'the local template cache must carry an explicit schema version');
const windowAssignment = windowBridgeSource.match(/Object\.assign\(window,\s*\{([\s\S]*?)\n\s*\}\);/)?.[1] || '';
assert.match(windowAssignment, /\bapplyOnboardingBusinessTemplate\b/,
  'business-template onchange handler must be exposed on window');
assert.match(windowAssignment, /\btoggleOnboardingItemType\b/,
  'product/service onchange handler must be exposed on window');

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

// First-run catalog creation must use the same canonical push path as manual
// sync. A startup pull alone cannot upload the newly-created local offering.
assert.match(tenantAuthSource, /export async function addOnboardingProduct\(/,
  'onboarding offering creation must wait for the best-effort canonical sync attempt');
assert.match(tenantAuthSource, /markCatalogDirty\(\)[\s\S]*?await import\('\.\.\/sync\/catalog\.js'\)[\s\S]*?await syncCatalog\(\)/,
  'the onboarding flow must attempt canonical catalog sync after persisting the local offering');
assert.match(tenantAuthSource, /Saved on this device\. You are offline; use Sync now when connected\./,
  'offline onboarding must preserve the local offering and explain the recovery path');
assert.match(tenantAuthSource, /Saved on this device, but not synced yet\. Use Sync now to retry\./,
  'sync exceptions must not be presented as successful persistence to the server');

assert.match(tenantAuthSource, /syncMessage === t\('catalogSyncFailed'\)[\s\S]*?Saved on this device, but not synced yet\. Use Sync now to retry\./,
  'the onboarding flow must detect syncCatalog’s returned failure message, not only thrown exceptions');

assert.match(productsSource, /export function isCatalogDirty\(\)/,
  'catalog pull must be able to distinguish a locally modified catalog');
assert.match(mainSource, /const ledgerHydrationPromise = hydrateFromIndexedDB\(\)/,
  'startup must expose the local-storage hydration completion boundary');
assert.match(mainSource, /tenantAuthPromise\.then\(result => ledgerHydrationPromise\.then\(async \(\) => \{/,
  'remote catalog pull must wait until local IndexedDB hydration completes');
assert.match(productsSource, /pendingCatalogKey = chatId => `ledger_catalog_pending_v1:/,
  'pending catalog snapshots must use a tenant-specific durable key');
assert.match(productsSource, /export async function restorePendingCatalogForTenant\(chatId\)[\s\S]*?String\(pending\.tenantId\) !== tenantId[\s\S]*?setProducts\(pending\.products\)/,
  'startup recovery must validate tenant ownership before restoring a pending catalog');
assert.match(mainSource, /await restorePendingCatalogForTenant\(config\.chatId\);[\s\S]*?return fetchRemoteCatalogAndBranding\(\);/,
  'tenant pending catalog must be restored after hydration and before remote pull');
assert.match(productsSource, /export async function markCatalogSynced\(\)[\s\S]*?saveJSONAsync\(pendingCatalogKey\(chatId\), null\)/,
  'successful sync must durably clear the pending snapshot marker');
assert.match(productsSource, /export async function saveProductEdit\(id\)[\s\S]*?await saveJSONAsync\(STORAGE_KEYS\.products, products\)[\s\S]*?await markCatalogDirty\(\)/,
  'editing a catalog item must durably save its data and pending marker before returning');
assert.match(productsSource, /export async function addProduct\(\)[\s\S]*?await saveJSONAsync\(STORAGE_KEYS\.products, products\)[\s\S]*?await markCatalogDirty\(\)/,
  'adding a catalog item must durably save its data and pending marker before returning');
assert.match(productsSource, /export async function removeProduct\(id\)[\s\S]*?await saveJSONAsync\(STORAGE_KEYS\.products, products\)[\s\S]*?await markCatalogDirty\(\)/,
  'removing a catalog item must durably save its data and pending marker before returning');
assert.match(tenantAuthSource, /async function clearSharedTenantCaches\(\)[\s\S]*?for \(const \[, , setter, storageKey, emptyValue\] of tenantStateFields\)[\s\S]*?saveJSONAsync\(storageKey, emptyValue\)/,
  'tenant switching must clear every shared business-state cache before reload to prevent offline cross-tenant leakage');
assert.match(tenantAuthSource, /await clearSharedTenantCaches\(\);[\s\S]*?persistAuth\(data, data\.membership\);[\s\S]*?window\.location\.reload\(\);/,
  'settings tenant switching must clear shared caches durably before changing the active identity');
assert.match(tenantAuthSource, /await clearSharedTenantCaches\(\);[\s\S]*?persistAuth\(data, data\.membership\);[\s\S]*?closeOnboarding\(\);[\s\S]*?window\.location\.reload\(\);/,
  'onboarding tenant switching must clear shared caches durably before changing the active identity');
assert.match(tenantAuthSource, /const tenantStateKey = chatId => `ledger_tenant_state_v1:/,
  'all persisted business state snapshots must be keyed by tenant');
assert.match(tenantAuthSource, /async function preserveTenantState\(chatId\)[\s\S]*?structuredClone\(getValue\(\)\)[\s\S]*?saveJSONAsync\(tenantStateKey\(tenantId\)/,
  'tenant switching must durably preserve the outgoing tenant local state before clearing shared keys');
assert.match(tenantAuthSource, /export async function restoreTenantStateForTenant\(chatId\)[\s\S]*?String\(snapshot\.tenantId\) !== tenantId[\s\S]*?setter\(snapshot\.state\[name\]\)/,
  'tenant recovery must validate snapshot ownership before restoring tenant state');
assert.match(tenantAuthSource, /\['inventoryMovements',[\s\S]*?\['inventoryBalances',[\s\S]*?\['outboxEvents',[\s\S]*?\['stockTransactions'/,
  'tenant snapshots must include inventory projections and durable offline outbox events');
const tenantSwitchPreserveIndex = tenantAuthSource.indexOf('await preserveTenantState(config.chatId)');
const tenantSwitchClearIndex = tenantAuthSource.indexOf('await clearSharedTenantCaches();', tenantSwitchPreserveIndex);
const tenantSwitchAuthIndex = tenantAuthSource.indexOf('persistAuth(data, data.membership);', tenantSwitchClearIndex);
assert.ok(
  tenantSwitchPreserveIndex >= 0 &&
  tenantSwitchClearIndex > tenantSwitchPreserveIndex &&
  tenantSwitchAuthIndex > tenantSwitchClearIndex,
  'tenant switching must durably preserve and clear outgoing state before changing identity'
);
assert.match(tenantAuthSource, /if \(config\.chatId && !\(await preserveTenantState\(config\.chatId\)\)\) \{[\s\S]*?return;/,
  'tenant switching must abort before clearing caches or changing identity when snapshot persistence fails');
assert.match(tenantAuthSource, /const saved = await saveJSONAsync\(storageKey, emptyValue\);[\s\S]*?if \(!saved\)[\s\S]*?await restoreTenantStateForTenant\(config\.chatId\);[\s\S]*?throw new Error\('Could not safely clear local business data for tenant switch'\)/,
  'failed cache writes must abort tenant switching and restore the outgoing tenant state');
assert.match(tenantAuthSource, /for \(const \[, , setter, storageKey, emptyValue\] of tenantStateFields\)[\s\S]*?setter\(emptyValue\);[\s\S]*?saveJSONAsync\(storageKey, emptyValue\)/,
  'tenant switching must clear every shared business-state key after snapshotting it');
assert.match(mainSource, /await restoreTenantStateForTenant\(config\.chatId\);[\s\S]*?await restorePendingCatalogForTenant\(config\.chatId\);[\s\S]*?return fetchRemoteCatalogAndBranding\(\)/,
  'active tenant state must be restored after hydration and before synchronization');

assert.match(catalogSource, /if \(isCatalogDirty\(\)\) return;/,
  'background catalog pull must not replace locally dirty catalog state');
assert.match(catalogSource, /if \(Array\.isArray\(data\.products\)\) \{[\s\S]*?setProducts\(sanitizeRemoteProducts\(data\.products\)\)/,
  'remote catalog pull must apply an empty canonical catalog instead of retaining stale local products');
assert.match(catalogSource, /setProducts\(data\.products \? sanitizeRemoteProducts\(data\.products\) : products\);\s*saveJSON\(STORAGE_KEYS\.products, products\);\s*await markCatalogSynced\(\);/,
  'successful catalog sync must wait for durable pending-snapshot cleanup before reporting completion');

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
