// FUX-57 — canonical business location management authority regression.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const locations = fs.readFileSync('app/src/warehouse/locations.js', 'utf8');
const ui = fs.readFileSync('app/src/warehouse/ui.js', 'utf8');
const bridge = fs.readFileSync('app/src/window-bridge.js', 'utf8');
const main = fs.readFileSync('app/src/main.js', 'utf8');
const html = fs.readFileSync('app/index.html', 'utf8');
const server = fs.readFileSync('backend/server.js', 'utf8');
const store = fs.readFileSync('backend/lib/store-sqlite.js', 'utf8');

assert(locations.includes('/locations'));
assert(locations.includes("method: id ? 'PATCH' : 'POST'"));
assert(locations.includes('includeInactive: true'));
assert(locations.includes('openOrganizationLocationModal'));
assert(locations.includes('saveOrganizationLocationModal'));
assert(ui.includes('Canonical business locations'));
assert(ui.includes('Storage bins (legacy compatibility)'));
assert(ui.includes('includeInactive: tab === \'locations\''));
assert(bridge.includes('openOrganizationLocationModal'));
assert(bridge.includes('saveOrganizationLocationModal'));
assert(main.includes('openOrganizationLocationModal'));
assert(html.includes('organizationLocationModal'));
assert(html.includes('organizationLocationCode'));
assert(server.includes("pattern: /^\\/tenants\\/([^/]+)\\/locations$/"));
assert(server.includes('handleLocationCreate'));
assert(server.includes('handleLocationPatch'));
assert(server.includes('locations:manage'));
assert(store.includes('createOrganizationLocation'));
assert(store.includes('updateOrganizationLocation'));
assert(store.includes('UNIQUE(organization_id, code)'));

console.log('FUX-57 canonical business location management authority regression: PASS');
