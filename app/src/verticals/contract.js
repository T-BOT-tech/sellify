// Phase 13.1 — Vertical Pack Contract.
//
// This is a deliberately small, declarative contract. It does not load code,
// register routes dynamically, or create a second domain authority. A vertical
// pack describes its identity, capabilities, configuration, permissions,
// domain-owned entities, core dependencies, and event/audit vocabulary.
//
// Core authorities remain outside the pack boundary: commerce/orders,
// inventory, payments, customers, locations, and fulfillment are consumed via
// declared dependencies rather than recreated by a vertical.

export const VERTICAL_PACK_CONTRACT_VERSION = '1.0';

export const CORE_AUTHORITIES = Object.freeze([
  'commerce',
  'inventory',
  'payments',
  'customers',
  'locations',
  'fulfillment',
  'documents',
  'audit',
]);

const RESERVED_CORE_ENTITIES = new Set([
  'order', 'orders',
  'inventory', 'inventory_movement', 'inventory_movements',
  'payment', 'payments',
  'customer', 'customers',
  'location', 'locations',
  'fulfillment', 'fulfillments',
]);

function fail(message) {
  throw new TypeError(`Invalid vertical pack: ${message}`);
}

function cleanString(value, field) {
  if (typeof value !== 'string' || !value.trim()) fail(`${field} must be a non-empty string`);
  return value.trim();
}

function cleanList(value, field) {
  if (!Array.isArray(value)) fail(`${field} must be an array`);
  const result = value.map((item) => cleanString(item, `${field} item`));
  if (new Set(result.map((item) => item.toLowerCase())).size !== result.length) {
    fail(`${field} must not contain duplicates`);
  }
  return result;
}

function cleanObject(value, field) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) fail(`${field} must be an object`);
  return { ...value };
}

function validateEntityOwnership(entities) {
  for (const entity of entities) {
    const normalized = entity.toLowerCase().replace(/[-\s]/g, '_');
    if (RESERVED_CORE_ENTITIES.has(normalized)) {
      fail(`domain entity "${entity}" is reserved by Core; verticals must bridge to Core instead`);
    }
  }
}

/**
 * Normalize and validate the Phase 13.1 pack manifest.
 *
 * The returned object is detached from the caller and deeply frozen for the
 * manifest's declarative fields. This makes the contract safe to keep as a
 * static module constant without introducing a runtime plugin loader.
 */
export function defineVerticalPack(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail('manifest must be an object');
  }

  const packId = cleanString(input.pack_id, 'pack_id').toLowerCase();
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(packId)) {
    fail('pack_id must use lowercase letters, numbers, dots, underscores, or hyphens and start with a letter');
  }

  const name = cleanString(input.name, 'name');
  const version = cleanString(input.version, 'version');
  const capabilities = cleanList(input.capabilities || [], 'capabilities');
  const optionalCapabilities = cleanList(input.optional_capabilities || [], 'optional_capabilities');
  const roles = cleanList(input.roles || [], 'roles');
  const navigationContributions = cleanList(input.navigation_contributions || [], 'navigation_contributions');
  const deviceRequirements = cleanList(input.device_requirements || [], 'device_requirements');
  const offlineRequirements = cleanList(input.offline_requirements || [], 'offline_requirements');
  const localizationResources = cleanList(input.localization_resources || [], 'localization_resources');
  const permissions = cleanList(input.permissions || [], 'permissions');
  const domainEntities = cleanList(input.domain_entities || [], 'domain_entities');
  const coreDependencies = cleanList(input.core_dependencies || [], 'core_dependencies');
  const events = cleanList(input.events || [], 'events');
  const configuration = cleanObject(input.configuration, 'configuration');
  const routes = cleanList(input.routes || [], 'routes');
  const uiEntryPoints = cleanList(input.ui_entry_points || [], 'ui_entry_points');

  for (const dependency of coreDependencies) {
    if (!CORE_AUTHORITIES.includes(dependency.toLowerCase())) {
      fail(`unknown core dependency "${dependency}"`);
    }
  }
  validateEntityOwnership(domainEntities);

  return Object.freeze({
    contract_version: VERTICAL_PACK_CONTRACT_VERSION,
    pack_id: packId,
    name,
    version,
    capabilities: Object.freeze(capabilities),
    optional_capabilities: Object.freeze(optionalCapabilities),
    roles: Object.freeze(roles),
    navigation_contributions: Object.freeze(navigationContributions),
    device_requirements: Object.freeze(deviceRequirements),
    offline_requirements: Object.freeze(offlineRequirements),
    localization_resources: Object.freeze(localizationResources),
    configuration: Object.freeze(configuration),
    permissions: Object.freeze(permissions),
    domain_entities: Object.freeze(domainEntities),
    core_dependencies: Object.freeze(coreDependencies),
    routes: Object.freeze(routes),
    ui_entry_points: Object.freeze(uiEntryPoints),
    events: Object.freeze(events),
  });
}

export function isVerticalPack(value) {
  try {
    defineVerticalPack(value);
    return true;
  } catch {
    return false;
  }
}
