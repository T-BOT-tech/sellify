// Phase 21.4 — Demand Requirement composition contract.
//
// Procurement remains the canonical authority for actual procurement demand.
// Phase 21 exposes a normalized, non-persistent requirement representation for
// deterministic supply matching. It is not a second demand store, workflow,
// authorization surface, quote/RFQ engine, or purchase-order authority.
//
// Demand Requirement ≠ Procurement Demand record ≠ Commerce Order.

export const PHASE21_DEMAND_REQUIREMENT_CONTRACT_VERSION = '1.0';
export const PHASE21_DEMAND_REQUIREMENT_AUTHORITY = 'procurement';
export const PHASE21_DEMAND_REQUIREMENT_STATUSES = Object.freeze([
  'DRAFT',
  'ACTIVE',
  'EXPIRED',
  'CANCELLED',
  'UNKNOWN',
]);

function invalid(message) {
  const error = new TypeError(`Invalid Phase 21 demand requirement: ${message}`);
  error.code = 'PHASE21_DEMAND_REQUIREMENT_INVALID';
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

function optionalIso(value, field) {
  if (value === undefined || value === null || value === '') return null;
  return iso(value, field);
}

function freezeArray(value, field) {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value)) invalid(`${field} must be an array`);
  return Object.freeze(value.map((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      invalid(`${field} entries must be objects`);
    }
    return Object.freeze({ ...item });
  }));
}

function freezeObject(value, field) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) invalid(`${field} must be an object`);
  return Object.freeze({ ...value });
}

function reference(value, field, authority, entity) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${field} must be an object`);
  const id = text(value.id, `${field}.id`);
  const suppliedAuthority = optionalText(value.authority, `${field}.authority`);
  if (suppliedAuthority && suppliedAuthority !== authority) {
    invalid(`${field}.authority must be ${authority}`);
  }
  return Object.freeze({ authority, entity, id });
}

/**
 * Project an existing Procurement demand/requirement into the Phase 21
 * matching vocabulary. No demand state is persisted or re-owned here.
 */
export function projectDemandRequirement(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    invalid('input must be an object');
  }

  const demandAuthority = optionalText(input.demandAuthority ?? input.demand_authority ?? input.authority, 'demandAuthority');
  if (demandAuthority && demandAuthority !== PHASE21_DEMAND_REQUIREMENT_AUTHORITY) {
    invalid('demandAuthority must be procurement');
  }

  const demandId = text(
    input.demandId ?? input.demand_id ?? input.id ?? input.procurementDemandId ?? input.procurement_demand_id,
    'demandId',
  );

  const commodity = reference(
    input.commodity ?? { id: input.commodityId ?? input.commodity_id, authority: input.commodityAuthority },
    'commodity',
    'agriculture',
    'Commodity',
  );

  const quantity = positiveNumber(input.quantity, 'quantity');
  const unit = text(input.unit, 'unit');

  const status = String(input.status ?? 'UNKNOWN').trim().toUpperCase();
  if (!PHASE21_DEMAND_REQUIREMENT_STATUSES.includes(status)) {
    invalid(`status must be one of ${PHASE21_DEMAND_REQUIREMENT_STATUSES.join(', ')}`);
  }

  const requiredDate = optionalIso(input.requiredDate ?? input.required_date, 'requiredDate');
  const destination = input.destination == null
    ? null
    : reference(input.destination, 'destination', 'locations', 'Location');

  const specification = freezeObject(input.specification, 'specification');
  const qualificationRequirements = freezeArray(
    input.qualificationRequirements ?? input.qualification_requirements,
    'qualificationRequirements',
  );
  const logisticsRequirements = freezeObject(
    input.logisticsRequirements ?? input.logistics_requirements,
    'logisticsRequirements',
  );
  const commercialRequirements = freezeObject(
    input.commercialRequirements ?? input.commercial_requirements,
    'commercialRequirements',
  );
  const provenance = freezeObject(input.provenance, 'provenance');

  return Object.freeze({
    demandReference: Object.freeze({
      authority: PHASE21_DEMAND_REQUIREMENT_AUTHORITY,
      resource: 'procurement_demand',
      id: demandId,
    }),
    commodityReference: commodity,
    quantity,
    unit,
    specification,
    destination,
    requiredDate,
    qualificationRequirements,
    logisticsRequirements,
    commercialRequirements,
    status,
    provenance,
    procurementAuthority: 'existing procurement authority',
    inventoryAuthority: 'existing inventory authority',
    commerceAuthority: 'existing commerce authority',
    persistence: 'none',
    mutation: false,
    authorization: false,
    transactionExecution: false,
    providerExecution: false,
  });
}

export function phase21DemandRequirementContract() {
  return Object.freeze({
    version: PHASE21_DEMAND_REQUIREMENT_CONTRACT_VERSION,
    authority: PHASE21_DEMAND_REQUIREMENT_AUTHORITY,
    sourceAuthority: 'procurement.demand',
    commodityAuthority: 'agriculture',
    locationAuthority: 'locations',
    procurementAuthority: 'existing procurement authority',
    inventoryAuthority: 'existing inventory authority',
    commerceAuthority: 'existing commerce authority',
    persistence: 'none',
    mutation: false,
    authorization: false,
    transactionExecution: false,
    providerExecution: false,
    principle: 'project procurement demand into a deterministic matching requirement without creating a second demand authority',
  });
}
