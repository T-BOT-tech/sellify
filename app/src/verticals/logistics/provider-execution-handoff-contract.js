// Phase 16.13.7 — Logistics Provider Execution Handoff Boundary.
//
// This contract packages an already-authorized provider selection for handoff
// to the existing Logistics/domain transaction boundary. It does NOT execute
// external calls, mutate Fulfillment, persist shipments, store credentials,
// or grant authorization.
//
// Flow:
// requirement → verified feasibility → explicit provider selection →
// authorization → execution handoff → existing domain transaction → adapter/provider.

import { defineLogisticsProviderAdapter } from './provider-adapter-contract.js';

export const LOGISTICS_PROVIDER_EXECUTION_HANDOFF_CONTRACT_VERSION = '1.0';

const OPERATIONS = new Set(['pickup','delivery','tracking','proof_of_delivery','returns','route_planning','dispatch','cross_border']);
const FORBIDDEN_FIELDS = Object.freeze([
  'credentials','credential','secret','token','apiKey','password',
  'database','store','persistence','ledger','eventStore',
  'shipment','route','delivery','proof','return',
  'execute','executeNow','networkCall','httpRequest',
  'ownsAuthorization','ownsIdentityStore','ownsTransactionEngine','ownsEventStore',
]);

function invalid(message, code = 'LOGISTICS_PROVIDER_EXECUTION_HANDOFF_INVALID') {
  const error = new Error(`Invalid logistics provider execution handoff: ${message}`);
  error.code = code;
  throw error;
}
function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} must be a non-empty string`);
  return value.trim();
}
function rejectForbidden(input) {
  for (const field of FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) invalid(`handoff cannot contain ${field}`);
  }
}
function operation(value) {
  const normalized = text(value, 'operation').toLowerCase();
  if (!OPERATIONS.has(normalized)) invalid(`unsupported operation: ${normalized}`);
  return normalized;
}

export function defineLogisticsProviderExecutionHandoff(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('handoff must be an object');
  rejectForbidden(input);

  const selectedProviderId = text(input.selected_provider_id, 'selected_provider_id').toLowerCase();
  const adapter = defineLogisticsProviderAdapter({
    id: input.adapter_id,
    provider: input.adapter_provider ?? selectedProviderId,
    provider_type: input.provider_type,
    provider_contract_version: input.provider_contract_version,
    operations: [operation(input.operation)],
  });

  if (String(adapter.provider).toLowerCase() !== selectedProviderId) {
    invalid('adapter provider must match selected_provider_id', 'LOGISTICS_PROVIDER_SELECTION_MISMATCH');
  }

  const authorization = input.authorization;
  if (!authorization || typeof authorization !== 'object' || Array.isArray(authorization)) {
    invalid('authorization evidence is required', 'LOGISTICS_PROVIDER_AUTHORIZATION_REQUIRED');
  }
  if (authorization.authorized !== true) invalid('handoff requires explicit authorization', 'LOGISTICS_PROVIDER_AUTHORIZATION_REQUIRED');
  const authorizationReference = text(authorization.reference, 'authorization.reference');

  const transaction = input.transaction;
  if (!transaction || typeof transaction !== 'object' || Array.isArray(transaction)) {
    invalid('existing domain transaction reference is required', 'LOGISTICS_PROVIDER_TRANSACTION_REQUIRED');
  }
  const transactionReference = text(transaction.reference, 'transaction.reference');
  const authority = text(transaction.authority, 'transaction.authority');
  if (authority !== 'existing_domain_transaction') invalid('transaction authority must remain existing_domain_transaction');

  return Object.freeze({
    contract_version: LOGISTICS_PROVIDER_EXECUTION_HANDOFF_CONTRACT_VERSION,
    operation: operation(input.operation),
    selected_provider_id: selectedProviderId,
    adapter_id: text(input.adapter_id, 'adapter_id').toLowerCase(),
    provider_type: input.provider_type == null ? 'other' : text(input.provider_type, 'provider_type').toLowerCase(),
    authorization: Object.freeze({ authorized: true, reference: authorizationReference, authority: 'existing_authorization' }),
    transaction: Object.freeze({ reference: transactionReference, authority }),
    canonical_authority: 'logistics',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    execution: 'handoff_only',
    external_execution: false,
    domain_mutation: false,
    persistence: 'none',
    credential_storage: false,
    provider_selection: 'already_selected',
    adapter: Object.freeze({ id: adapter.id, provider: adapter.provider, capability: adapter.capability }),
  });
}

export function logisticsProviderExecutionHandoffContract() {
  return Object.freeze({
    version: LOGISTICS_PROVIDER_EXECUTION_HANDOFF_CONTRACT_VERSION,
    purpose: 'package an explicitly selected and already-authorized provider for an existing domain transaction',
    authorization: 'existing_authorization',
    transactionAuthority: 'existing_domain_transaction',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    persistence: 'none',
    external_execution: false,
    domain_mutation: false,
    credential_storage: false,
    adapter_authority: 'app/src/verticals/logistics/provider-adapter-contract.js',
  });
}
