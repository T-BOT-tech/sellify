// Phase 16.5 — Canonical Capability Discovery.
//
// Discovery is metadata-only. It tells a consumer which canonical capabilities
// exist, which actions they expose, which existing authority owns them, and
// which platform boundary applies. It does not execute actions, authorize a
// caller, expose persistence, or return database/store handles.
//
// Flow:
// Consumer → Capability Discovery → Capability Contract → Authority

import {
  listPlatformCapabilities,
  getPlatformCapability,
  resolveCapabilityAction,
} from './capability-contract.js';
import { resolveAuthorityForCapability } from './authority-registry.js';
import { listPlatformAdapters } from './adapter-framework.js';
import { listPlatformIntegrations } from './integration-contract.js';

export const PLATFORM_CAPABILITY_DISCOVERY_VERSION = '1.0';

const FORBIDDEN_DISCOVERY_FIELDS = Object.freeze([
  'database', 'store', 'persistence', 'credentials', 'secrets',
  'authorizationGrant', 'token', 'transactionHandle', 'ledger',
]);

function invalid(message) {
  const error = new Error(`Invalid platform capability discovery: ${message}`);
  error.code = 'PLATFORM_CAPABILITY_DISCOVERY_INVALID';
  throw error;
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} must be a non-empty string`);
  return value.trim();
}

function assertNoSensitiveFields(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return;
  for (const field of FORBIDDEN_DISCOVERY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      invalid(`discovery cannot expose ${field}`);
    }
  }
}

function publicCapability(capabilityName) {
  const capability = getPlatformCapability(capabilityName);
  const authority = resolveAuthorityForCapability(capability.capability);
  return Object.freeze({
    capability: capability.capability,
    authority: authority.authority,
    resource: capability.resource,
    actions: Object.freeze([...capability.actions]),
    status: capability.status,
    contract_version: capability.contract_version,
    execution: 'delegate_to_existing_authority',
    persistence: 'none',
    authorization: 'existing_authorization',
  });
}

export function discoverPlatformCapabilities({ status = null, authority = null } = {}) {
  if (status !== null && typeof status !== 'string') invalid('status must be a string or null');
  if (authority !== null && typeof authority !== 'string') invalid('authority must be a string or null');
  const normalizedStatus = status?.trim().toLowerCase() || null;
  const normalizedAuthority = authority?.trim().toLowerCase() || null;

  return Object.freeze(listPlatformCapabilities()
    .map(publicCapability)
    .filter((item) => !normalizedStatus || item.status === normalizedStatus)
    .filter((item) => !normalizedAuthority || item.authority === normalizedAuthority));
}

export function discoverPlatformCapability(capabilityName) {
  return publicCapability(text(capabilityName, 'capability'));
}

export function discoverCapabilityAction(capabilityName, action) {
  const resolved = resolveCapabilityAction(capabilityName, action);
  const authority = resolveAuthorityForCapability(resolved.capability);
  return Object.freeze({
    capability: resolved.capability,
    action: resolved.action,
    authority: authority.authority,
    resource: resolved.resource,
    execution: 'delegate_to_existing_authority',
    authorization: 'existing_authorization',
    persistence: 'none',
  });
}

export function discoverPlatformSurface() {
  const capabilities = discoverPlatformCapabilities();
  const adapters = listPlatformAdapters().map(({ id, capability, provider, version, operations, status }) => ({
    id, capability, provider, version, operations: [...operations], status,
  }));
  const integrations = listPlatformIntegrations().map(({ id, source, target, capability, version, direction, operations, status, scope, adapterId }) => ({
    id, source, target, capability, version, direction,
    operations: [...operations], status, scope, adapterId,
  }));

  return Object.freeze({
    version: PLATFORM_CAPABILITY_DISCOVERY_VERSION,
    discovery: 'metadata_only',
    capabilities,
    adapters: Object.freeze(adapters),
    integrations: Object.freeze(integrations),
    execution: 'none',
    persistence: 'none',
    authorization: 'existing_authorization',
    transactionAuthority: 'existing_domain_transaction',
    sensitiveData: 'not_exposed',
  });
}

export function assertCapabilityDiscoveryRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('request must be an object');
  assertNoSensitiveFields(input);
  if (input.capability !== undefined) text(input.capability, 'capability');
  if (input.action !== undefined) text(input.action, 'action');
  if (input.authority !== undefined) text(input.authority, 'authority');
  return true;
}

export function platformCapabilityDiscoveryContract() {
  return Object.freeze({
    version: PLATFORM_CAPABILITY_DISCOVERY_VERSION,
    authority: 'canonical capability contracts + existing authority registry',
    execution: 'metadata_only',
    persistence: 'none',
    authorization: 'existing_authorization',
    transactionAuthority: 'existing_domain_transaction',
    sensitiveData: 'not_exposed',
    duplicateAuthority: false,
    duplicatePersistence: false,
    duplicateEventStore: false,
  });
}
