// Phase 13.3 — Agriculture Identity Bridge.
// Agriculture-specific identities are references/roles over canonical Core
// records. This module does not create AgricultureCustomer or AgricultureLocation.

import { AGRICULTURE_PACK } from './pack.js';

const CORE_IDENTITY_TYPES = Object.freeze({
  Farmer: 'customer',
  Buyer: 'customer',
  CollectionCenter: 'location',
});

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Agriculture ${field} must be a non-empty string`);
  return result;
}

function assertOrganization(record, organizationId, label) {
  const expected = text(organizationId, 'organization_id');
  const actual = record?.organizationId ?? record?.organization_id;
  if (!actual) throw new TypeError(`Agriculture ${label} organization_id must be a non-empty string`);
  if (String(actual) !== expected) {
    throw new TypeError(`Agriculture ${label} belongs to a different organization`);
  }
  return expected;
}

function reference(entityType, coreType, coreId, organizationId, extra = {}) {
  if (!AGRICULTURE_PACK.domain_entities.includes(entityType)) {
    throw new TypeError(`Unsupported Agriculture identity entity: ${entityType}`);
  }
  return Object.freeze({
    entity_type: entityType,
    core_type: coreType,
    core_id: text(coreId, `${entityType} core_id`),
    organization_id: text(organizationId, `${entityType} organization_id`),
    ...extra,
  });
}

export function agricultureIdentityContract() {
  return Object.freeze({ ...CORE_IDENTITY_TYPES });
}

export function bridgeFarmerToCustomer(customer, organizationId) {
  if (!customer) throw new TypeError('Farmer customer is required');
  const org = assertOrganization(customer, organizationId, 'Farmer');
  return reference('Farmer', 'customer', customer.id, org, {
    role: 'farmer',
  });
}

export function bridgeBuyerToCustomer(customer, organizationId) {
  if (!customer) throw new TypeError('Buyer customer is required');
  const org = assertOrganization(customer, organizationId, 'Buyer');
  return reference('Buyer', 'customer', customer.id, org, {
    role: 'buyer',
  });
}

export function bridgeCollectionCenterToLocation(location, organizationId) {
  if (!location) throw new TypeError('Collection center location is required');
  const org = assertOrganization(location, organizationId, 'CollectionCenter');
  return reference('CollectionCenter', 'location', location.id, org, {
    role: 'collection_center',
  });
}
