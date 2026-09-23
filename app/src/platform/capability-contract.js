// Phase 16.1 — Canonical Capability Contracts.
//
// This module is the first executable platformization layer. It exposes a
// stable vocabulary for consuming existing Sellify authorities without moving
// persistence, authorization, transactions, or domain ownership into the
// platform layer.
//
// Flow:
// Consumer → Capability Contract → Existing Authority
//
// This module does NOT execute capabilities, persist capability state, grant
// permissions, create an API gateway, or create a second domain authority.

export const PLATFORM_CAPABILITY_CONTRACT_VERSION = '1.0';

export const CAPABILITY_STATUS = Object.freeze({
  AVAILABLE: 'available',
  DEFERRED: 'deferred',
});

const CAPABILITIES = Object.freeze({
  'supplier-network.qualification': Object.freeze({ capability:'supplier-network.qualification', authority:'supplier_network', resource:'supplier_network_qualification', actions:Object.freeze(['view','manage','document','verify','revoke']), authorityModule:'backend/lib/store-sqlite.js#supplier network qualification and verification authority', status:CAPABILITY_STATUS.AVAILABLE }),
  'supplier-network.commercial': Object.freeze({ capability:'supplier-network.commercial', authority:'supplier_network', resource:'supplier_network_commercial_terms', actions:Object.freeze(['view','manage','activate','deactivate']), authorityModule:'backend/lib/store-sqlite.js#supplier network commercial capability authority', status:CAPABILITY_STATUS.AVAILABLE }),
  'supplier-network.capability': Object.freeze({ capability:'supplier-network.capability', authority:'supplier_network', resource:'supplier_network_capability', actions:Object.freeze(['view','manage','activate','deactivate']), authorityModule:'backend/lib/store-sqlite.js#supplier network capability authority', status:CAPABILITY_STATUS.AVAILABLE }),
  'supplier-network.performance': Object.freeze({ capability:'supplier-network.performance', authority:'supplier_network', resource:'supplier_network_performance_observation', actions:Object.freeze(['view','recalculate']), authorityModule:'backend/lib/store-sqlite.js#supplier network performance derived-observation authority', status:CAPABILITY_STATUS.AVAILABLE }),
  'supplier-network.trust': Object.freeze({ capability:'supplier-network.trust', authority:'supplier_network', resource:'supplier_network_trust_evidence', actions:Object.freeze(['view','refresh']), authorityModule:'backend/lib/store-sqlite.js#supplier network explainable trust evidence authority', status:CAPABILITY_STATUS.AVAILABLE }),
  'supplier-network.discovery': Object.freeze({ capability:'supplier-network.discovery', authority:'supplier_network', resource:'supplier_network_discovery', actions:Object.freeze(['discover']), authorityModule:'backend/lib/store-sqlite.js#deterministic supplier network discovery authority', status:CAPABILITY_STATUS.AVAILABLE }),
  'supplier-network.marketplace-integration': Object.freeze({ capability:'supplier-network.marketplace-integration', authority:'supplier_network', resource:'supplier_network_marketplace_integration', actions:Object.freeze(['view']), authorityModule:'backend/lib/store-sqlite.js#supplier network marketplace integration read-model authority', status:CAPABILITY_STATUS.AVAILABLE }),
  'supplier-network.profile': Object.freeze({ capability:'supplier-network.profile', authority:'supplier_network', resource:'supplier_network_profile', actions:Object.freeze(['view','manage','publish','suspend']), authorityModule:'backend/lib/store-sqlite.js#supplier network profile authority', status:CAPABILITY_STATUS.AVAILABLE }),
  'procurement.award': Object.freeze({ capability:'procurement.award', authority:'procurement', resource:'procurement_award', actions:Object.freeze(['view','create','confirm','cancel']), authorityModule:'backend/lib/store-sqlite.js#procurement award decision authority', status:CAPABILITY_STATUS.AVAILABLE }),
  'procurement.execution': Object.freeze({ capability:'procurement.execution', authority:'procurement', resource:'procurement_execution', actions:Object.freeze(['execute']), authorityModule:'backend/lib/store-sqlite.js#createPurchaseOrderFromProcurementAward → existing B2B PO authority', status:CAPABILITY_STATUS.AVAILABLE }),
  'procurement.receiving': Object.freeze({ capability:'procurement.receiving', authority:'procurement', resource:'procurement_receipt', actions:Object.freeze(['view','create','cancel']), authorityModule:'backend/lib/store-sqlite.js#createProcurementReceipt → existing inventory movement authority', status:CAPABILITY_STATUS.AVAILABLE }),
  'procurement.comparison': Object.freeze({ capability:'procurement.comparison', authority:'procurement', resource:'procurement_comparison', actions:Object.freeze(['view','create']), authorityModule:'backend/lib/store-sqlite.js#deterministic RFQ comparison authority', status:CAPABILITY_STATUS.AVAILABLE }),
  'procurement.rfq': Object.freeze({capability:'procurement.rfq', authority:'procurement', resource:'procurement_rfq', actions:Object.freeze(['view','create','manage','send','close','respond']), authorityModule:'backend/lib/store-sqlite.js#RFQ and supplier response authority', status:CAPABILITY_STATUS.AVAILABLE}),
  'procurement.supplier': Object.freeze({ capability:'procurement.supplier', authority:'procurement', resource:'procurement_supplier', actions:Object.freeze(['view','manage','discover','relationship:view','relationship:manage']), authorityModule:'backend/lib/store-sqlite.js#supplier participation and discovery authority', status:CAPABILITY_STATUS.AVAILABLE }),
  'procurement.demand': Object.freeze({
    capability: 'procurement.demand',
    authority: 'procurement',
    resource: 'procurement_demand',
    actions: Object.freeze(['view', 'create', 'manage', 'submit', 'cancel', 'sourcing']),
    authorityModule: 'backend/lib/store-sqlite.js#procurement demand authority',
    status: CAPABILITY_STATUS.AVAILABLE,
  }),
  'commerce.orders': Object.freeze({
    capability: 'commerce.orders',
    authority: 'commerce',
    resource: 'orders',
    actions: Object.freeze(['create', 'view', 'delete']),
    authorityModule: 'existing commerce/order authority',
    status: CAPABILITY_STATUS.AVAILABLE,
  }),
  'commerce.products': Object.freeze({
    capability: 'commerce.products',
    authority: 'commerce',
    resource: 'products',
    actions: Object.freeze(['view', 'manage']),
    authorityModule: 'app/src/products/catalog.js',
    status: CAPABILITY_STATUS.AVAILABLE,
  }),
  'inventory.stock': Object.freeze({
    capability: 'inventory.stock',
    authority: 'inventory',
    resource: 'inventory',
    actions: Object.freeze(['view', 'add', 'edit']),
    authorityModule: 'existing inventory authority',
    status: CAPABILITY_STATUS.AVAILABLE,
  }),
  'payments.procurement-settlement': Object.freeze({ capability:'payments.procurement-settlement', authority:'payments', resource:'procurement_settlement', actions:Object.freeze(['view','allocate']), authorityModule:'backend/lib/store-sqlite.js#procurement settlement allocation authority', status:CAPABILITY_STATUS.AVAILABLE }),
  'payments.core': Object.freeze({
    capability: 'payments.core',
    authority: 'payments',
    resource: 'payments',
    actions: Object.freeze(['view', 'accept', 'manage', 'reconcile', 'outbound:create', 'outbound:submit', 'outbound:confirm', 'settlement:view', 'settlement:allocate']),
    authorityModule: 'existing payment authority',
    status: CAPABILITY_STATUS.AVAILABLE,
  }),
  'customers.identity': Object.freeze({
    capability: 'customers.identity',
    authority: 'customers',
    resource: 'customers',
    actions: Object.freeze(['view', 'manage']),
    authorityModule: 'app/src/customers.js',
    status: CAPABILITY_STATUS.AVAILABLE,
  }),
  'locations.scope': Object.freeze({
    capability: 'locations.scope',
    authority: 'locations',
    resource: 'locations',
    actions: Object.freeze(['view', 'manage']),
    authorityModule: 'existing locations authority',
    status: CAPABILITY_STATUS.AVAILABLE,
  }),
  'fulfillment.operations': Object.freeze({
    capability: 'fulfillment.operations',
    authority: 'fulfillment',
    resource: 'fulfillment',
    actions: Object.freeze(['view', 'manage']),
    authorityModule: 'app/src/logistics/fulfillment.js',
    status: CAPABILITY_STATUS.AVAILABLE,
  }),
  'logistics.operations': Object.freeze({
    capability: 'logistics.operations',
    authority: 'logistics',
    resource: 'logistics',
    actions: Object.freeze(['view', 'assign', 'dispatch', 'track', 'proof', 'return', 'route']),
    authorityModule: 'app/src/verticals/logistics/authority-map.js + existing Logistics Pack authorities',
    status: CAPABILITY_STATUS.AVAILABLE,
  }),
  'documents.invoices': Object.freeze({
    capability: 'documents.invoices',
    authority: 'documents',
    resource: 'b2b.invoice',
    actions: Object.freeze(['view', 'create', 'manage']),
    authorityModule: 'existing B2B invoice authority',
    status: CAPABILITY_STATUS.AVAILABLE,
  }),
  'audit.history': Object.freeze({
    capability: 'audit.history',
    authority: 'audit',
    resource: 'audit',
    actions: Object.freeze(['view']),
    authorityModule: 'existing audit authority',
    status: CAPABILITY_STATUS.AVAILABLE,
  }),
  'country.configuration': Object.freeze({
    capability: 'country.configuration',
    authority: 'country',
    resource: 'country',
    actions: Object.freeze(['view']),
    authorityModule: 'app/src/country-configuration.js',
    status: CAPABILITY_STATUS.AVAILABLE,
  }),
  'vertical.configuration': Object.freeze({
    capability: 'vertical.configuration',
    authority: 'vertical',
    resource: 'vertical',
    actions: Object.freeze(['view']),
    authorityModule: 'app/src/verticals/configuration.js',
    status: CAPABILITY_STATUS.AVAILABLE,
  }),
  'events.versioned': Object.freeze({
    capability: 'events.versioned',
    authority: 'events',
    resource: 'events',
    actions: Object.freeze(['emit']),
    authorityModule: 'app/src/events/event-boundary.js',
    status: CAPABILITY_STATUS.AVAILABLE,
  }),
});

const FORBIDDEN_AUTHORITY_NAMES = Object.freeze([
  'database', 'persistence', 'ledger', 'eventStore', 'broker',
  'authorization', 'identityStore', 'transactionEngine', 'apiGateway',
]);

function fail(message) {
  const error = new Error(`Invalid platform capability: ${message}`);
  error.code = 'PLATFORM_CAPABILITY_INVALID';
  throw error;
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) fail(`${field} must be a non-empty string`);
  return value.trim();
}

function list(value, field) {
  if (!Array.isArray(value)) fail(`${field} must be an array`);
  const result = value.map((item) => text(item, `${field} item`));
  if (new Set(result.map((item) => item.toLowerCase())).size !== result.length) {
    fail(`${field} must not contain duplicates`);
  }
  return result;
}

function cloneCapability(capability) {
  return Object.freeze({
    ...capability,
    actions: Object.freeze([...capability.actions]),
  });
}

export function listPlatformCapabilities() {
  return Object.keys(CAPABILITIES);
}

export function getPlatformCapability(capabilityName) {
  const name = text(capabilityName, 'capability').toLowerCase();
  const capability = CAPABILITIES[name];
  if (!capability) {
    const error = new Error(`Unknown platform capability: ${capabilityName}`);
    error.code = 'PLATFORM_CAPABILITY_UNKNOWN';
    throw error;
  }
  return cloneCapability(capability);
}

export function definePlatformCapability(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail('manifest must be an object');
  }
  const capability = text(input.capability, 'capability').toLowerCase();
  const authority = text(input.authority, 'authority').toLowerCase();
  const resource = text(input.resource, 'resource');
  const actions = list(input.actions, 'actions');
  const authorityModule = text(input.authorityModule, 'authorityModule');
  const status = text(input.status, 'status').toLowerCase();

  if (status !== CAPABILITY_STATUS.AVAILABLE && status !== CAPABILITY_STATUS.DEFERRED) {
    fail(`status must be ${CAPABILITY_STATUS.AVAILABLE} or ${CAPABILITY_STATUS.DEFERRED}`);
  }

  for (const forbidden of FORBIDDEN_AUTHORITY_NAMES) {
    const key = `owns${forbidden[0].toUpperCase()}${forbidden.slice(1)}`;
    if (Object.prototype.hasOwnProperty.call(input, key)) fail(`forbidden authority claim: ${key}`);
  }

  if (input.persistence !== undefined && input.persistence !== 'none') {
    fail('capability contracts cannot declare persistent storage');
  }
  if (input.store !== undefined || input.database !== undefined) {
    fail('capability contracts cannot declare persistence or storage');
  }

  return Object.freeze({
    contract_version: PLATFORM_CAPABILITY_CONTRACT_VERSION,
    capability,
    authority,
    resource,
    actions: Object.freeze(actions),
    authorityModule,
    status,
    execution: 'consumer_must_delegate_to_existing_authority',
    persistence: 'none',
    authorization: 'backend/lib/authorization.js',
  });
}

export function isPlatformCapability(value) {
  try {
    definePlatformCapability(value);
    return true;
  } catch {
    return false;
  }
}

export function platformCapabilityContract() {
  return Object.freeze({
    version: PLATFORM_CAPABILITY_CONTRACT_VERSION,
    authority: 'canonical capability vocabulary',
    execution: 'delegation_only',
    authorization: 'existing authorization authority',
    persistence: 'none',
    transactionAuthority: 'existing domain transaction authority',
    capabilities: Object.freeze(Object.fromEntries(
      Object.entries(CAPABILITIES).map(([key, value]) => [key, cloneCapability(value)])
    )),
    forbiddenAuthorities: FORBIDDEN_AUTHORITY_NAMES,
    duplicateAuthority: false,
    duplicatePersistence: false,
    duplicateAuthorization: false,
    duplicateEventStore: false,
  });
}

export function resolveCapabilityAction(capabilityName, action) {
  const capability = getPlatformCapability(capabilityName);
  const normalizedAction = text(action, 'action').toLowerCase();
  if (!capability.actions.map((item) => item.toLowerCase()).includes(normalizedAction)) {
    const error = new Error(`Unsupported action ${action} for capability ${capability.capability}`);
    error.code = 'PLATFORM_CAPABILITY_ACTION_UNSUPPORTED';
    throw error;
  }
  return Object.freeze({
    capability: capability.capability,
    authority: capability.authority,
    resource: capability.resource,
    action: normalizedAction,
    authorizationAction: `${capability.resource}:${normalizedAction}`,
    status: capability.status,
  });
}
