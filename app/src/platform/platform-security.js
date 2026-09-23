// Phase 16.11 — Canonical Platform Security Boundary.
//
// Security is composed over the existing Sellify authorities. This module
// never authenticates, stores identity, evaluates a second permission matrix,
// or persists security state. It validates the platform request shape and then
// delegates tenant/country/vertical scope and authorization to existing
// authorities.
//
// Flow:
// Platform Consumer → Security Boundary → Existing Tenant/Country/Vertical
//   → Existing Authorization → Existing Domain Authority

import { AUTHZ, authorize } from '../../../backend/lib/authorization.js';
import { validateSecurityContext } from '../../../backend/lib/security-context.js';
import { countrySecurityExpansionDecision } from '../../../backend/lib/country-security-expansion.js';
import { resolvePlatformTenantCountryVerticalComposition } from './tenant-country-vertical.js';
import { getPlatformCapability } from './capability-contract.js';
import { resolveAuthorityForCapability } from './authority-registry.js';

export const PLATFORM_SECURITY_VERSION = '1.0';

export const PLATFORM_SECURITY_FORBIDDEN_AUTHORITIES = Object.freeze([
  'identityStore', 'sessionStore', 'membershipStore', 'tenantStore',
  'organizationStore', 'locationStore', 'permissionStore', 'authorizationStore',
  'countryStore', 'verticalStore', 'database', 'persistence', 'ledger',
  'transactionEngine', 'eventStore', 'broker', 'credentialStore', 'secretStore',
]);

const FORBIDDEN_REQUEST_FIELDS = Object.freeze([
  'database', 'store', 'persistence', 'credentials', 'secrets', 'token',
  'authorizationStore', 'permissionStore', 'transactionEngine', 'ledger',
  'eventStore', 'broker', 'ownsDatabase', 'ownsPersistence', 'ownsAuthorization',
  'ownsIdentityStore', 'ownsTenantStore', 'ownsOrganizationStore',
  'ownsLocationStore', 'ownsCountryStore', 'ownsVerticalStore',
]);

function fail(message, code = 'PLATFORM_SECURITY_INVALID') {
  const error = new Error(`Invalid platform security request: ${message}`);
  error.code = code;
  throw error;
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) fail(`${field} must be a non-empty string`);
  return value.trim();
}

function assertObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${field} must be an object`);
}

function assertNoForbiddenFields(input) {
  for (const field of FORBIDDEN_REQUEST_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      fail(`security boundary cannot accept ${field}`, 'PLATFORM_SECURITY_FORBIDDEN_FIELD');
    }
  }
}

export function validatePlatformSecurityRequest(input = {}) {
  assertObject(input, 'request');
  assertNoForbiddenFields(input);

  const capability = text(input.capability, 'capability').toLowerCase();
  const action = text(input.action, 'action').toLowerCase();
  const context = input.context ?? {};
  assertObject(context, 'context');

  if (!validateSecurityContext(context, { requireLocation: false })) {
    fail('existing canonical security context is required', 'PLATFORM_SECURITY_CONTEXT_INVALID');
  }

  return Object.freeze({ capability, action, context });
}

export function resolvePlatformSecurityRequest(input) {
  const request = validatePlatformSecurityRequest(input);
  const capability = getPlatformCapability(request.capability);

  if (!capability.actions.map((item) => item.toLowerCase()).includes(request.action)) {
    fail(`action ${request.action} is not declared by ${capability.capability}`, 'PLATFORM_SECURITY_ACTION_DENIED');
  }

  const authority = resolveAuthorityForCapability(capability.capability);

  // Composition is a read-only activation/scope boundary. It must not be
  // treated as an authorization replacement.
  let composition;
  try {
    composition = resolvePlatformTenantCountryVerticalComposition({
      tenant: { id: request.context.organizationId, organizationId: request.context.organizationId },
      countryCode: request.context.countryCode ?? 'ET',
      organization: request.context.organization ?? { id: request.context.organizationId, country: request.context.countryCode },
      verticalPacks: request.context.verticalPacks ?? request.context.verticals ?? [],
      locationId: request.context.locationId ?? null,
    });
  } catch (error) {
    const denied = new Error(`Platform security scope denied: ${error.message}`);
    denied.code = 'PLATFORM_SECURITY_SCOPE_DENIED';
    denied.cause = error;
    throw denied;
  }

  return Object.freeze({ request, capability, authority, composition });
}

export async function authorizePlatformRequest(input, { authorization = authorize } = {}) {
  const resolved = resolvePlatformSecurityRequest(input);
  if (typeof authorization !== 'function') {
    fail('existing authorization function is required', 'PLATFORM_SECURITY_AUTHORIZATION_REQUIRED');
  }

  const { context } = resolved.request;
  const resource = resolved.capability.resource;
  const permission = `${resource}:${resolved.request.action}`;

  const actor = { ...context, userId: context.actorId };
  const decision = context.countryCode
    ? countrySecurityExpansionDecision(
      actor,
      context.tenant ?? { chatId: context.chatId, organizationId: context.organizationId },
      context.organization ?? { id: context.organizationId, country: context.countryCode },
      context.location ?? { organizationId: context.organizationId },
      context.countryCode,
      resource,
      permission,
    )
    : await authorization(
      actor,
      context.organization ?? { id: context.organizationId, country: context.countryCode },
      context.location ?? null,
      resource,
      permission,
    );

  if (decision !== AUTHZ.ALLOW) {
    const error = new Error(`Platform security denied ${permission}`);
    error.code = decision === AUTHZ.REQUIRES_APPROVAL
      ? 'PLATFORM_SECURITY_APPROVAL_REQUIRED'
      : 'PLATFORM_SECURITY_DENIED';
    error.decision = decision;
    throw error;
  }

  return Object.freeze({
    allowed: true,
    capability: resolved.capability.capability,
    authority: resolved.authority.authority,
    action: resolved.request.action,
    organizationId: context.organizationId,
    locationId: context.locationId ?? null,
    countryCode: context.countryCode ?? null,
    execution: 'existing_authorization_and_scope_authorities',
    persistence: 'none',
  });
}

export function assertPlatformSecurityBoundary(input = {}) {
  assertObject(input, 'security boundary contract');
  for (const authority of PLATFORM_SECURITY_FORBIDDEN_AUTHORITIES) {
    const key = `owns${authority[0].toUpperCase()}${authority.slice(1)}`;
    if (input[key] === true) {
      fail(`platform security cannot own ${authority}`, 'PLATFORM_SECURITY_FORBIDDEN_AUTHORITY');
    }
  }
  return true;
}

export function platformSecurityContract() {
  return Object.freeze({
    version: PLATFORM_SECURITY_VERSION,
    identityAuthority: 'existing authenticated sessions',
    securityContext: 'backend/lib/security-context.js',
    authorizationAuthority: 'backend/lib/authorization.js',
    tenantAuthority: 'existing tenant isolation',
    countryAuthority: 'existing country security isolation',
    verticalAuthority: 'existing vertical capability authorization',
    compositionBoundary: 'app/src/platform/tenant-country-vertical.js',
    authentication: 'existing_authority_only',
    authorization: 'existing_authority_only',
    persistence: 'none',
    credentials: 'never_owned_or_stored',
    transactionAuthority: 'existing_domain_authority',
    eventStorage: 'existing_outbox_only',
    duplicateIdentityAuthority: false,
    duplicateAuthorizationAuthority: false,
    duplicateTenantAuthority: false,
    duplicateCountryAuthority: false,
    duplicateVerticalAuthority: false,
    duplicateDatabase: false,
    duplicateLedger: false,
    duplicateEventStore: false,
    duplicateBroker: false,
    failClosed: true,
    forbiddenAuthorities: PLATFORM_SECURITY_FORBIDDEN_AUTHORITIES,
  });
}
