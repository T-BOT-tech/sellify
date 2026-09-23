// Phase 22.8 — Procurement Integration.
// Phase 22 routes a derived action proposal through the existing capability and
// authorization boundaries. It does not implement Procurement transactions.
// Flow: Proposal -> Capability Contract -> Existing Authorization -> Existing Authority.

import { getPlatformCapability, resolveCapabilityAction } from './platform/capability-contract.js';
import { resolveAuthorityForCapability } from './platform/authority-registry.js';
import { authorizeProcurementActionProposal } from './phase22-action-proposal-authorization.js';

export const PHASE22_PROCUREMENT_INTEGRATION_VERSION = '1.0';

const EXECUTABLE_ACTIONS = new Set(['create', 'send']);
const READ_ACTIONS = new Set(['view']);
const FORBIDDEN_PAYLOAD_FIELDS = new Set([
  'database','sql','store','persistence','credentials','secrets','token','ledger',
  'authorizationGrant','authorizationDecision','transaction','transactionHandle',
  'directExecution','providerCall','providerCredentials','createPurchaseOrder',
  'purchaseOrder','po','award','paymentExecution','inventoryMutation','orderMutation',
]);

function fail(message, code='PHASE22_PROCUREMENT_INTEGRATION_INVALID') {
  const error = new TypeError(`Invalid Phase 22 procurement integration: ${message}`);
  error.code = code;
  throw error;
}
function obj(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${field} must be an object`);
  return value;
}
function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) fail(`${field} must be a non-empty string`);
  return value.trim();
}
function scan(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PAYLOAD_FIELDS.has(key)) fail(`forbidden field: ${key}`, 'PHASE22_PROCUREMENT_EXECUTION_FORBIDDEN');
    scan(child);
  }
}

export function resolveProcurementIntegration(proposal) {
  obj(proposal, 'proposal');
  if (proposal.derived !== true) fail('only derived Phase 22 proposals may be integrated');
  if (proposal.targetAuthority !== 'procurement') fail('targetAuthority must remain procurement');
  const capability = text(proposal.targetCapability, 'targetCapability').toLowerCase();
  const action = text(proposal.targetAction, 'targetAction').toLowerCase();
  const resolved = resolveCapabilityAction(capability, action);
  const metadata = getPlatformCapability(resolved.capability);
  const authority = resolveAuthorityForCapability(resolved.capability);
  if (metadata.authority !== 'procurement' || authority.authority !== 'procurement') fail('capability authority must remain procurement');
  if (![...READ_ACTIONS, ...EXECUTABLE_ACTIONS].includes(resolved.action)) fail(`unsupported integration action: ${resolved.action}`);
  if (resolved.capability === 'procurement.execution') fail('direct procurement execution capability is not exposed to Phase 22');
  return Object.freeze({
    proposal,
    capability: resolved.capability,
    action: resolved.action,
    resource: resolved.resource,
    authority: authority.authority,
    authorityModule: authority.authorityModule,
    requiresExistingAuthorization: true,
    execution: resolved.action === 'view' ? 'existing_authority_read' : 'existing_authority_after_authorization',
    persistence: 'existing_authority_only',
    phase22Persistence: 'none',
  });
}

export async function routeProcurementActionProposal(proposal, { authorize, capabilityHandlers = {}, payload = {} } = {}) {
  const resolved = resolveProcurementIntegration(proposal);
  obj(payload, 'payload');
  scan(payload);
  if (resolved.action !== 'view' && proposal.status !== 'pending_authorization') {
    fail('mutating integration requires pending_authorization', 'PHASE22_AUTHORIZATION_REQUIRED');
  }
  if (typeof authorize !== 'function') fail('existing authorization function is required', 'PHASE22_AUTHORIZATION_REQUIRED');
  const authorization = await authorizeProcurementActionProposal(proposal, { authorize });
  if (typeof capabilityHandlers[resolved.capability] !== 'function') {
    fail(`existing capability handler is required for ${resolved.capability}`, 'PHASE22_CAPABILITY_HANDLER_REQUIRED');
  }
  const result = await capabilityHandlers[resolved.capability]({
    action: resolved.action,
    proposal: resolved.proposal,
    payload,
    authorization: authorization.authorizationDecision,
    authority: resolved.authority,
  });
  return Object.freeze({
    integration: resolved,
    authorization: 'existing_authorization',
    execution: 'existing_procurement_authority',
    delegated: true,
    phase22Persistence: 'none',
    result,
  });
}

export function assertProcurementIntegrationBoundary(proposal) {
  const resolved = resolveProcurementIntegration(proposal);
  if (resolved.authority !== 'procurement' || resolved.phase22Persistence !== 'none' || !resolved.requiresExistingAuthorization) {
    fail('integration boundary invariant violated');
  }
  return true;
}

export function phase22ProcurementIntegrationContract() {
  return Object.freeze({
    version: PHASE22_PROCUREMENT_INTEGRATION_VERSION,
    flow: 'proposal → capability → existing authorization → existing procurement authority',
    capabilityAuthority: 'existing_procurement',
    authorizationAuthority: 'existing_authorization',
    transactionAuthority: 'existing_procurement_domain',
    phase22Persistence: 'none',
    phase22TransactionAuthority: false,
    phase22DirectDatabaseAccess: false,
    phase22DirectProviderExecution: false,
    procurementExecutionCapabilityExposed: false,
    handlerOwnership: 'injected_existing_capability_handler',
    principle: 'Phase 22 routes; existing Procurement executes',
  });
}
