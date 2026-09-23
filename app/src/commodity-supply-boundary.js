// Phase 21.1 — Commodity / Supply Boundary.
//
// Composition-only boundary between the existing Agriculture Commodity
// vocabulary and existing Supplier Network capability/catalog authorities.
// This module does not create a second commodity or supplier authority.
//
// Flow:
// Agriculture Commodity Vocabulary + Supplier Network Capability/Catalog
//   -> Commodity/Supply Boundary -> Phase 21 matching/coordination
//
// Authority remains:
// - Agriculture: commodity vocabulary
// - Product/Catalog: product identity
// - Supplier Network: supplier participation, capability, catalog, capacity
// - Inventory: stock truth
// - Procurement: demand/RFQ/award/execution
//
// Persistence, mutation, provider execution and transaction authority are
// deliberately absent.

export const PHASE21_COMMODITY_SUPPLY_BOUNDARY_VERSION = '1.0';

export const PHASE21_COMMODITY_AUTHORITY = 'agriculture';
export const PHASE21_SUPPLY_AUTHORITY = 'supplier_network';

export const PHASE21_COMMODITY_SUPPLY_STATUSES = Object.freeze([
  'SUPPORTED',
  'UNRESOLVED',
  'CONFLICTING',
]);

function invalid(message) {
  const error = new TypeError(`Invalid Phase 21 commodity/supply boundary: ${message}`);
  error.code = 'PHASE21_COMMODITY_SUPPLY_BOUNDARY_INVALID';
  throw error;
}

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) invalid(`${field} must be a non-empty string`);
  return result;
}

function optionalText(value, field) {
  if (value === undefined || value === null || value === '') return null;
  return text(value, field);
}

function authorityOf(record, field) {
  return optionalText(record?.authority, field);
}

/**
 * Build a coordination reference without copying the source entity.
 */
export function defineCommoditySupplyReference(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    invalid('input must be an object');
  }

  const commodityId = text(
    input.commodityId ?? input.commodity_id,
    'commodityId',
  );
  const supplierOrganizationId = text(
    input.supplierOrganizationId ?? input.supplier_organization_id,
    'supplierOrganizationId',
  );
  const capabilityId = optionalText(
    input.capabilityId ?? input.capability_id,
    'capabilityId',
  );
  const productId = optionalText(
    input.productId ?? input.product_id,
    'productId',
  );

  return Object.freeze({
    commodityReference: Object.freeze({
      authority: PHASE21_COMMODITY_AUTHORITY,
      entity: 'Commodity',
      id: commodityId,
    }),
    supplierReference: Object.freeze({
      authority: PHASE21_SUPPLY_AUTHORITY,
      entity: 'Organization',
      id: supplierOrganizationId,
    }),
    capabilityReference: capabilityId
      ? Object.freeze({
          authority: PHASE21_SUPPLY_AUTHORITY,
          resource: 'supplier_network_capability',
          id: capabilityId,
        })
      : null,
    productReference: productId
      ? Object.freeze({
          authority: 'product_catalog',
          resource: 'product',
          id: productId,
        })
      : null,
  });
}

/**
 * Resolve only an architectural compatibility result. It does not query,
 * mutate, persist, or execute any source authority.
 */
export function evaluateCommoditySupplyBoundary({
  commodity = null,
  supplierCapability = null,
  supplierCatalog = null,
} = {}) {
  const commodityId = optionalText(
    commodity?.id ?? commodity?.commodityId ?? commodity?.commodity_id,
    'commodity.id',
  );

  if (!commodityId) {
    return Object.freeze({
      status: 'UNRESOLVED',
      reason: 'commodity_reference_missing',
      authoritativeSource: PHASE21_COMMODITY_AUTHORITY,
    });
  }

  const capabilityAuthority = authorityOf(supplierCapability, 'supplierCapability.authority');
  const catalogAuthority = authorityOf(supplierCatalog, 'supplierCatalog.authority');

  if (
    (capabilityAuthority && capabilityAuthority !== PHASE21_SUPPLY_AUTHORITY) ||
    (catalogAuthority && catalogAuthority !== PHASE21_SUPPLY_AUTHORITY)
  ) {
    return Object.freeze({
      status: 'CONFLICTING',
      reason: 'supplier_authority_must_remain_supplier_network',
      authoritativeSource: PHASE21_SUPPLY_AUTHORITY,
    });
  }

  const supplierId = optionalText(
    supplierCapability?.supplierOrganizationId ??
      supplierCapability?.supplier_organization_id ??
      supplierCatalog?.supplierOrganizationId ??
      supplierCatalog?.supplier_organization_id,
    'supplierOrganizationId',
  );

  if (!supplierId) {
    return Object.freeze({
      status: 'UNRESOLVED',
      reason: 'supplier_reference_missing',
      authoritativeSource: PHASE21_SUPPLY_AUTHORITY,
    });
  }

  return Object.freeze({
    status: 'SUPPORTED',
    commodityReference: Object.freeze({
      authority: PHASE21_COMMODITY_AUTHORITY,
      entity: 'Commodity',
      id: commodityId,
    }),
    supplierReference: Object.freeze({
      authority: PHASE21_SUPPLY_AUTHORITY,
      entity: 'Organization',
      id: supplierId,
    }),
    capabilityAuthority: PHASE21_SUPPLY_AUTHORITY,
    productAuthority: 'existing product/catalog authority',
    inventoryAuthority: 'existing inventory authority',
    procurementAuthority: 'existing procurement authority',
    persistence: 'none',
    mutation: false,
    transactionExecution: false,
    providerExecution: false,
  });
}

export function phase21CommoditySupplyBoundaryContract() {
  return Object.freeze({
    version: PHASE21_COMMODITY_SUPPLY_BOUNDARY_VERSION,
    commodityAuthority: PHASE21_COMMODITY_AUTHORITY,
    supplyAuthority: PHASE21_SUPPLY_AUTHORITY,
    productAuthority: 'existing product/catalog authority',
    inventoryAuthority: 'existing inventory authority',
    procurementAuthority: 'existing procurement authority',
    persistence: 'none',
    mutation: false,
    transactionExecution: false,
    providerExecution: false,
    principle: 'compose existing commodity and supplier authorities; do not create duplicate authority',
  });
}
