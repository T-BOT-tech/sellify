// Phase 13.12.8 — Vertical mutation enforcement gate.
//
// This module is the server-side execution boundary for vertical mutations.
// Authorization must complete before the injected canonical mutation capability
// can execute. It introduces no persistence, mutation store, role store,
// permission store, approval system, audit system, or event/outbox authority.

import { AUTHZ } from './authorization.js';
import { authorizeVerticalCapability } from './vertical-capability-authorization.js';

export class VerticalMutationDeniedError extends Error {
  constructor({ decision = AUTHZ.DENY, packId, resource, action } = {}) {
    super(`Vertical mutation denied: ${packId}:${resource}:${action}`);
    this.name = 'VerticalMutationDeniedError';
    this.code = 'VERTICAL_MUTATION_DENIED';
    this.decision = decision;
    this.packId = packId;
    this.resource = resource;
    this.action = action;
  }
}

export function assertVerticalMutationDecision(
  decision,
  { packId, resource, action } = {},
) {
  if (decision !== AUTHZ.ALLOW) {
    throw new VerticalMutationDeniedError({ decision, packId, resource, action });
  }
  return decision;
}

/**
 * Authorize a vertical capability and execute the supplied canonical mutation
 * capability only when the canonical decision is ALLOW.
 *
 * The mutation callback is deliberately dependency-injected: this gate does
 * not become a Commerce, Inventory, Fulfillment, or other persistence owner.
 */
export async function executeAuthorizedVerticalMutation(
  session,
  tenant,
  packId,
  resource,
  action,
  { location = null, mutation } = {},
) {
  const decision = authorizeVerticalCapability(
    session,
    tenant,
    packId,
    resource,
    action,
    { location },
  );

  assertVerticalMutationDecision(decision, { packId, resource, action });

  if (typeof mutation !== 'function') {
    throw new TypeError('Canonical vertical mutation capability is required');
  }

  return mutation();
}

export function verticalMutationEnforcementContract() {
  return Object.freeze({
    authorization_authority: 'backend/lib/authorization.js',
    capability_authority: 'backend/lib/vertical-capability-authorization.js',
    mutation_authority: 'injected_existing_canonical_capability',
    execution_order: Object.freeze(['tenant_location_scope', 'capability_authorization', 'mutation']),
    deny_execution: 'mutation_callback_not_called',
    requires_approval: 'not_executed_until_phase13.12.9_approval_boundary',
    persistence: 'none',
    role_store: 'none',
    permission_store: 'none',
    approval_store: 'none',
    audit_store: 'none',
    event_store: 'none',
  });
}
