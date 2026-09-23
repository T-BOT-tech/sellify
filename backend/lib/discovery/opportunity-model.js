// Phase 19.9 — Discovery Opportunity Model & Action Links.
// Opportunities are derived, persistence-free representations of a demand,
// candidate, deterministic match, evidence and feasible owning-domain actions.
// This layer owns no economic truth and never executes an action.
import { createHash } from 'node:crypto';

export const DISCOVERY_OPPORTUNITY_VERSION = '1.0';

const text = value => String(value == null ? '' : value).trim();

function stableId(parts) {
  return createHash('sha256').update(parts.map(text).join('|')).digest('hex').slice(0, 32);
}

function normalizeAction(action = {}) {
  const method = text(action.method || 'GET').toUpperCase();
  const path = text(action.path);
  if (!path || !path.startsWith('/')) return null;
  return Object.freeze({
    action: text(action.action || 'view') || 'view',
    method,
    path,
    sourceAuthority: action.sourceAuthority || null,
    sourceEntityId: action.sourceEntityId || null,
    requires: action.requires ? Object.freeze({ ...action.requires }) : undefined,
  });
}

export function buildDiscoveryOpportunity({ intent = {}, candidate = {}, explanation = {}, evidence = [], actions = [] } = {}) {
  if (!explanation?.eligible) return null;
  const source = candidate.source || null;
  const sourceEntityId = candidate.sourceEntityId || null;
  const organizationId = candidate.organizationId || candidate.organization?.id || null;
  const normalizedActions = (Array.isArray(actions) && actions.length ? actions : (Array.isArray(candidate.actions) ? candidate.actions : [])).map(normalizeAction).filter(Boolean);
  const evidenceInput = Array.isArray(evidence) && evidence.length ? evidence : (Array.isArray(candidate.evidence) ? candidate.evidence : []);
  const normalizedEvidence = evidenceInput.map(e => Object.freeze({ ...e }));
  const matchScore = Number.isFinite(Number(explanation.matchScore)) ? Number(explanation.matchScore) : null;

  return Object.freeze({
    opportunityVersion: DISCOVERY_OPPORTUNITY_VERSION,
    opportunityId: stableId([source, sourceEntityId, organizationId, JSON.stringify(intent)]),
    derived: true,
    persistent: false,
    intent: Object.freeze({ ...intent }),
    candidate: Object.freeze({
      source,
      sourceAuthority: candidate.sourceAuthority || null,
      sourceEntityId,
      entityType: candidate.entityType || null,
      organizationId,
      label: candidate.organization?.name || candidate.organizationName || candidate.seller?.name || candidate.title || null,
      productReference: candidate.productReference ? Object.freeze({ ...candidate.productReference }) : null,
    }),
    match: Object.freeze({
      rank: Number.isFinite(Number(explanation.rank)) ? Number(explanation.rank) : null,
      matchScore,
      factors: Array.isArray(explanation.factors) ? Object.freeze(explanation.factors.map(f => Object.freeze({ ...f }))) : Object.freeze([]),
      hardConstraints: Array.isArray(explanation.hardConstraints) ? Object.freeze(explanation.hardConstraints.map(c => Object.freeze({ ...c }))) : Object.freeze([]),
    }),
    evidence: Object.freeze(normalizedEvidence),
    actions: Object.freeze(normalizedActions),
    execution: Object.freeze({
      executableHere: false,
      owningDomainRequired: true,
      actionCount: normalizedActions.length,
    }),
    deterministic: true,
    ai: false,
  });
}

export function buildDiscoveryOpportunities(ranked = [], context = {}) {
  return ranked
    .map(item => buildDiscoveryOpportunity({
      intent: context,
      candidate: item.candidate,
      explanation: item.explanation,
      evidence: item.candidate?.evidence || [],
      actions: item.candidate?.actions || [],
    }))
    .filter(Boolean);
}

export function discoveryOpportunityContract() {
  return Object.freeze({
    version: DISCOVERY_OPPORTUNITY_VERSION,
    authority: 'discovery_opportunity',
    derived: true,
    persistence: 'none',
    requiresEligibleMatch: true,
    preservesProvenance: true,
    preservesEvidence: true,
    actionExecution: false,
    owningDomainExecutesActions: true,
    inventoryMutation: false,
    paymentMutation: false,
    orderMutation: false,
    procurementMutation: false,
    supplierTruthMutation: false,
    aiRanking: false,
  });
}
