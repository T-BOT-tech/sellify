import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), 'utf8');
const html = read('../app/index.html');
const catalog = read('../app/src/products/catalog.js');
const sync = read('../app/src/sync/catalog.js');
const inventory = read('../app/src/warehouse/inventory.js');
const productRenderer = read('../app/src/products/render.js');

const checkout = read('../app/src/orders/checkout.js');
assert.match(checkout, /return \{ id: p\.id, name: note \? .*qty, price: effectiveUnitPrice\(p, qty\) \};/,
  'checkout lines retain the persisted catalog item identifier');
assert.doesNotMatch(checkout.slice(checkout.indexOf('export function checkoutTelegramWebApp()'), checkout.indexOf('export function recordTelegramSentOrder')),
  /type\s*:\s*p\.type/,
  'checkout does not turn client-supplied item type into fulfillment authority');
const state = read('../app/src/state.js');
const localeFiles = ['en', 'am', 'om', 'so', 'sw', 'es', 'hi'].map(lang =>
  read(`../app/src/i18n/locales/${lang}.js`)
);
for (const key of ['catalogItemType', 'physicalProduct', 'service', 'marketplaceServiceUnsupported']) {
  for (const [index, locale] of localeFiles.entries()) {
    assert.match(locale, new RegExp('\\b' + key + '\\s*:'),
      `translation key ${key} exists in supported locale index ${index}`);
  }
}
assert.ok(html.includes('<label for="newProdType" data-i18n="catalogItemType">Item type</label>'),
  'item type selector has a visible translated accessible label');
assert.ok(html.includes('<option value="product" data-i18n="physicalProduct">Physical product</option>'),
  'physical product option uses existing i18n updater');
assert.ok(html.includes('<option value="service" data-i18n="service">Service</option>'),
  'service option uses existing i18n updater');
assert.ok(catalog.includes("escapeHtml(t('service'))"),
  'catalog service badge is localized');
assert.ok(catalog.includes("t('marketplaceServiceUnsupported')"),
  'marketplace restriction tooltip is localized');

assert.match(html, /<select id="newProdType"[^>]*>[\s\S]*?<option value="product" data-i18n="physicalProduct">Physical product<\/option>[\s\S]*?<option value="service" data-i18n="service">Service<\/option>/,
  'first-time catalog form exposes translated physical product and service choices');
assert.match(catalog, /const type = typeSel && typeSel\.value === 'service' \? 'service' : 'product';/,
  'catalog creation defaults safely to physical product and records explicit service type');
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
assert.equal((productRenderer.match(/t\('service'\)/g) || []).length, 2,
  'localized service identity is visible in both grid and list order-picker views');
assert.equal((productRenderer.match(/onclick="changeQty\('\$\{p\.id\}', 1\)"/g) || []).length, 2,
  'services remain selectable as order lines in both grid and list views');

console.log('FUX-58 First-Service Catalog Identity Source Regression: PASS');
console.log('Catalog create/save -> remote sanitize/hydrate -> stock-alert boundary: PASS');
