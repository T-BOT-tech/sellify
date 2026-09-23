// Phase 22.2 — AI Procurement Intent Contract.
//
// This contract normalizes an AI-translated procurement request into a strict,
// request-scoped representation. It is not a procurement demand record, RFQ,
// supplier selection, award, purchase order, transaction, authorization, or
// persistence authority.
//
// Flow:
// Natural Language → AI → Structured Procurement Intent → Existing Capability
//
// AI-derived intent remains subject to deterministic domain validation and
// existing authorization before any owning domain mutation can occur.

export const PHASE22_PROCUREMENT_INTENT_CONTRACT_VERSION = '1.0';
export const PHASE22_PROCUREMENT_INTENT_AUTHORITY = 'ai_intent_boundary';

export const PHASE22_PROCUREMENT_INTENT_MODES = Object.freeze([
  'SOURCE',
  'RFQ_PREPARATION',
  'REPLENISH',
  'DIRECT_PROCUREMENT',
  'CROSS_BORDER_SOURCE',
]);

export const PHASE22_PROCUREMENT_INTENT_CONFIDENCE = Object.freeze([
  'USER_STATED',
  'AI_INTERPRETED',
  'UNKNOWN',
]);

const ALLOWED_FIELDS = Object.freeze([
  'intentId',
  'organizationId',
  'requesterId',
  'mode',
  'commodityReference',
  'productReference',
  'quantity',
  'unit',
  'currency',
  'destination',
  'origin',
  'requiredDate',
  'qualificationRequirements',
  'logisticsRequirements',
  'commercialRequirements',
  'preferredSupplierReferences',
  'notes',
  'confidence',
  'provenance',
]);

const FORBIDDEN_FIELDS = Object.freeze([
  'sql', 'query', 'database', 'store', 'persistence', 'credentials', 'secrets',
  'token', 'authorizationGrant', 'authorization', 'transaction',
  'transactionHandle', 'ledger', 'eventStore', 'broker', 'rawCommand',
  'directExecution', 'providerCredentials', 'paymentAuthorization',
  'paymentExecution', 'po', 'purchaseOrder', 'rfqId', 'awardId', 'orderId',
  'supplierSelection', 'supplierRanking', 'rankedSuppliers', 'winner',
  'selectedSupplier', 'supplierScore', 'feasibilityDecision', 'complianceDecision',
  'complianceStatus', 'verifiedEvidence', 'inventedEvidence',
]);

function invalid(message) {
  const error = new TypeError(`Invalid Phase 22 procurement intent: ${message}`);
  error.code = 'PHASE22_PROCUREMENT_INTENT_INVALID';
  throw error;
}

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${field} must be an object`);
  return value;
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} must be a non-empty string`);
  return value.trim();
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

function optionalIso(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const result = text(value, field);
  const time = Date.parse(result);
  if (!Number.isFinite(time)) invalid(`${field} must be a valid ISO-8601 date/time`);
  return new Date(time).toISOString();
}

function clone(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(clone));
  if (typeof value !== 'object') return value;
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])));
}

function reference(value, field, authority, entity) {
  if (value === undefined || value === null) return null;
  object(value, field);
  const id = text(value.id, `${field}.id`);
  if (value.authority !== undefined && value.authority !== null && String(value.authority).trim() !== authority) {
    invalid(`${field}.authority must be ${authority}`);
  }
  const keys = Object.keys(value);
  for (const key of keys) if (!['id', 'authority'].includes(key)) invalid(`${field} contains unsupported field: ${key}`);
  return Object.freeze({ authority, entity, id });
}

function references(value, field, authority, entity) {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value)) invalid(`${field} must be an array`);
  return Object.freeze(value.map((item, index) => reference(item, `${field}[${index}]`, authority, entity)));
}

function objectField(value, field) {
  if (value === undefined || value === null) return Object.freeze({});
  object(value, field);
  return clone(value);
}

function assertAllowedAndSafeFields(input) {
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_FIELDS.includes(key)) invalid(`forbidden field: ${key}`);
    if (!ALLOWED_FIELDS.includes(key)) invalid(`unsupported field: ${key}`);
  }
}

function normalizeConfidence(value) {
  const result = value === undefined || value === null ? 'AI_INTERPRETED' : text(value, 'confidence').toUpperCase();
  if (!PHASE22_PROCUREMENT_INTENT_CONFIDENCE.includes(result)) {
    invalid(`confidence must be one of ${PHASE22_PROCUREMENT_INTENT_CONFIDENCE.join(', ')}`);
  }
  return result;
}

function normalizeMode(value) {
  const result = text(value, 'mode').toUpperCase();
  if (!PHASE22_PROCUREMENT_INTENT_MODES.includes(result)) {
    invalid(`mode must be one of ${PHASE22_PROCUREMENT_INTENT_MODES.join(', ')}`);
  }
  return result;
}

/**
 * Normalize a structured AI procurement request. The result is immutable and
 * request-scoped; it cannot itself authorize or execute procurement.
 */
export function defineProcurementIntent(input = {}) {
  object(input, 'intent');
  assertAllowedAndSafeFields(input);

  const intentId = optionalText(input.intentId, 'intentId');
  const organizationId = text(input.organizationId, 'organizationId');
  const requesterId = optionalText(input.requesterId, 'requesterId');
  const mode = normalizeMode(input.mode);
  const commodityReference = reference(input.commodityReference, 'commodityReference', 'agriculture', 'Commodity');
  const productReference = reference(input.productReference, 'productReference', 'product_catalog', 'Product');
  if (!commodityReference && !productReference) invalid('commodityReference or productReference is required');

  const quantity = positiveNumber(input.quantity, 'quantity');
  const unit = text(input.unit, 'unit');
  const currency = optionalText(input.currency, 'currency');
  const destination = reference(input.destination, 'destination', 'locations', 'Location');
  const origin = reference(input.origin, 'origin', 'locations', 'Location');
  const requiredDate = optionalIso(input.requiredDate, 'requiredDate');
  const qualificationRequirements = objectField(input.qualificationRequirements, 'qualificationRequirements');
  const logisticsRequirements = objectField(input.logisticsRequirements, 'logisticsRequirements');
  const commercialRequirements = objectField(input.commercialRequirements, 'commercialRequirements');
  const preferredSupplierReferences = references(input.preferredSupplierReferences, 'preferredSupplierReferences', 'supplier_network', 'Supplier');
  const notes = optionalText(input.notes, 'notes');
  const confidence = normalizeConfidence(input.confidence);
  const provenance = objectField(input.provenance, 'provenance');

  return Object.freeze({
    version: PHASE22_PROCUREMENT_INTENT_CONTRACT_VERSION,
    intentId,
    organizationId,
    requesterId,
    mode,
    commodityReference,
    productReference,
    quantity,
    unit,
    currency,
    origin,
    destination,
    requiredDate,
    qualificationRequirements,
    logisticsRequirements,
    commercialRequirements,
    preferredSupplierReferences,
    notes,
    confidence,
    provenance,
    derived: true,
    persistence: 'none',
    mutation: false,
    authorization: false,
    transactionExecution: false,
    providerExecution: false,
    supplierSelection: false,
    supplierRanking: false,
    feasibilityDecision: false,
    complianceDecision: false,
    procurementDemandCreation: false,
    rfqCreation: false,
    awardCreation: false,
    purchaseOrderCreation: false,
    paymentExecution: false,
    principle: 'structured procurement intent only; existing domain authorities retain procurement truth and execution',
  });
}

export function assertProcurementIntentBoundary(input) {
  const intent = defineProcurementIntent(input);
  if (
    intent.persistence !== 'none' ||
    intent.mutation !== false ||
    intent.authorization !== false ||
    intent.transactionExecution !== false ||
    intent.providerExecution !== false ||
    intent.supplierSelection !== false ||
    intent.supplierRanking !== false ||
    intent.feasibilityDecision !== false ||
    intent.complianceDecision !== false
  ) invalid('procurement intent boundary invariants violated');
  return true;
}

export function phase22ProcurementIntentContract() {
  return Object.freeze({
    version: PHASE22_PROCUREMENT_INTENT_CONTRACT_VERSION,
    authority: PHASE22_PROCUREMENT_INTENT_AUTHORITY,
    input: 'structured_ai_intent',
    output: 'request_scoped_procurement_intent',
    sourceOfTruth: 'existing procurement and domain authorities',
    persistence: 'none',
    mutation: false,
    authorization: false,
    transactionExecution: false,
    providerExecution: false,
    supplierSelection: false,
    supplierRanking: false,
    feasibilityDecision: false,
    complianceDecision: false,
    procurementDemandAuthority: 'existing procurement authority',
    rfqAuthority: 'existing procurement authority',
    awardAuthority: 'existing procurement authority',
    purchaseOrderAuthority: 'existing procurement authority',
    paymentAuthority: 'existing payment authority',
    inventoryAuthority: 'existing inventory authority',
    commerceAuthority: 'existing commerce authority',
    fulfillmentAuthority: 'existing fulfillment authority',
    logisticsAuthority: 'existing logistics authority',
    auditAuthority: 'existing audit authority',
    eventAuthority: 'existing versioned event outbox',
    principle: 'AI translates procurement intent; owning domains validate, authorize, persist, and execute',
  });
}
