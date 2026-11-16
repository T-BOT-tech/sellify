import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const store = read('backend/lib/store-sqlite.js');
const server = read('backend/server.js');
const auth = read('backend/lib/authorization.js');
const registry = read('backend/lib/resource-action-registry.js');
const ui = read('app/src/logistics/service-bookings.js');

assert.match(store, /if \(!applied\.includes\(78\)\)/);
assert.match(store, /CREATE TABLE IF NOT EXISTS service_resources/);
assert.match(store, /CREATE TABLE IF NOT EXISTS service_resource_commands/);
assert.match(store, /export async function listServiceResources/);
assert.match(store, /export async function createServiceResource/);
assert.match(store, /export async function updateServiceResource/);
assert.match(store, /BEGIN IMMEDIATE/);
assert.match(store, /SERVICE_RESOURCE_VERSION_CONFLICT/);
assert.match(store, /SERVICE_RESOURCE_IDEMPOTENCY_CONFLICT/);
assert.match(store, /SERVICE_RESOURCE_CATALOG_BINDING_INVALID/);
assert.match(store, /item_type \?\? product\.type/);
assert.match(store, /services\.resource\.created/);
assert.match(store, /services\.resource\.updated/);
assert.match(store, /location_id IS NULL OR location_id = \?/);

assert.match(server, /listServiceResources, createServiceResource, updateServiceResource/);
assert.match(server, /service-resources/);
assert.match(server, /service:service_resource:view/);
assert.match(server, /service:service_resource:manage/);
assert.match(server, /existingLocation/);
assert.match(server, /destination location/);
assert.match(server, /Organization-wide service resources require organization-level scope/);
assert.match(server, /handleServiceResources/);
assert.match(store, /Object\.prototype\.hasOwnProperty\.call\(input, 'location_id'\)/);
assert.match(auth, /'service:service_resource:view', 'service:service_resource:manage'/);
assert.match(registry, /\['service', 'service_resource', 'view', 'service:service_resource:view'\]/);
assert.match(registry, /\['service', 'service_resource', 'manage', 'service:service_resource:manage'\]/);

assert.match(ui, /canManageServiceResources/);
assert.match(ui, /serviceResourceForm/);
assert.match(ui, /service-resource-toggle/);
assert.match(ui, /service-resource-rename/);
assert.match(ui, /serviceResourceUnknownStale/);
assert.match(ui, /serviceResourceReady/);
assert.match(ui, /serviceResourceEmpty/);
assert.match(ui, /Idempotency-Key/);
assert.match(ui, /expected_version/);

const localeNames = ['en', 'am', 'om', 'so', 'sw', 'es', 'hi', 'fr', 'ar', 'ha', 'yo', 'ru', 'pt'];
const keys = [
  'serviceResourceTitle', 'serviceResourceDescription', 'serviceResourceName',
  'serviceResourceDescriptionField', 'serviceResourceCreate', 'serviceResourceLoading',
  'serviceResourceReady', 'serviceResourceEmpty', 'serviceResourceLoadFailed',
  'serviceResourceSaveFailed', 'serviceResourceRename', 'serviceResourceRenamePrompt',
  'serviceResourceActivate', 'serviceResourceDeactivate', 'serviceResourceUnknownStale',
  'serviceResourceAllServices', 'serviceResourceOrganizationWide', 'serviceResourceTypeProvider',
  'serviceResourceTypeFacility', 'serviceResourceTypeEquipment', 'serviceResourceTypeOther',
];
for (const locale of localeNames) {
  const source = read('app/src/i18n/locales/' + locale + '.js');
  for (const key of keys) {
    const count = source.match(new RegExp('\\b' + key + '\\s*:', 'g')) || [];
    assert.equal(count.length, 1, locale + ' must define ' + key + ' exactly once');
  }
}

console.log('SC-03.1 Service Resource Foundation Regression: PASS');
console.log('Tenant-scoped resource persistence, optimistic versioning and idempotent commands: SOURCE CHECK PASS');
console.log('Catalog service-only binding and canonical location scope: SOURCE CHECK PASS');
console.log('Central authorization and Org Admin / Manager UI integration: SOURCE CHECK PASS');
console.log('13 locale resource-management translations: PASS');
console.log('Availability, scheduling and appointment commitment are not introduced by SC-03.1.');
