// warehouse/locations.js
// Phase 6 extraction (see modularization plan §5): storage-location CRUD
// (the "Locations" sub-tab under Warehouse), moved out of main.js unchanged.
// warehouseLocations itself already lives in state.js (Phase 2).
//
// NOTE on the ./ui.js import below: renderWarehouseLocationsList is markup,
// not storage, so it stays in warehouse/ui.js — but add/removeWarehouseLocation
// need to re-render the list after mutating it. This is the same harmless
// circular-import pattern products/render.js documents for its own sibling
// modules (neither call happens at module-evaluation time, only later from
// a click handler, by which point both modules have finished loading).
import { STORAGE_KEYS } from '../constants.js';
import { config, warehouseLocations, organizationLocations, setOrganizationLocations, setConfig } from '../state.js';
import { saveJSON } from '../storage/json.js';
import { uid } from '../utils/index.js';
import { renderWarehouseLocationsList } from './ui.js';

export function saveWarehouseLocations() {
  saveJSON(STORAGE_KEYS.warehouseLocations, warehouseLocations);
}

export function addWarehouseLocation() {
  const input = document.getElementById('newLocationName');
  const name = input.value.trim();
  if (!name) return;
  warehouseLocations.push({ id: uid(), name });
  saveWarehouseLocations();
  input.value = '';
  renderWarehouseLocationsList();
}

export function removeWarehouseLocation(idx) {
  warehouseLocations.splice(idx, 1);
  saveWarehouseLocations();
  renderWarehouseLocationsList();
}


function baseUrl() { return (config.syncUrl || window.location.origin).replace(/\/$/, ''); }

export async function loadOrganizationLocations({ includeInactive = false } = {}) {
  if (!config.chatId || !config.sessionToken) return organizationLocations;
  try {
    const url = `${baseUrl()}/tenants/${encodeURIComponent(config.chatId)}/locations${includeInactive ? '?include_inactive=true' : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${config.sessionToken}` } });
    if (!res.ok) return organizationLocations;
    const data = await res.json();
    if (!Array.isArray(data.locations)) return organizationLocations;
    setOrganizationLocations(data.locations);
    saveJSON(STORAGE_KEYS.organizationLocations, data.locations);
    if (!config.locationId || !data.locations.some(l => String(l.id) === String(config.locationId) && l.status === 'active')) {
      const fallback = data.locations.find(l => l.status === 'active');
      if (fallback) {
        const next = { ...config, locationId: fallback.id };
        setConfig(next);
        saveJSON(STORAGE_KEYS.config, next);
      }
    }
    return data.locations;
  } catch (_) {
    return organizationLocations;
  }
}

export function getActiveOrganizationLocation() {
  return organizationLocations.find(l => String(l.id) === String(config.locationId)) || organizationLocations.find(l => l.status === 'active') || null;
}

export function selectOrganizationLocation(locationId) {
  const location = organizationLocations.find(l => String(l.id) === String(locationId) && l.status === 'active');
  if (!location) return null;
  const next = { ...config, locationId: location.id };
  setConfig(next);
  saveJSON(STORAGE_KEYS.config, next);
  return location;
}
