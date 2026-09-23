// Phase 13.9.9 — Warehouse Configuration Contract.
// Formalizes the existing configuration authority without creating a second store.

const DEFAULT_WAREHOUSE_ENABLED = false;

function text(value, field, required = true) {
  const result = String(value ?? '').trim();
  if (required && !result) throw new TypeError(`Warehouse ${field} must be a non-empty string`);
  return result || null;
}

export function getWarehouseConfiguration({ config } = {}) {
  if (!config || typeof config !== 'object') throw new TypeError('Warehouse config is required');
  return Object.freeze({
    warehouse_enabled: config.warehouseEnabled === undefined ? DEFAULT_WAREHOUSE_ENABLED : Boolean(config.warehouseEnabled),
    organization_id: text(config.organizationId, 'organizationId', false),
    location_id: text(config.locationId, 'locationId', false),
    authority: 'app/src/state.js#config',
    persistence: 'STORAGE_KEYS.config',
  });
}

export function warehouseConfigurationContract() {
  return Object.freeze({
    feature_flag: 'config.warehouseEnabled',
    default_warehouse_enabled: DEFAULT_WAREHOUSE_ENABLED,
    configuration_authority: 'app/src/state.js#config',
    persistence_authority: 'STORAGE_KEYS.config',
    organization_scope: 'config.organizationId',
    selected_location: 'config.locationId',
    canonical_locations: 'state.organizationLocations',
    legacy_storage_bins: 'state.warehouseLocations',
    duplicate_configuration_authority: false,
    persistence: 'existing_config_store_only',
  });
}

export function isWarehouseConfiguration(value) {
  return Boolean(value && typeof value === 'object' &&
    typeof value.warehouse_enabled === 'boolean' &&
    (value.organization_id === null || typeof value.organization_id === 'string') &&
    (value.location_id === null || typeof value.location_id === 'string') &&
    value.authority === 'app/src/state.js#config' &&
    value.persistence === 'STORAGE_KEYS.config');
}
