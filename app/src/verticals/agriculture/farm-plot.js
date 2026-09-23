// Phase 13.4 — Agriculture Farm / Plot Model.
//
// Agriculture owns Farm, Plot, Season, and Crop relationships. This module is
// deliberately persistence-neutral: it defines the domain contract and
// validates organization-scoped references without creating a second
// customer, location, inventory, commerce, payment, or fulfillment authority.

import { defineAgricultureEntity } from './pack.js';

const STATUSES = Object.freeze(['active', 'inactive']);

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Agriculture ${field} must be a non-empty string`);
  return result;
}

function optionalText(value, field) {
  if (value == null || String(value).trim() === '') return null;
  return text(value, field);
}

function status(value, field) {
  const result = String(value ?? 'active').trim().toLowerCase();
  if (!STATUSES.includes(result)) {
    throw new TypeError(`Agriculture ${field} has an invalid status`);
  }
  return result;
}

function scopedReference(record, expectedType, organizationId, field) {
  if (!record || typeof record !== 'object') {
    throw new TypeError(`Agriculture ${field} reference is required`);
  }
  if (record.entity_type !== expectedType) {
    throw new TypeError(`Agriculture ${field} must reference ${expectedType}`);
  }
  const expectedOrg = text(organizationId, 'organization_id');
  if (record.organization_id !== expectedOrg) {
    throw new TypeError(`Agriculture ${field} belongs to a different organization`);
  }
  return record.id;
}

function base(entityType, input, defaults = {}) {
  const entity = defineAgricultureEntity(entityType, {
    id: input.id,
    organization_id: input.organization_id ?? input.organizationId,
    status: input.status ?? defaults.status ?? 'active',
  });
  return entity;
}

export function defineFarm(input = {}) {
  const farm = base('Farm', input);
  return Object.freeze({
    ...farm,
    farmer_id: text(input.farmer_id ?? input.farmerId, 'Farm farmer_id'),
    name: text(input.name, 'Farm name'),
    code: optionalText(input.code, 'Farm code'),
    location_id: optionalText(input.location_id ?? input.locationId, 'Farm location_id'),
    area_value: input.area_value == null ? null : Number(input.area_value),
    area_unit: optionalText(input.area_unit ?? input.areaUnit, 'Farm area_unit'),
  });
}

export function definePlot(input = {}) {
  const plot = base('Plot', input);
  return Object.freeze({
    ...plot,
    farm_id: text(input.farm_id ?? input.farmId, 'Plot farm_id'),
    name: text(input.name, 'Plot name'),
    code: optionalText(input.code, 'Plot code'),
    area_value: input.area_value == null ? null : Number(input.area_value),
    area_unit: optionalText(input.area_unit ?? input.areaUnit, 'Plot area_unit'),
  });
}

export function defineSeason(input = {}) {
  const season = base('Season', input);
  return Object.freeze({
    ...season,
    farm_id: text(input.farm_id ?? input.farmId, 'Season farm_id'),
    name: text(input.name, 'Season name'),
    starts_on: optionalText(input.starts_on ?? input.startsOn, 'Season starts_on'),
    ends_on: optionalText(input.ends_on ?? input.endsOn, 'Season ends_on'),
  });
}

export function defineCrop(input = {}) {
  const crop = base('Crop', input);
  return Object.freeze({
    ...crop,
    plot_id: text(input.plot_id ?? input.plotId, 'Crop plot_id'),
    season_id: text(input.season_id ?? input.seasonId, 'Crop season_id'),
    crop_type: text(input.crop_type ?? input.cropType, 'Crop crop_type'),
    variety: optionalText(input.variety, 'Crop variety'),
    planted_on: optionalText(input.planted_on ?? input.plantedOn, 'Crop planted_on'),
    expected_harvest_on: optionalText(
      input.expected_harvest_on ?? input.expectedHarvestOn,
      'Crop expected_harvest_on',
    ),
  });
}

export function validateFarmPlotHierarchy({ farm, plot, season, crop } = {}) {
  if (farm && plot) scopedReference(plot, 'Plot', farm.organization_id, 'plot');
  if (farm && season) scopedReference(season, 'Season', farm.organization_id, 'season');
  if (plot && crop) scopedReference(crop, 'Crop', plot.organization_id, 'crop');
  if (season && crop && crop.season_id !== season.id) {
    throw new TypeError('Agriculture Crop must reference the supplied Season');
  }
  if (plot && crop && crop.plot_id !== plot.id) {
    throw new TypeError('Agriculture Crop must reference the supplied Plot');
  }
  if (farm && plot && plot.farm_id !== farm.id) {
    throw new TypeError('Agriculture Plot must reference the supplied Farm');
  }
  if (farm && season && season.farm_id !== farm.id) {
    throw new TypeError('Agriculture Season must reference the supplied Farm');
  }
  return true;
}

export const AGRICULTURE_FARM_PLOT_MODEL = Object.freeze({
  entities: Object.freeze(['Farm', 'Plot', 'Season', 'Crop']),
  hierarchy: 'Farmer → Farm → Plot → Season → Crop',
  persistence: 'external',
  core_authorities: Object.freeze([
    'customers',
    'locations',
    'inventory',
    'commerce',
    'payments',
    'fulfillment',
  ]),
});
