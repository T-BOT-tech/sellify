// Phase 21.10 — Agriculture Supply Integration.
//
// Agriculture remains authoritative for Farm / Plot / Season / Crop / Harvest /
// Supply / Commodity vocabulary. Phase 21 only projects those existing
// references into sourcing intelligence. Expected production is explicitly
// NOT Inventory, committed Supply, or canonical Supplier Network Capacity.
//
// No persistence, mutation, procurement, commerce, payment, inventory,
// fulfillment, logistics, ranking, authorization, or provider execution.

export const PHASE21_AGRICULTURE_SUPPLY_INTEGRATION_CONTRACT_VERSION = '1.0';
export const PHASE21_AGRICULTURE_SUPPLY_AUTHORITIES = Object.freeze({
  agriculture: 'agriculture',
  commodity: 'agriculture',
  product: 'existing product/catalog authority',
  inventory: 'existing inventory authority',
  supplierNetwork: 'supplier_network',
  procurement: 'existing procurement authority',
});

export const PHASE21_AGRICULTURE_PRODUCTION_STATES = Object.freeze([
  'EXPECTED',
  'RECORDED',
  'UNKNOWN',
]);

function invalid(message) {
  const error = new TypeError(`Invalid Phase 21 Agriculture supply integration: ${message}`);
  error.code = 'PHASE21_AGRICULTURE_SUPPLY_INTEGRATION_INVALID';
  throw error;
}

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) invalid(`${field} must be a non-empty string`);
  return result;
}

function optionalText(value) {
  if (value === undefined || value === null || value === '') return null;
  const result = String(value).trim();
  return result || null;
}

function positiveNumber(value, field) {
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0) invalid(`${field} must be a positive number`);
  return result;
}

function iso(value, field) {
  const result = text(value, field);
  const time = Date.parse(result);
  if (!Number.isFinite(time)) invalid(`${field} must be a valid ISO-8601 date/time`);
  return new Date(time).toISOString();
}

function reference(value, field, authority, entity) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${field} must be an object`);
  const id = text(value.id, `${field}.id`);
  const organizationId = optionalText(value.organization_id ?? value.organizationId);
  return Object.freeze({
    authority,
    entity,
    id,
    ...(organizationId ? { organizationId } : {}),
  });
}

function assertOrganization(expected, record, field) {
  if (!record) return;
  const organizationId = record.organization_id ?? record.organizationId;
  if (organizationId != null && String(organizationId) !== String(expected)) {
    invalid(`${field} belongs to a different organization`);
  }
}

function assertEntity(record, expectedType, field) {
  if (!record || record.entity_type !== expectedType) invalid(`${field} must reference ${expectedType}`);
}

/**
 * Project the existing Agriculture hierarchy into a Phase 21 sourcing context.
 * No Agriculture record is copied into a new authority or persisted here.
 */
export function projectAgricultureSupplyContext({
  farm,
  plot,
  season,
  crop,
  commodity,
  supply = null,
  harvest = null,
  product = null,
} = {}) {
  if (!commodity) invalid('commodity is required');
  assertEntity(commodity, 'Commodity', 'commodity');
  const organizationId = text(commodity.organization_id, 'commodity.organization_id');

  for (const [record, type, field] of [
    [farm, 'Farm', 'farm'],
    [plot, 'Plot', 'plot'],
    [season, 'Season', 'season'],
    [crop, 'Crop', 'crop'],
    [supply, 'Supply', 'supply'],
    [harvest, 'Harvest', 'harvest'],
  ]) {
    if (record) {
      assertEntity(record, type, field);
      assertOrganization(organizationId, record, field);
    }
  }

  if (farm && plot && plot.farm_id !== farm.id) invalid('plot must belong to farm');
  if (farm && season && season.farm_id !== farm.id) invalid('season must belong to farm');
  if (plot && crop && crop.plot_id !== plot.id) invalid('crop must belong to plot');
  if (season && crop && crop.season_id !== season.id) invalid('crop must belong to season');
  if (supply && supply.commodity_id !== commodity.id) invalid('supply must reference commodity');
  if (harvest && crop && harvest.crop_id !== crop.id) invalid('harvest must reference crop');
  if (supply && product && supply.product_id !== product.id) invalid('supply must reference supplied product');
  if (harvest && product && harvest.product_id !== product.id) invalid('harvest must reference supplied product');

  return Object.freeze({
    version: PHASE21_AGRICULTURE_SUPPLY_INTEGRATION_CONTRACT_VERSION,
    commodityReference: reference(commodity, 'commodityReference', 'agriculture', 'Commodity'),
    farmReference: farm ? reference(farm, 'farmReference', 'agriculture', 'Farm') : null,
    plotReference: plot ? reference(plot, 'plotReference', 'agriculture', 'Plot') : null,
    seasonReference: season ? reference(season, 'seasonReference', 'agriculture', 'Season') : null,
    cropReference: crop ? reference(crop, 'cropReference', 'agriculture', 'Crop') : null,
    supplyReference: supply ? reference(supply, 'supplyReference', 'agriculture', 'Supply') : null,
    harvestReference: harvest ? reference(harvest, 'harvestReference', 'agriculture', 'Harvest') : null,
    productReference: product ? reference(product, 'productReference', 'product_catalog', 'Product') : null,
    agricultureAuthority: 'agriculture',
    inventoryAuthority: 'existing inventory authority',
    supplierCapabilityAuthority: 'existing supplier-network capability authority',
    procurementAuthority: 'existing procurement authority',
    persistence: 'none',
    mutation: false,
    transactionExecution: false,
    providerExecution: false,
  });
}

/**
 * Represent Agriculture expected/recorded production as evidence for sourcing
 * coordination. This is deliberately not a Supplier Network capacity signal.
 */
export function projectAgricultureProductionObservation({
  crop,
  commodity,
  quantity,
  unit,
  state = 'EXPECTED',
  observedAt,
  validUntil = null,
  source = 'agriculture',
  provenance = null,
} = {}) {
  assertEntity(crop, 'Crop', 'crop');
  assertEntity(commodity, 'Commodity', 'commodity');
  const organizationId = text(commodity.organization_id, 'commodity.organization_id');
  assertOrganization(organizationId, crop, 'crop');

  if (crop.organization_id !== commodity.organization_id) invalid('crop and commodity must share organization');
  const normalizedState = String(state).trim().toUpperCase();
  if (!PHASE21_AGRICULTURE_PRODUCTION_STATES.includes(normalizedState)) {
    invalid(`state must be one of ${PHASE21_AGRICULTURE_PRODUCTION_STATES.join(', ')}`);
  }

  const normalizedQuantity = positiveNumber(quantity, 'quantity');
  const normalizedUnit = text(unit, 'unit');
  const normalizedObservedAt = iso(observedAt, 'observedAt');
  const normalizedValidUntil = validUntil == null ? null : iso(validUntil, 'validUntil');
  if (normalizedValidUntil && Date.parse(normalizedValidUntil) < Date.parse(normalizedObservedAt)) {
    invalid('validUntil must not be earlier than observedAt');
  }

  return Object.freeze({
    version: PHASE21_AGRICULTURE_SUPPLY_INTEGRATION_CONTRACT_VERSION,
    productionReference: Object.freeze({
      authority: 'agriculture',
      resource: 'agriculture_production_observation',
      id: `${crop.id}:${normalizedObservedAt}:${normalizedUnit}`,
    }),
    cropReference: reference(crop, 'cropReference', 'agriculture', 'Crop'),
    commodityReference: reference(commodity, 'commodityReference', 'agriculture', 'Commodity'),
    quantity: normalizedQuantity,
    unit: normalizedUnit,
    state: normalizedState,
    availabilityMeaning: normalizedState === 'RECORDED' ? 'recorded_agriculture_production' : 'expected_agriculture_production',
    observedAt: normalizedObservedAt,
    validUntil: normalizedValidUntil,
    source: text(source, 'source'),
    provenance: provenance && typeof provenance === 'object' && !Array.isArray(provenance)
      ? Object.freeze({ ...provenance })
      : null,
    isInventory: false,
    isCommittedSupply: false,
    isSupplierNetworkCapacity: false,
    isProcurementAward: false,
    persistence: 'none',
    mutation: false,
    transactionExecution: false,
  });
}

export function phase21AgricultureSupplyIntegrationContract() {
  return Object.freeze({
    version: PHASE21_AGRICULTURE_SUPPLY_INTEGRATION_CONTRACT_VERSION,
    agricultureAuthority: 'agriculture',
    commodityAuthority: 'agriculture',
    productAuthority: 'existing product/catalog authority',
    inventoryAuthority: 'existing inventory authority',
    supplierCapabilityAuthority: 'existing supplier-network capability authority',
    procurementAuthority: 'existing procurement authority',
    productionStates: [...PHASE21_AGRICULTURE_PRODUCTION_STATES],
    persistence: 'none',
    mutation: false,
    transactionExecution: false,
    providerExecution: false,
    principle: 'project Agriculture supply context and production evidence without converting expected production into inventory or supplier-network capacity',
  });
}
