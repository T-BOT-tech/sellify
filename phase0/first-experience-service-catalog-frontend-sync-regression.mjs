import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const catalogSource = await readFile(new URL('../app/src/sync/catalog.js', import.meta.url), 'utf8');
const productsCatalogSource = await readFile(new URL('../app/src/products/catalog.js', import.meta.url), 'utf8');

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

const loadBusinessTemplateFunctionSource = tenantAuthSource.match(
  /async function loadBusinessTemplateConfig\(\) \{[\s\S]*?\n\}/,
)?.[0];
assert.ok(loadBusinessTemplateFunctionSource, 'template recovery function must be extractable for behavioral tests');

function makeTemplateRecoveryHarness(overrides = {}) {
  const harness = {
    config: { chatId: 'tenant-a', sessionToken: 'token-a', businessTemplate: 'retail-shop' },
    calls: [],
    localWrites: [],
    configWrites: [],
    stateWrites: [],
    request: async (url, options = {}) => {
      harness.calls.push({ url, options });
      return { businessTemplate: null };
    },
    setConfig: next => { harness.configWrites.push(next); harness.config = next; },
    saveJSON: (...args) => { harness.stateWrites.push(args); },
    saveJSONAsync: async (...args) => { harness.localWrites.push(args); return true; },
    loadJSONAsync: async () => ({
      tenantId: 'tenant-a', status: 'pending', templateKey: 'repair', schemaVersion: 1,
    }),
    STORAGE_KEYS: { config: 'config' },
    ...overrides,
  };
  vm.runInNewContext(
    "const pendingBusinessTemplateKey = chatId => 'ledger_business_template_pending_v1:' + encodeURIComponent(String(chatId));\\n"
      + loadBusinessTemplateFunctionSource
      + "\\nthis.loadBusinessTemplateConfig = loadBusinessTemplateConfig;",
    harness,
  );
  return harness;
}

// A network failure during the pending-template retry must retain the exact
// durable pending marker and must not claim the server configuration was saved.
const retryFailureHarness = makeTemplateRecoveryHarness({
  request: async (url, options = {}) => {
    retryFailureHarnessCalls.push({ url, options });
    if (options.method === 'PUT') throw new Error('offline during template retry');
    return { businessTemplate: null };
  },
});
const retryFailureHarnessCalls = [];
retryFailureHarness.calls = retryFailureHarnessCalls;
retryFailureHarness.loadJSONAsync = async () => ({
  tenantId: 'tenant-a', status: 'pending', templateKey: 'repair', schemaVersion: 1,
});
const retryFailureResult = await retryFailureHarness.loadBusinessTemplateConfig();
assert.equal(retryFailureResult, null);
assert.equal(retryFailureHarness.calls.length, 2, 'retry recovery should GET canonical state then attempt one PUT');
assert.equal(retryFailureHarness.calls[1].options.method, 'PUT');
assert.equal(retryFailureHarness.localWrites.length, 0,
  'failed template retry must not mark its durable pending marker synced');
assert.equal(retryFailureHarness.configWrites.length, 0,
  'failed template retry must not publish an unconfirmed server value to active config');

// A pending marker belonging to another tenant must never be replayed.
const wrongTenantHarness = makeTemplateRecoveryHarness({
  loadJSONAsync: async () => ({
    tenantId: 'tenant-b', status: 'pending', templateKey: 'hotel-rooms', schemaVersion: 1,
  }),
});
await wrongTenantHarness.loadBusinessTemplateConfig();
assert.equal(wrongTenantHarness.calls.length, 1,
  'recovery must not issue a template PUT for a marker owned by a different tenant');
assert.equal(wrongTenantHarness.configWrites.length, 0);

// A response that arrives after a tenant/session switch must not overwrite the
// newly active tenant's cached configuration.
let releaseTemplateRead;
const staleResponseHarness = makeTemplateRecoveryHarness({
  request: () => new Promise(resolve => { releaseTemplateRead = resolve; }),
});
const staleResponsePromise = staleResponseHarness.loadBusinessTemplateConfig();
staleResponseHarness.config = { chatId: 'tenant-b', sessionToken: 'token-b', businessTemplate: 'other' };
releaseTemplateRead({ businessTemplate: { templateKey: 'repair', schemaVersion: 1, config: {} } });
const staleResponseResult = await staleResponsePromise;
assert.equal(staleResponseResult, null);
assert.equal(staleResponseHarness.configWrites.length, 0,
  'late template responses must not update active config after a tenant/session switch');
assert.equal(staleResponseHarness.stateWrites.length, 0);
assert.equal(staleResponseHarness.localWrites.length, 0);

// Guard the real sanitizer implementation used by catalog pull/push. The
// spread preserves item_type while the following fields normalize ID and price.
assert.match(onboardingHtml, /Choose your business type/,
  'merchant onboarding must make business type selection a primary entry point');
assert.doesNotMatch(onboardingHtml, /id="onboardingCurrency"/,
  'detailed currency configuration belongs in Business Settings, not first-experience onboarding');
assert.doesNotMatch(tenantAuthSource, /getElementById\('onboardingCurrency'\)|sellerName, businessType, country, currency, timezone/,
  'tenant onboarding must not require or submit a user-selected currency');

const settingsSource = await readFile(new URL('../app/src/ui/settings.js', import.meta.url), 'utf8');
const currencyConfigSource = await readFile(new URL('../app/src/config/currency.js', import.meta.url), 'utf8');
const appStateSource = await readFile(new URL('../app/src/state.js', import.meta.url), 'utf8');
assert.match(appStateSource, /currencyCode: 'ETB'/,
  'a fresh device must use ETB as the regional first-run fallback instead of the unrelated INR default');
assert.match(currencyConfigSource, /config\?\.currencyCode \|\| 'ETB'[\s\S]*?CURRENCY_SYMBOLS\.ETB/,
  'missing or unsupported currency settings must render the ETB symbol, not the legacy INR/Rupee fallback');
assert.match(onboardingHtml, /<option value="ETB" selected>Br ETB/,
  'Business Settings must present ETB as the visible first-run currency choice');
assert.match(onboardingHtml, /Business currency starts at ETB[\s\S]*?skip this step and choose it in Settings before adding priced catalog items/,
  'onboarding must guide non-ETB businesses to set canonical currency before creating monetary records');
assert.match(backendServerSource, /const tenantSettingsView = \(\{[\s\S]*?currency: tenant\.currency,[\s\S]*?\}\);[\s\S]*?sendJSON\(res, 200, \{ tenant: tenantSettingsView \}/,
  'authenticated tenant reads must expose canonical currency through a minimal settings view');
assert.match(tenantAuthSource, /async function loadCanonicalTenantCurrency\(\)[\s\S]*?currencyCode: currency[\s\S]*?saveJSON\(STORAGE_KEYS\.config, next\)/,
  'tenant authentication and switching must hydrate local money formatting from the canonical organization currency');
assert.match(tenantAuthSource, /const persisted = persistAuth\(data, data\.membership\)[\s\S]*?currencyCode: 'ETB'[\s\S]*?await loadCanonicalTenantCurrency\(\)[\s\S]*?showFirstProductStep/,
  'new-business first catalog entry must use the canonical currency before recording a price');
assert.match(backendServerSource, /'business_name', 'primary_color', 'logo_url', 'currency'[\s\S]*?INVALID_CURRENCY/,
  'tenant settings must validate and route intentional ISO currency changes to the canonical store');
assert.match(tenantStoreSource, /return tenant \? \{ \.\.\.tenant, currency: tenantCurrency\(key\) \} : null/,
  'tenant reads must expose the currency from the canonical organization row');
assert.match(tenantStoreSource, /Branding patches are partial[\s\S]*?current\.branding[\s\S]*?patch\.branding/,
  'currency-only updates must preserve existing storefront branding');
assert.match(tenantStoreSource, /code: 'CURRENCY_LOCKED'/,
  'the canonical store must reject currency changes after monetary records exist');
assert.match(settingsSource, /currencyHydrated[\s\S]*?\/tenants\//,
  'Settings must hydrate the active business currency from the authenticated tenant API');
assert.match(settingsSource, /currencyWasEdited[\s\S]*?requestedCurrency !== canonicalCurrency[\s\S]*?method: 'PATCH'[\s\S]*?branding: \{ currency: requestedCurrency \}/,
  'Settings must patch canonical currency only after an explicit selection change');
assert.match(settingsSource, /const updated = await update\.json\(\)\.catch\(\(\) => \(\{\}\)\);[\s\S]*?Active business changed\. Reopen Settings and try again\.[\s\S]*?canonicalCurrency = String\(updated\?\.tenant\?\.currency/,
  'a late currency PATCH response must not overwrite config after the active tenant/session changes');
assert.match(settingsSource, /currencyCode: canonicalCurrency[\s\S]*?currencySymbol: symInput\.value\.trim\(\)/,
  'a custom display symbol must not replace the canonical ISO currency code');
assert.doesNotMatch(onboardingHtml, /<option value="CUSTOM">/,
  'a display symbol must not be presented as a business currency code');
assert.match(onboardingHtml, /Optional display symbol override[\s\S]*?changes display only[\s\S]*?transaction, or settlement currency/,
  'display symbol override must remain separate from canonical monetary currencies');
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
assert.match(tenantAuthSource, /const locallySaved = await saveJSONAsync\(STORAGE_KEYS\.products, products\);[\s\S]*?if \(!locallySaved\) \{[\s\S]*?Local storage failed\.[\s\S]*?return;\s*\}\s*await markCatalogDirty\(\);\s*showOnboardingDone\(\);/,
  'first-offering onboarding must not mark the catalog dirty, report completion, or attempt remote sync if durable local persistence fails');
assert.match(tenantAuthSource, /const previousProducts = products;[\s\S]*?setProducts\(\[\.\.\.previousProducts, newProd\]\);[\s\S]*?if \(!locallySaved\) \{\s*setProducts\(previousProducts\);/,
  'failed first-offering persistence must roll back in-memory state so retry cannot duplicate the unsaved offering');

// Execute the actual onboarding function with controlled dependencies. A failed
// durable save must restore the original array and must not mark/sync/complete.
const addOfferingFunctionSource = tenantAuthSource.match(/export async function addOnboardingProduct\(\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(addOfferingFunctionSource, 'first-offering function must be extractable for behavioral failure testing');
const priorOnboardingProducts = [{ id: 'existing-item', name: 'Existing item', item_type: 'product', price: 100 }];
const onboardingFields = {
  onboardingProdName: { value: 'Consultation' },
  onboardingProdPrice: { value: '12.50' },
  onboardingProdStock: { value: '9' },
  onboardingItemType: { value: 'service' },
  onboardingStatus: { textContent: '' },
};
let attemptedLocalSave = null;
const attemptedLocalSaves = [];
let failLocalSave = true;
const onboardingHarness = {
  products: priorOnboardingProducts,
  config: { currencyCode: 'ETB', syncUrl: '', chatId: 'tenant-a', sessionToken: 'session-a' },
  STORAGE_KEYS: { products: 'products' },
  document: { getElementById: id => onboardingFields[id] || null },
  setProducts(next) { onboardingHarness.products = next; },
  saveJSONAsync: async (key, value) => {
    attemptedLocalSave = { key, value };
    attemptedLocalSaves.push({ key, value: structuredClone(value) });
    return !failLocalSave;
  },
  toMinorUnits: value => Math.round(Number(value) * 100),
  uid: () => 'unsaved-consultation',
  markCatalogDirty: async () => { onboardingHarness.catalogMarkedDirty = true; },
  showOnboardingDone: () => { onboardingHarness.completed = true; },
};
const addOnboardingOffering = vm.runInNewContext(
  '(' + addOfferingFunctionSource.replace('export async function', 'async function') + ')',
  onboardingHarness,
);
await addOnboardingOffering();
assert.equal(attemptedLocalSave?.key, 'products',
  'the first-offering path must attempt to persist the catalog under its canonical local-storage key');
assert.equal(attemptedLocalSave?.value?.length, 2,
  'the failed persistence attempt must contain the original catalog plus the proposed offering');
assert.equal(attemptedLocalSave?.value?.[1]?.name, 'Consultation',
  'the persistence attempt must contain the offering the merchant submitted');
assert.equal(attemptedLocalSave?.value?.[1]?.item_type, 'service',
  'service onboarding must persist service identity rather than silently converting to a product');
assert.equal(Object.hasOwn(attemptedLocalSave?.value?.[1] || {}, 'stock'), false,
  'service onboarding must not persist a physical-stock field');
assert.equal(onboardingHarness.products, priorOnboardingProducts,
  'failed durable save must restore the exact prior in-memory catalog array');
assert.deepEqual(onboardingHarness.products, priorOnboardingProducts,
  'failed durable save must not leave an unsaved offering in the catalog');
assert.equal(onboardingFields.onboardingStatus.textContent,
  'Local storage failed. The offering was not saved; retry when local storage is available.');
assert.equal(onboardingHarness.catalogMarkedDirty, undefined,
  'failed durable save must not mark the catalog for remote sync');
assert.equal(onboardingHarness.completed, undefined,
  'failed durable save must not complete the onboarding step');

// Recover from the same storage failure and retry the actual production
// function. The failed attempt must not leave a duplicate or hidden offering.
failLocalSave = false;
await addOnboardingOffering();
assert.equal(attemptedLocalSaves.length, 2, 'retry must perform one fresh durable save attempt');
assert.equal(attemptedLocalSaves[1].key, 'products');
assert.equal(attemptedLocalSaves[1].value.length, 2,
  'retry payload must contain exactly the existing item and one proposed offering');
assert.equal(JSON.stringify(onboardingHarness.products.map(item => item.id)),
  JSON.stringify(['existing-item', 'unsaved-consultation']),
  'successful retry must persist exactly one copy of the offering');
assert.equal(onboardingHarness.products.filter(item => item.id === 'unsaved-consultation').length, 1,
  'a failed first attempt must not cause duplicate offerings when retried');
assert.equal(onboardingHarness.catalogMarkedDirty, true,
  'successful retry may mark the catalog dirty only after local persistence succeeds');
assert.equal(onboardingHarness.completed, true,
  'successful retry may complete onboarding after durable local persistence');
assert.equal(onboardingFields.onboardingStatus.textContent,
  'Saved on this device. Connect this business to sync the offering.');

assert.match(tenantAuthSource, /const priceMinor = toMinorUnits\(priceMajor, config\.currencyCode\);[\s\S]*?if \(!Number\.isSafeInteger\(priceMinor\) \|\| priceMinor < 0 \|\| priceMinor > 2147483647\)[\s\S]*?Price is outside the supported range[\s\S]*?price: priceMinor,/,
  'first-offering onboarding must reject prices outside the backend-supported integer minor-unit range before local persistence or sync');
assert.match((await readFile(new URL('../app/src/storage/json.js', import.meta.url), 'utf8')), /export async function saveJSONAsync[\s\S]*?await idbSet\(key, value\)/,
  'critical onboarding persistence must await the IndexedDB transaction instead of fire-and-forget saveJSON');
assert.match(tenantAuthSource, /business-template[\s\S]*?method: 'PUT'[\s\S]*?templateKey: selectedTemplate/,
  'onboarding must persist the selected template through the tenant API, not only local storage');
assert.match(tenantAuthSource, /const pendingBusinessTemplateKey = chatId =>[\s\S]*?ledger_business_template_pending_v1:[\s\S]*?tenantId: templateTenantId[\s\S]*?saveJSONAsync\(pendingBusinessTemplateKey\(templateTenantId\), pendingTemplate\)[\s\S]*?await request\([\s\S]*?method: 'PUT'[\s\S]*?saveJSONAsync\(pendingBusinessTemplateKey\(templateTenantId\), \{ tenantId: templateTenantId, status: 'synced' \}\)/,
  'onboarding must durably record a tenant-scoped template retry before PUT and mark it synced after server acknowledgement');
assert.match(tenantAuthSource, /const pending = await loadJSONAsync\(pendingBusinessTemplateKey\(chatId\), null\)[\s\S]*?pending\.status !== 'pending'[\s\S]*?String\(pending\.tenantId\) !== chatId[\s\S]*?method: 'PUT'[\s\S]*?pending\.templateKey[\s\S]*?Offline or an older backend: retain the tenant-scoped marker for a later retry/,
  'startup must retry only the active tenant pending marker and retain it on network failure');
assert.match(tenantAuthSource, /const stillActive = \(\) =>[\s\S]*?if \(!stillActive\(\)\) return null;[\s\S]*?loadJSONAsync\(pendingBusinessTemplateKey\(chatId\), null\)/,
  'a tenant/session switch during template recovery must abort before applying or retrying stale tenant data');
assert.match(tenantAuthSource, /const templateSessionToken = String\(config\.sessionToken \|\| ''\)[\s\S]*?String\(config\.sessionToken \|\| ''\) !== templateSessionToken[\s\S]*?Authorization: `Bearer \$\{templateSessionToken\}`/,
  'onboarding template writes must use the captured tenant session and abort if active identity changes while persistence is pending');
assert.match(tenantAuthSource, /businessTemplateSchemaVersion: 1/,
  'the local template cache must carry an explicit schema version');
const windowAssignment = windowBridgeSource.match(/Object\.assign\(window,\s*\{([\s\S]*?)\n\s*\}\);/)?.[1] || '';
assert.match(windowAssignment, /\bapplyOnboardingBusinessTemplate\b/,
  'business-template onchange handler must be exposed on window');
assert.match(windowAssignment, /\btoggleOnboardingItemType\b/,
  'product/service onchange handler must be exposed on window');
assert.match(onboardingHtml, /id="onboardingAddOfferingButton"[^>]*>Add product</,
  'the first-offering action must have a stable target for type-specific labeling');
const itemTypeToggleMatch = tenantAuthSource.match(/export function toggleOnboardingItemType\(itemType\) \{[\s\S]*?\n\}/);
assert.ok(itemTypeToggleMatch, 'the onboarding offering-type selector handler must exist');
const onboardingElements = {
  onboardingProdStockWrap: { style: { display: '' } },
  onboardingItemNameLabel: { textContent: 'Product name' },
  onboardingProdName: { placeholder: 'Coffee' },
  onboardingAddOfferingButton: { textContent: 'Add product' },
};
const onboardingUiContext = {
  document: { getElementById: id => onboardingElements[id] || null },
};
vm.runInNewContext(itemTypeToggleMatch[0].replace(/^export /, ''), onboardingUiContext);
onboardingUiContext.toggleOnboardingItemType('service');
assert.equal(onboardingElements.onboardingProdStockWrap.style.display, 'none',
  'service offerings must not request physical stock');
assert.equal(onboardingElements.onboardingItemNameLabel.textContent, 'Service name');
assert.equal(onboardingElements.onboardingProdName.placeholder, 'Haircut or consultation');
assert.equal(onboardingElements.onboardingAddOfferingButton.textContent, 'Add service');
onboardingUiContext.toggleOnboardingItemType('product');
assert.equal(onboardingElements.onboardingProdStockWrap.style.display, '');
assert.equal(onboardingElements.onboardingItemNameLabel.textContent, 'Product name');
assert.equal(onboardingElements.onboardingProdName.placeholder, 'Coffee');
assert.equal(onboardingElements.onboardingAddOfferingButton.textContent, 'Add product');

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
assert.match(tenantAuthSource, /export async function restoreTenantStateForTenant\(chatId\)[\s\S]*?String\(snapshot\.tenantId\) !== tenantId[\s\S]*?saveJSONAsync\(entry\.storageKey, entry\.target\)[\s\S]*?entry\.setter\(entry\.target\)/,
  'tenant recovery must validate snapshot ownership and durably persist tenant values before exposing them in memory');

assert.match(tenantAuthSource, /const entries = tenantStateFields[\s\S]*?previous: structuredClone\(getValue\(\)\)[\s\S]*?const written = \[\];[\s\S]*?const saved = await saveJSONAsync\(entry\.storageKey, entry\.target\);[\s\S]*?if \(!saved\)[\s\S]*?saveJSONAsync\(prior\.storageKey, prior\.previous\)[\s\S]*?throw new Error\('Could not durably restore tenant state; synchronization was stopped'\)[\s\S]*?for \(const entry of entries\) entry\.setter\(entry\.target\)/,
  'tenant recovery must durably persist the complete target snapshot before exposing it in memory and roll back partial writes on failure');

assert.match(tenantAuthSource, /\['inventoryMovements',[\s\S]*?\['inventoryBalances',[\s\S]*?\['outboxEvents',[\s\S]*?\['stockTransactions'/,
  'tenant snapshots must include inventory projections and durable offline outbox events');
assert.match(tenantAuthSource, /\['currentOrder',[^\n]*null, \{\}\][\s\S]*?\['currentOrderNotes',[^\n]*null, \{\}\]/,
  'tenant switching must preserve the in-progress cart and its notes per business');
assert.match(tenantAuthSource, /if \(entry\.storageKey === null\) continue[\s\S]*?if \(storageKey === null\) continue/,
  'in-memory-only cart state must not be written under an invalid storage key during restore or tenant clearing');
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

assert.match(productsCatalogSource, /export async function markCatalogSynced\(\) \{[\s\S]*?const saved = await saveJSONAsync\(pendingCatalogKey\(chatId\), null\);[\s\S]*?if \(!saved\) \{[\s\S]*?catalogDirty = true;[\s\S]*?return false;[\s\S]*?\}\s*catalogDirty = false;/,
  'catalog dirty state must remain set unless clearing the durable tenant pending marker succeeds');
assert.match(catalogSource, /if \(!\(await markCatalogSynced\(\)\)\) \{[\s\S]*?pending catalog snapshot; pending sync state was retained/,
  'catalog sync must not report success when durable pending-snapshot clearance fails');
assert.match(catalogSource, /if \(!\(await markCatalogSynced\(\)\)\) \{[\s\S]*?setProducts\(previousProducts\);\s*return;/,
  'background refresh must restore prior products when the pending snapshot cannot be durably cleared');

assert.match(catalogSource, /if \(isCatalogDirty\(\)\) return;/,
  'background catalog pull must not replace locally dirty catalog state');
assert.match(catalogSource, /if \(Array\.isArray\(data\.products\)\) \{[\s\S]*?setProducts\(sanitizeRemoteProducts\(data\.products\)\)/,
  'remote catalog pull must apply an empty canonical catalog instead of retaining stale local products');
assert.match(catalogSource, /const previousProducts = products;[\s\S]*?const remoteProducts = sanitizeRemoteProducts\(data\.products\);[\s\S]*?setProducts\(remoteProducts\);[\s\S]*?const saved = await saveJSONAsync\(STORAGE_KEYS\.products, remoteProducts\);[\s\S]*?if \(!saved\) \{[\s\S]*?setProducts\(previousProducts\);\s*return;[\s\S]*?\}[\s\S]*?if \(!\(await markCatalogSynced\(\)\)\) \{[\s\S]*?setProducts\(previousProducts\);\s*return;/,
  'background catalog pull must durably persist the canonical response and clear its pending marker before replacing prior in-memory products');
assert.match(catalogSource, /setProducts\(data\.products \? sanitizeRemoteProducts\(data\.products\) : products\);\s*const saved = await saveJSONAsync\(STORAGE_KEYS\.products, products\);\s*if \(!saved\) throw new Error\([\s\S]*?\);\s*if \(!\(await markCatalogSynced\(\)\)\) \{[\s\S]*?throw new Error\([\s\S]*?pending catalog snapshot; pending sync state was retained[\s\S]*?\}/,
  'successful catalog sync must durably persist the server-confirmed catalog and clear the pending marker before reporting completion');
assert.match(catalogSource, /if \(!saved\) \{\s*throw new Error\('Could not persist the refreshed catalog locally; pending sync state was retained\.'\);\s*\}\s*if \(!\(await markCatalogSynced\(\)\)\) \{[\s\S]*?pending sync state was retained/,
  'stock-conflict refresh must not clear the pending marker if refreshed data or marker clearance cannot be persisted');

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
