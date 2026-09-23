// Phase 13.8.2 — Restaurant Tables → Core Location integration.
// Compatibility bridge only: the existing restaurant/tables.js module remains
// the table authority; canonical Organization → Location remains the location
// authority. No RestaurantLocation entity is introduced.

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Restaurant ${field} must be a non-empty string`);
  return result;
}

function activeLocation(locationId, organizationLocations) {
  const id = text(locationId, 'location_id');
  const location = (organizationLocations || []).find(
    l => String(l.id) === id && l.status === 'active'
  );
  if (!location) throw new TypeError(`Restaurant location ${id} is not an active Core location`);
  return location;
}

export function getRestaurantTableContext(table, { organizationId, locationId, organizationLocations } = {}) {
  if (!table?.id) throw new TypeError('Restaurant table is required');
  const org = text(organizationId, 'organization_id');
  const location = activeLocation(locationId, organizationLocations);
  const locationOrg = location.organization_id ?? location.organizationId;
  if (locationOrg !== undefined && String(locationOrg) !== org) {
    throw new TypeError('Restaurant table location belongs to a different organization');
  }
  return Object.freeze({
    table_id: String(table.id),
    table_number: Number(table.number),
    organization_id: org,
    location_id: String(location.id),
    location_name: location.name ?? '',
    core_location_type: 'organization_location',
  });
}

export function getRestaurantTableContexts(tables, options = {}) {
  if (!Array.isArray(tables)) throw new TypeError('Restaurant tables must be an array');
  return tables.map(table => getRestaurantTableContext(table, options));
}

export function restaurantTableLocationContract() {
  return Object.freeze({
    table_authority: 'app/src/restaurant/tables.js',
    location_authority: 'app/src/warehouse/locations.js',
    core_location_registry: 'state.organizationLocations',
    organization_scope: 'config.chatId',
    selected_location: 'config.locationId',
    duplicate_authority: false,
  });
}
