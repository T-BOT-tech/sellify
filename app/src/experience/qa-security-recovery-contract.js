// FUX-21/FUX-22/FUX-23 — Design/Engineering QA, Frontend Security UX,
// and Recovery UX composition contract.
//
// This is an experience-level trace contract. Existing Pack QA, security and
// recovery modules remain the executable surfaces; this module deliberately
// does not import browser-bound UI modules or create replacement authorities.

import { UI_STATES, isConfirmedSuccess } from './state-contract.js';

export const FUX_21_23_VERSION = '1.0';

export const FUX_21_23_FORBIDDEN_AUTHORITIES = Object.freeze([
  'identity', 'authentication', 'authorization', 'permissionStore',
  'transaction', 'ledger', 'eventStore', 'auditStore', 'recoveryEngine',
  'database', 'analyticsStore', 'experimentAssignment', 'providerStore',
]);

const SECURITY_STATES = Object.freeze([
  UI_STATES.UNKNOWN,
  UI_STATES.PERMISSION_DENIED,
  'requires_approval',
  UI_STATES.SESSION_EXPIRED,
  UI_STATES.SUCCESS,
  UI_STATES.FAILURE,
]);

const RECOVERY_STATES = Object.freeze([
  UI_STATES.OFFLINE,
  UI_STATES.QUEUED,
  UI_STATES.SYNCING,
  UI_STATES.UNKNOWN,
  UI_STATES.FAILURE,
  UI_STATES.CONFLICT,
  UI_STATES.PROVIDER_UNAVAILABLE,
  UI_STATES.SUCCESS,
]);

function assertObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
}

export function assertFux21To23Boundary(input = {}) {
  assertObject(input, 'contract');
  for (const authority of FUX_21_23_FORBIDDEN_AUTHORITIES) {
    const key = `owns${authority[0].toUpperCase()}${authority.slice(1)}`;
    if (input[key] === true) {
      throw new Error(`FUX-21/22/23 cannot own ${authority}`);
    }
  }
  return true;
}

export function fux21To23Contract() {
  return Object.freeze({
    version: FUX_21_23_VERSION,
    fux21: Object.freeze({
      authority: 'app/src/authorization/pack-traceability.js',
      execution: 'read_only',
      persistence: 'none',
      requiredTrace: 'Component → Screen → Journey → API/Capability → Canonical Authority',
      duplicateAuthority: false,
      duplicatePersistence: false,
    }),
    fux22: Object.freeze({
      authorizationAuthority: 'backend/lib/authorization.js',
      scopeAuthority: 'existing organization/location/resource authorization boundaries',
      approvalAuthority: 'backend/lib/vertical-approval-boundary.js where applicable',
      auditAuthority: 'existing audit_events / recordAuditEvent()',
      uiIsNotAuthorization: true,
      securitySurface: 'app/src/authorization/pack-security.js',
      states: SECURITY_STATES,
    }),
    fux23: Object.freeze({
      recoveryAuthority: 'app/src/authorization/pack-recovery.js + canonical domain authorities',
      readinessAuthority: 'app/src/authorization/pack-readiness.js',
      persistence: 'none',
      states: RECOVERY_STATES,
      successRequiresCanonicalConfirmation: true,
    }),
    stateAuthority: 'app/src/experience/state-contract.js',
    forbiddenAuthorities: FUX_21_23_FORBIDDEN_AUTHORITIES,
  });
}

export function validateRecoveryOutcome(state, canonicalConfirmed = false) {
  if (state === UI_STATES.SUCCESS && !canonicalConfirmed) return false;
  return !isConfirmedSuccess(state) || canonicalConfirmed;
}
