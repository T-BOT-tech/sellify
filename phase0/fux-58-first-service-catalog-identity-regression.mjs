import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), 'utf8');
const html = read('../app/index.html');
const catalog = read('../app/src/products/catalog.js');
const sync = read('../app/src/sync/catalog.js');
const inventory = read('../app/src/warehouse/inventory.js');
const productRenderer = read('../app/src/products/render.js');
const checkout = read('../app/src/orders/checkout.js');
const state = read('../app/src/state.js');

assert.match(checkout, /return \{ id: p\.id, name: note \? .*qty, price: effectiveUnitPrice\(p, qty\) \};/,
  'checkout lines retain the persisted catalog item identifier');
assert.doesNotMatch(checkout.slice(checkout.indexOf('export function checkoutTelegramWebApp()'), checkout.indexOf('export function recordTelegramSentOrder')),
  /type\s*:\s*p\.type/,
  'checkout does not turn client-supplied item type into fulfillment authority');

assert.match(html, /<label for="newProdType" data-i18n="catalogItemType"[^>]*>Item type<\/label>[\s\S]*?<select id="newProdType"[^>]*>[\s\S]*?<option value="product" data-i18n="physicalProduct">Physical product<\/option>[\s\S]*?<option value="service" data-i18n="service">Service<\/option>/,
  'first-time catalog form exposes accessible, translatable physical product and service choices');
assert.match(catalog, /const type = typeSel && typeSel\.value === 'service' \? 'service' : 'product';/,
  'catalog creation defaults safely to physical product and records explicit service type');
assert.match(html, /id="onboardingProdType"[\s\S]*?value="product"[\s\S]*?value="service"/,
  'first-time onboarding lets merchants choose a physical product or service');
assert.match(html, /id="onboardingProdStockWrap"[\s\S]*?id="onboardingProdStock"/,
  'onboarding stock entry is grouped so it can be hidden for services');
const onboarding = read('../app/src/auth/tenant.js');
assert.match(onboarding, /function onboardingProdTypeChange\(\)[\s\S]{0,260}type === 'service' \? 'none' : ''/,
  'onboarding hides stock entry when the merchant selects a service');
assert.match(onboarding, /const type = typeInput\?\.value === 'service' \? 'service' : 'product';[\s\S]{0,500}type,[\s\S]{0,180}marketplace_listed: false/,
  'onboarding persists service identity without adding stock or enabling marketplace listing');
assert.match(catalog, /type,\s*[\s\S]{0,180}marketplace_listed: type === 'service' \? false/,
  'service creation persists its type and cannot enable unsupported marketplace listing');
assert.match(catalog, /products\.push\(newProd\);\s*saveJSON\(STORAGE_KEYS\.products, products\);/,
  'new catalog item is saved through the existing catalog storage key');
assert.match(sync, /return \{\s*\.\.\.p,\s*id: sanitizeId\(p\.id\)/,
  'remote catalog sanitizer preserves the canonical type field rather than rebuilding a parallel model');
assert.match(sync, /setProducts\(sanitizeRemoteProducts\(data\.products\)\);\s*saveJSON\(STORAGE_KEYS\.products, products\);/,
  'remote catalog hydration retains the sanitized records in existing local catalog storage');
assert.match(state, /export let products = loadJSON\(STORAGE_KEYS\.products, \[\]\);/,
  'reload hydrates the same existing catalog collection');
assert.match(inventory, /export function isStockTracked\(p\) \{[\s\S]{0,400}p\?\.type === 'service'\) return false;/,
  'service records are never stock-tracked');
assert.match(inventory, /export function getLowStockProducts\(\) \{[\s\S]{0,500}p\?\.type === 'service'\) return false;/,
  'service records are excluded from low-stock alerts');
assert.match(inventory, /export function getOutOfStockProducts\(\) \{[\s\S]{0,500}p\?\.type === 'service'\) return false;/,
  'service records are excluded from out-of-stock alerts');
assert.equal(productRenderer.split("escapeHtml(t('service'))").length - 1, 2,
  'service identity is localized in both grid and list order-picker views');
assert.match(catalog, /marketLabel\.title = isService \? t\('marketplaceServiceUnsupported'\) : '';/,
  'marketplace service restriction tooltip uses the shared translation contract');
assert.equal((productRenderer.match(/onclick="changeQty\('\$\{p\.id\}', 1\)"/g) || []).length, 2,
  'services remain selectable as order lines in both grid and list views');

const translations = read('../app/src/i18n/translations.js');
const i18n = read('../app/src/ui/i18n.js');
const locales = ['en', 'am', 'om', 'so', 'sw', 'es', 'hi', 'fr', 'ar', 'ha', 'yo', 'ru', 'pt'];
const localeKeys = ['catalogItemType', 'physicalProduct', 'service', 'marketplaceServiceUnsupported'];
for (const locale of locales) {
  const localeSource = read('../app/src/i18n/locales/' + locale + '.js');
  for (const key of localeKeys) {
    assert.ok(localeSource.includes(key + ':'), locale + ' locale defines ' + key);
  }
  assert.ok(translations.includes("import " + locale + " from './locales/" + locale + ".js'"), locale + ' locale is registered');
  assert.ok((html.split('<option value="' + locale + '">').length - 1) >= 2, locale + ' appears in both language selectors');
}
assert.ok(translations.includes('TRANSLATIONS = { en, am, om, so, sw, es, hi, fr, ar, ha, yo, ru, pt };'),
  'all six requested locales are included in the shared translation registry');
assert.ok(i18n.includes("document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';"),
  'Arabic enables right-to-left document direction while other locales remain left-to-right');

console.log('FUX-58 First-Service Catalog Identity Source Regression: PASS');
console.log('Catalog create/save -> remote sanitize/hydrate -> stock-alert boundary: PASS');
console.log('Service catalog localization coverage across 13 locale files and both selectors: PASS');
