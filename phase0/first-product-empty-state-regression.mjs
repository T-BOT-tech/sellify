import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const render = await readFile(new URL('../app/src/products/render.js', import.meta.url), 'utf8');
const catalog = await readFile(new URL('../app/src/products/catalog.js', import.meta.url), 'utf8');
const permissions = await readFile(new URL('../app/src/auth/permissions.js', import.meta.url), 'utf8');
const english = await readFile(new URL('../app/src/i18n/locales/en.js', import.meta.url), 'utf8');

// Empty catalog gets a clear route to the existing catalog form.
assert.match(render, /if \(products\.length === 0\)/);
assert.match(render, /t\('noProducts'\)/);
assert.match(render, /t\('addFirstProduct'\)/);
assert.match(render, /switchTab\('catalog'\)/);

// CTA follows the same inventory:add permission used by catalog creation.
assert.match(render, /hasPermission\(currentStaff \? currentStaff\.role : 'owner', 'inventory:add'\)/);
assert.match(catalog, /hasPermission\(currentStaff \? currentStaff\.role : 'owner', 'inventory:add'\)/);
assert.match(permissions, /'inventory:add'/);

// Keep the empty-catalog action separate from the search/category no-match state.
const emptyCatalogIndex = render.indexOf('if (products.length === 0)');
const filteredEmptyIndex = render.indexOf('if (filtered.length === 0)');
assert.ok(emptyCatalogIndex >= 0 && filteredEmptyIndex > emptyCatalogIndex);
assert.match(english, /addFirstProduct: "Add your first product"/);

console.log('First Product Empty State Regression: PASS');
