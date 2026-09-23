// Phase 13.10 — Logistics configuration contract.
// Existing config state remains the only feature-flag/configuration authority.

const DEFAULT_LOGISTICS_ENABLED = false;

export function getLogisticsConfiguration({ config } = {}) {
  if (!config || typeof config !== 'object') throw new TypeError('Logistics config is required');
  return Object.freeze({
    logistics_enabled: config.logisticsEnabled === undefined
      ? DEFAULT_LOGISTICS_ENABLED
      : Boolean(config.logisticsEnabled),
    organization_id: config.organizationId ? String(config.organizationId) : null,
    location_id: config.locationId ? String(config.locationId) : null,
    authority: 'app/src/state.js#config',
    persistence: 'STORAGE_KEYS.config',
  });
}

export function logisticsConfigurationContract() {
  return Object.freeze({
    feature_flag: 'config.logisticsEnabled',
    default_logistics_enabled: DEFAULT_LOGISTICS_ENABLED,
    configuration_authority: 'app/src/state.js#config',
    persistence_authority: 'STORAGE_KEYS.config',
    organization_scope: 'config.organizationId',
    selected_location: 'config.locationId',
    duplicate_configuration_authority: false,
    persistence: 'existing_config_store_only',
  });
}
