import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ADD_MENU_ACTIONS } from '../app/src/ui/add-menu.js';

const [html, main, bridge, tabs, settings] = await Promise.all([
  readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/window-bridge.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/ui/tabs.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/ui/settings.js', import.meta.url), 'utf8'),
]);

assert.deepEqual(ADD_MENU_ACTIONS.map(({ id }) => id), [
  'take-order',
  'add-product',
  'discover-marketplace',
  'configure-packs-and-channels',
  'business-setup',
]);
assert.equal(ADD_MENU_ACTIONS.find(({ id }) => id === 'take-order').destination, 'order');
assert.equal(ADD_MENU_ACTIONS.find(({ id }) => id === 'add-product').destination, 'catalog');
assert.equal(ADD_MENU_ACTIONS.find(({ id }) => id === 'discover-marketplace').destination, 'marketplace');
assert.equal(ADD_MENU_ACTIONS.filter(({ destination }) => destination === 'settings').length, 2);

assert.match(html, /id="navAdd"[^>]*onclick="openAddSheet\(\)"/);
assert.match(html, /id="addSheet"/);
assert.ok(html.includes('onclick="openAddProduct();'));
assert.ok(html.includes('onclick="openAddSettings();'));
assert.match(html, /id="navQueue"/);
assert.ok(html.indexOf('id="navQueue"') > html.indexOf('id="moreSheet"'), 'Queue remains reachable in More');
assert.match(main, /from '\.\/ui\/add-menu\.js'/);
assert.match(bridge, /openAddSheet, closeAddSheet, openAddProduct, openAddSettings/);
assert.match(bridge, /Object\.assign\(window, \{[\s\S]*?openAddSheet, closeAddSheet, openAddProduct, openAddSettings,/);
assert.match(tabs, /const overflowIds = \['navQueue'/);
assert.match(tabs, /const overflowTabs = \['queue'/);
assert.match(settings, /renderPackReadinessPanel\(\)/);
assert.match(settings, /renderSellerStorefrontChannelsPanel\(\)/);

// Seller registration is deliberately not claimed as a working action until a
// canonical seller-onboarding flow exists; this menu only routes to existing surfaces.
assert.doesNotMatch(html, />Become a seller</);

// Exercise the menu handlers with a minimal DOM boundary, not only source matching.
const sheetClasses = new Set();
const sheet = {
  style: { display: 'none' },
  classList: {
    add(name) { sheetClasses.add(name); },
    remove(name) { sheetClasses.delete(name); },
  },
};
let switchedTab = null;
let settingsClicked = false;
let inputFocused = false;
let inputScrolled = false;
const input = {
  focus() { inputFocused = true; },
  scrollIntoView() { inputScrolled = true; },
};
const settingsButton = { click() { settingsClicked = true; } };
globalThis.document = {
  getElementById(id) {
    return ({
      addSheet: sheet,
      newProdName: input,
      gearSettingsBtn: settingsButton,
    })[id] ?? null;
  },
};
globalThis.window = {
  switchTab(tab) { switchedTab = tab; },
  setTimeout(callback) { callback(); },
};
assert.equal(openAddSheet(), true);
assert.equal(sheet.style.display, 'flex');
assert.ok(sheetClasses.has('open'));
assert.equal(closeAddSheet(), true);
assert.equal(sheet.style.display, 'none');
assert.ok(!sheetClasses.has('open'));
assert.equal(openAddProduct(), true);
assert.equal(switchedTab, 'catalog');
assert.ok(inputFocused);
assert.ok(inputScrolled);
assert.equal(openAddSettings(), true);
assert.ok(settingsClicked);
delete globalThis.document;
delete globalThis.window;

console.log('Ecosystem Add menu regression passed (navigation, DOM handlers, Queue overflow, settings/readiness boundary).');
