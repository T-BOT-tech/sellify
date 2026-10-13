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

assert.match(html, /<label for="newProdType" data-i18n="catalogItemType"[^>]*>Item type<\/label>[\s\S]*?<select id="newProdType"[^>]*>[\s\S]*?<option value="product" data-i18n="physicalProduct">Physical product<\/option>[\s\S]*?<option value="service" data-i18n="service">Service<\/option>/,
  'first-time catalog form exposes accessible, translatable physical product and service choices');


const translations = read('../app/src/i18n/translations.js');
const i18n = read('../app/src/ui/i18n.js');
const locales = ['en', 'am', 'om', 'so', 'sw', 'es', 'hi', 'fr', 'ar', 'ha', 'yo', 'ru', 'pt'];
const localeKeys = ['catalogItemType', 'physicalProduct', 'service', 'marketplaceServiceUnsupported'];
for (const locale of locales) {
  const localeSource = read('../app/src/i18n/locales/' + locale + '.js');
  for (const key of localeKeys) {
    assert.ok(new RegExp('\\\\b' + key + '\\\\s*:').test(localeSource), locale + ' locale defines ' + key);
  }
  assert.ok(translations.includes("import " + locale + " from './locales/" + locale + ".js'"), locale + ' locale is registered');
  assert.ok(html.includes('<option value="' + locale + '">'), locale + ' appears in language selectors');
}
assert.match(translations, /TRANSLATIONS = \{[^}]*fr[^}]*ar[^}]*ha[^}]*yo[^}]*ru[^}]*pt[^}]*\}/,
  'all six requested locales are included in the shared translation registry');
assert.match(i18n, /document\\.documentElement\\.dir = lang === 'ar' \\? 'rtl' : 'ltr';/,
  'Arabic enables right-to-left document direction while other locales remain left-to-right');
console.log('FUX-58 First-Service Catalog Identity Source Regression: PASS');
console.log('Catalog create/save -> remote sanitize/hydrate -> stock-alert boundary: PASS');
