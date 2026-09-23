// Phase 13.12.9 — Vertical approval boundary.
//
// This module composes the existing authorization/mutation gates. It does not
// create an approval store, workflow engine, role store, permission store,
// audit authority, event authority, or configuration authority.

import { AUTHZ } from './authorization.js';
import {
  executeAuthorizedVerticalMutation,
  VerticalMutationDeniedError,
} from './vertical-mutation-enforcement.js';

export class VerticalApprovalRequiredError extends Error {
  constructor({ packId, resource, action } = {}) {
    super(`Vertical mutation requires approval: ${packId}:${resource}:${action}`);
    this.name = 'VerticalApprovalRequiredError';
    this.code = 'VERTICAL_APPROVAL_REQUIRED';
    this.decision = AUTHZ.REQUIRES_APPROVAL;
    this.packId = packId;
    this.resource = resource;
    this.action = action;
  }
}

export class VerticalApprovalDeniedError extends Error {
  constructor({ packId, resource, action, reason = 'invalid_approval' } = {}) {
    super(`Vertical approval denied: ${packId}:${resource}:${action}`);
    this.name = 'VerticalApprovalDeniedError';
    this.code = 'VERTICAL_APPROVAL_DENIED';
    this.decision = AUTHZ.DENY;
    this.packId = packId;
    this.resource = resource;
    this.action = action;
    this.reason = reason;
  }
}

function approvalEvidenceIsValid(approval) {
  return Boolean(
    approval &&
    approval.status === 'APPROVED' &&
    approval.approvedBy &&
    approval.approvedAt,
  );
}

/**
 * Enforce the approval boundary around an already-authorized mutation.
 *
 * Approval evidence is supplied by the caller and is treated as evidence,
 * not persisted or evaluated against a new local authority. A future
 * approval workflow may produce this evidence without changing this gate.
 */
export function assertVerticalApprovalBoundary(
  decision,
  { packId, resource, action, approval = null } = {},
) {
  if (decision === AUTHZ.DENY) {
    throw new VerticalMutationDeniedError({ decision, packId, resource, action });
  }

  if (decision === AUTHZ.REQUIRES_APPROVAL && !approvalEvidenceIsValid(approval)) {
    throw new VerticalApprovalRequiredError({ packId, resource, action });
  }

  if (decision === AUTHZ.REQUIRES_APPROVAL && approvalEvidenceIsValid(approval)) {
    return AUTHZ.ALLOW;
  }

  if (decision === AUTHZ.ALLOW) return AUTHZ.ALLOW;

  throw new VerticalApprovalDeniedError({
    packId,
    resource,
    action,
    reason: 'unknown_authorization_decision',
  });
}

/**
 * Execute only after the existing mutation gate and, when required, supplied
 * approval evidence have both passed. The canonical mutation remains injected.
 */
export async function executeApprovedVerticalMutation(
  session,
  tenant,
  packId,
  resource,
  action,
  { location = null, approval = null, decision = null, mutation } = {},
) {
  // For the normal path, executeAuthorizedVerticalMutation obtains the
  // canonical authorization decision itself. An explicit decision is only
  // accepted for approval-boundary certification/integration where the
  // upstream authorization authority has already produced it.
  if (decision === AUTHZ.REQUIRES_APPROVAL) {
    assertVerticalApprovalBoundary(decision, { packId, resource, action, approval });
    return executeAuthorizedVerticalMutation(
      session,
      tenant,
      packId,
      resource,
      action,
      { location, mutation },
    );
  }

  return executeAuthorizedVerticalMutation(
    session,
    tenant,
    packId,
    resource,
    action,
    { location, mutation },
  );
}

export function verticalApprovalBoundaryContract() {
  return Object.freeze({
    authorization_authority: 'backend/lib/authorization.js',
    mutation_authority: 'backend/lib/vertical-mutation-enforcement.js',
    approval_authority: 'external_existing_or_future_approval_workflow',
    approval_evidence: Object.freeze(['status', 'approvedBy', 'approvedAt']),
    requires_approval: 'approval_evidence_required_before_mutation',
    invalid_approval: 'DENY',
    persistence: 'none',
    approval_store: 'none',
    role_store: 'none',
    permission_store: 'none',
    audit_store: 'none',
    event_store: 'none',
    configuration_store: 'none',
  });
}
