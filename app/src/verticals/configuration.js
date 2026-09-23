// Phase 13.13 — Vertical Pack Configuration Contract.
//
// Configuration is a composition boundary, not an authorization, identity,
// persistence, event, or domain authority. Existing app/src/state.js#config
// remains the canonical persisted configuration store. This module resolves
// pack configuration without writing storage or changing existing feature
// consumers.

export const VERTICAL_CONFIGURATION_CONTRACT_VERSION = '1.0';

const PACK_RULES = Object.freeze({
  agriculture: Object.freeze({
    activation: 'declarative_only',
    feature_flag: null,
    default_enabled: null,
  }),
  restaurant: Object.freeze({
    activation: 'business_model',
    feature_flag: 'businessModel',
    enabled_value: 'restaurant',
    default_enabled: false,
  }),
  warehouse: Object.freeze({
    activation: 'feature_flag',
    feature_flag: 'warehouseEnabled',
    default_enabled: false,
  }),
  logistics: Object.freeze({
    activation: 'feature_flag',
    feature_flag: 'logisticsEnabled',
    default_enabled: false,
  }),
});

const CONFIG_KEYS = Object.freeze([
  'businessModel',
  'niche',
  'wholesaleEnabled',
  'volumeDiscountEnabled',
  'warehouseEnabled',
  'logisticsEnabled',
]);

function cleanPackId(packId) {
  const value = String(packId ?? '').trim().toLowerCase();
  if (!PACK_RULES[value]) throw new TypeError(`Unknown vertical pack: ${packId}`);
  return value;
}

function cleanConfig(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return value;
}

function scopedOverride(value, field, expectedOrganizationId, expectedLocationId) {
  if (value == null) return {};
  const input = cleanConfig(value, field);
  if (input.organizationId !== undefined && expectedOrganizationId !== undefined &&
      input.organizationId !== expectedOrganizationId) {
    throw new TypeError(`${field} organization scope mismatch`);
  }
  if (input.locationId !== undefined && expectedLocationId !== undefined &&
      input.locationId !== expectedLocationId) {
    throw new TypeError(`${field} location scope mismatch`);
  }
  return input;
}

function mergeKnown(target, source) {
  for (const key of CONFIG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
  }
}

function resolveEnabled(packId, config) {
  const rule = PACK_RULES[packId];
  if (rule.activation === 'declarative_only') return null;
  if (rule.activation === 'business_model') return config.businessModel === rule.enabled_value;
  return config[rule.feature_flag] === undefined
    ? rule.default_enabled
    : Boolean(config[rule.feature_flag]);
}

export function getVerticalPackConfiguration({
  packId,
  config,
  organizationConfig,
  locationConfig,
  overrides,
  organizationId,
  locationId,
} = {}) {
  const id = cleanPackId(packId);
  const base = cleanConfig(config, 'config');
  const org = scopedOverride(organizationConfig, 'organizationConfig', organizationId, undefined);
  const location = scopedOverride(locationConfig, 'locationConfig', organizationId, locationId);
  const explicit = scopedOverride(overrides, 'overrides', organizationId, locationId);

  // Precedence is deliberately deterministic and narrow:
  // defaults → existing persisted config → organization override → location
  // override → explicit runtime override. No layer is persisted here.
  const effective = {};
  const rule = PACK_RULES[id];
  if (rule.default_enabled !== null) {
    effective[rule.feature_flag] = rule.default_enabled;
  }
  mergeKnown(effective, base);
  mergeKnown(effective, org);
  mergeKnown(effective, location);
  mergeKnown(effective, explicit);

  return Object.freeze({
    contract_version: VERTICAL_CONFIGURATION_CONTRACT_VERSION,
    pack_id: id,
    enabled: resolveEnabled(id, effective),
    configuration: Object.freeze({ ...effective }),
    organization_id: organizationId ?? effective.organizationId ?? null,
    location_id: locationId ?? effective.locationId ?? null,
    authority: 'app/src/state.js#config',
    persistence: 'STORAGE_KEYS.config',
    precedence: Object.freeze([
      'defaults',
      'existing_config',
      'organization_override',
      'location_override',
      'runtime_override',
    ]),
  });
}

export function verticalConfigurationContract() {
  return Object.freeze({
    contract_version: VERTICAL_CONFIGURATION_CONTRACT_VERSION,
    configuration_authority: 'app/src/state.js#config',
    persistence_authority: 'STORAGE_KEYS.config',
    precedence: Object.freeze([
      'defaults',
      'existing_config',
      'organization_override',
      'location_override',
      'runtime_override',
    ]),
    packs: Object.freeze(Object.fromEntries(
      Object.entries(PACK_RULES).map(([packId, rule]) => [packId, Object.freeze({ ...rule })])
    )),
    supported_keys: CONFIG_KEYS,
    persistence: 'existing_config_store_only',
    duplicate_configuration_authority: false,
    authorization_authority: 'backend/lib/authorization.js',
    event_outbox_authority: 'existing_transactional_outbox_boundary',
  });
}

export function isVerticalPackConfiguration(value) {
  return Boolean(value && typeof value === 'object' &&
    typeof value.pack_id === 'string' &&
    Object.prototype.hasOwnProperty.call(PACK_RULES, value.pack_id) &&
    (value.enabled === null || typeof value.enabled === 'boolean') &&
    value.authority === 'app/src/state.js#config' &&
    value.persistence === 'STORAGE_KEYS.config');
}
