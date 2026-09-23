// Phase 13.2 — Agriculture Pack Foundation.
//
// Foundation only: declares the Agriculture-owned vocabulary and its Core
// dependencies. It deliberately does not create AgricultureOrder,
// AgricultureInventory, AgriculturePayment, or AgricultureFulfillment.
import { defineVerticalPack } from '../contract.js';
import { VERTICAL_PACK_MANIFESTS } from '../../../../shared/vertical-pack-manifests.js';

export const AGRICULTURE_ENTITY_ORDER = Object.freeze([
  'Farmer',
  'Farm',
  'Plot',
  'Season',
  'Crop',
  'Harvest',
  'Supply',
  'Commodity',
  'CollectionCenter',
  'Buyer',
]);

export const AGRICULTURE_STATUSES = Object.freeze([
  'active',
  'inactive',
]);

export const AGRICULTURE_PACK = defineVerticalPack(VERTICAL_PACK_MANIFESTS.agriculture);

function cleanText(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Agriculture ${field} must be a non-empty string`);
  return result;
}

export function defineAgricultureEntity(entityType, input = {}) {
  const type = cleanText(entityType, 'entity type');
  if (!AGRICULTURE_ENTITY_SET.has(type)) {
    throw new TypeError(`Unsupported Agriculture entity type: ${type}`);
  }
  const id = cleanText(input.id, `${type} id`);
  const organizationId = cleanText(input.organization_id ?? input.organizationId, `${type} organization_id`);
  const status = String(input.status ?? 'active').trim().toLowerCase();
  if (!AGRICULTURE_STATUSES.includes(status)) {
    throw new TypeError(`Agriculture ${type} status must be active or inactive`);
  }
  return Object.freeze({
    entity_type: type,
    id,
    organization_id: organizationId,
    status,
  });
}

const AGRICULTURE_ENTITY_SET = new Set(AGRICULTURE_ENTITY_ORDER);
