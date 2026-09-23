// Phase 13.9.5 — Warehouse -> Core Location bridge contract.
// Compatibility bridge only: Core Organization Locations remain the canonical
// location authority. Warehouse storage bins remain a separate legacy concept.
// This module resolves an active Core location into a read-only Warehouse
// location context and never creates, mutates, or persists locations.

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Warehouse ${field} must be a non-empty string`);
  return result;
}

function activeCoreLocation(locationId, organizationLocations) {
  const id = text(locationId, 'location_id');
  const location = (organizationLocations || []).find(
    candidate => String(candidate?.id) === id && candidate?.status === 'active'
  );
  if (!location) throw new TypeError(`Warehouse location ${id} is not an active Core location`);
  return location;
}

export function getWarehouseLocationContext({ organizationId, locationId, organizationLocations } = {}) {
  const org = text(organizationId, 'organization_id');
  const location = activeCoreLocation(locationId, organizationLocations);
  const locationOrg = location.organization_id ?? location.organizationId;
  if (locationOrg !== undefined && String(locationOrg) !== org) {
    throw new TypeError('Warehouse location belongs to a different organization');
  }

  return Object.freeze({
    organization_id: org,
    location_id: String(location.id),
    location_code: String(location.code ?? ''),
    location_name: String(location.name ?? ''),
    location_type: String(location.type ?? 'UNKNOWN'),
    location_status: 'active',
    core_location_type: 'organization_location',
  });
}

export function getWarehouseLocationContexts(locationIds, options = {}) {
  if (!Array.isArray(locationIds)) throw new TypeError('Warehouse location ids must be an array');
  return locationIds.map(locationId => getWarehouseLocationContext({ ...options, locationId }));
}

export function warehouseLocationBridgeContract() {
  return Object.freeze({
    warehouse_location_authority: 'app/src/warehouse/locations.js',
    location_authority: 'core.locations',
    core_location_registry: 'state.organizationLocations',
    organization_scope: 'config.organizationId',
    selected_location: 'config.locationId',
    canonical_location_types: 'locations.type',
    storage_bin_authority: 'app/src/warehouse/locations.js#warehouseLocations',
    storage_bin_is_not_core_location: true,
    duplicate_authority: false,
    persistence: 'none',
  });
}

export function isWarehouseLocationContext(value) {
  return Boolean(value && typeof value === 'object' &&
    typeof value.organization_id === 'string' &&
    typeof value.location_id === 'string' &&
    value.location_id.length > 0 &&
    value.location_status === 'active' &&
    value.core_location_type === 'organization_location');
}
