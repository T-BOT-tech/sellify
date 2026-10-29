import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const render = await read('../app/src/products/render.js');
const catalog = await read('../app/src/products/catalog.js');
const permissions = await read('../app/src/auth/permissions.js');

// Only a truly empty catalog gets the creation CTA; search/category no-match stays distinct.
const emptyIndex = render.indexOf('if (products.length === 0)');
const filteredIndex = render.indexOf('if (filtered.length === 0)');
assert.ok(emptyIndex >= 0 && filteredIndex > emptyIndex);
const emptyBlock = render.slice(emptyIndex, render.indexOf('let filtered =', emptyIndex));
assert.match(emptyBlock, /t\('noProducts'\)/);
assert.match(emptyBlock, /t\('add'\)/);
assert.match(emptyBlock, /switchTab\('catalog'\)/);
assert.match(emptyBlock, /hasPermission\(currentStaff \? currentStaff\.role : 'owner', 'inventory:add'\)/);
assert.match(catalog, /hasPermission\(currentStaff \? currentStaff\.role : 'owner', 'inventory:add'\)/);
assert.match(permissions, /inventory:add/);
assert.doesNotMatch(render.slice(filteredIndex, render.indexOf('const restaurant', filteredIndex)), /switchTab\('catalog'\)/,
  'filtered no-match state must not be misrepresented as an empty catalog');
console.log('First product empty-state regression: 8 PASS');
