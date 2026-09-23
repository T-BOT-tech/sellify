// Phase 13.9.12 — Warehouse legacy storage-bin compatibility contract.
//
// This module is declarative/read-only. It deliberately preserves the legacy
// warehouseLocations state/storage shape and does not migrate it into the
// canonical Organization Location registry.

const text = (value) => typeof value === 'string' ? value.trim() : '';

export function isLegacyWarehouseBin(value) {
  return Boolean(value && text(value.id) && text(value.name));
}

export function getLegacyWarehouseBins(warehouseLocations = []) {
  if (!Array.isArray(warehouseLocations)) {
    throw new TypeError('warehouseLocations must be an array');
  }
  return warehouseLocations
    .filter(isLegacyWarehouseBin)
    .map((bin) => Object.freeze({ id: String(bin.id), name: String(bin.name) }));
}

export function legacyWarehouseBinCompatibilityContract() {
  return Object.freeze({
    authority: 'app/src/warehouse/locations.js#warehouseLocations',
    state: 'state.warehouseLocations',
    storage_key: 'STORAGE_KEYS.warehouseLocations',
    purpose: 'legacy warehouse storage-bin metadata',
    canonical_location_authority: 'core.locations',
    canonical_location_state: 'state.organizationLocations',
    canonical_location_selection: 'config.locationId',
    merge_into_organization_locations: false,
    promote_to_canonical_location: false,
    migration_required: false,
    persistence: 'existing warehouseLocations save/load path',
    compatibility: 'preserve existing {id,name} bin records',
    duplicate_authority: false,
  });
}

export function isLegacyWarehouseBinCompatibilityContract(value) {
  return Boolean(
    value &&
    value.authority === 'app/src/warehouse/locations.js#warehouseLocations' &&
    value.state === 'state.warehouseLocations' &&
    value.storage_key === 'STORAGE_KEYS.warehouseLocations' &&
    value.canonical_location_authority === 'core.locations' &&
    value.canonical_location_state === 'state.organizationLocations' &&
    value.merge_into_organization_locations === false &&
    value.promote_to_canonical_location === false &&
    value.migration_required === false &&
    value.duplicate_authority === false
  );
}
