// FUX-13.5 — Server-side Pack lifecycle precondition boundary.
//
// This is a small projection of the existing declarative Pack manifests. It is
// not a second readiness UI, authorization engine, entitlement store, or Pack
// configuration authority. It exists only so the canonical server lifecycle
// transaction can reject unknown Packs and unavailable Core dependencies before
// an eligibility/activation transition is committed.

import { VERTICAL_PACK_MANIFEST_LIST } from '../../shared/vertical-pack-manifests.js';

const CORE_AUTHORITIES = Object.freeze([
  'commerce', 'inventory', 'payments', 'customers', 'locations',
  'fulfillment', 'documents', 'audit',
]);
const PACKS = VERTICAL_PACK_MANIFEST_LIST;
const PACK_REGISTRY = new Map(PACKS.map((pack) => [pack.pack_id, pack]));
const CORE_AUTHORITY_SET = new Set(CORE_AUTHORITIES.map((value) => String(value).toLowerCase()));

function normalizePackId(value) {
  const result = String(value ?? '').trim().toLowerCase();
  return result || null;
}

function readinessFailure(code, message, pack = null, missingDependencies = []) {
  const error = Object.assign(new Error(message), {
    statusCode: code === 'PACK_UNKNOWN' ? 404 : 409,
    code,
  });
  error.packId = pack?.pack_id || null;
  error.packVersion = pack?.version || null;
  error.missingDependencies = [...missingDependencies];
  throw error;
}

export function getPackLifecycleManifest(packId) {
  const normalized = normalizePackId(packId);
  return normalized ? PACK_REGISTRY.get(normalized) || null : null;
}

export function evaluatePackLifecyclePrecondition(packId, targetState) {
  const normalized = normalizePackId(packId);
  const target = String(targetState ?? '').trim().toUpperCase();
  const pack = getPackLifecycleManifest(normalized);

  if (!pack) {
    return Object.freeze({
      ok: false,
      code: 'PACK_UNKNOWN',
      packId: normalized,
      packVersion: null,
      targetState: target,
      missingDependencies: Object.freeze([]),
    });
  }

  const missingDependencies = pack.core_dependencies
    .map((dependency) => String(dependency).toLowerCase())
    .filter((dependency) => !CORE_AUTHORITY_SET.has(dependency));

  if (missingDependencies.length) {
    return Object.freeze({
      ok: false,
      code: 'DEPENDENCY_UNAVAILABLE',
      packId: pack.pack_id,
      packVersion: pack.version,
      targetState: target,
      missingDependencies: Object.freeze(missingDependencies),
    });
  }

  return Object.freeze({
    ok: true,
    code: 'READY',
    packId: pack.pack_id,
    packVersion: pack.version,
    targetState: target,
    missingDependencies: Object.freeze([]),
  });
}

export function derivePackLifecycleReadiness(packId, lifecycle = null, context = {}) {
  const normalized = normalizePackId(packId);
  const pack = getPackLifecycleManifest(normalized);
  if (!pack) {
    return Object.freeze({
      state: 'UNKNOWN',
      code: 'PACK_UNKNOWN',
      eligible: false,
      active: false,
      organizationScoped: Boolean(context.organizationId),
      packId: normalized,
      packVersion: null,
      missingDependencies: Object.freeze([]),
    });
  }

  const staticReadiness = evaluatePackLifecyclePrecondition(normalized, 'ELIGIBLE');
  if (!staticReadiness.ok) {
    return Object.freeze({
      state: 'DEPENDENCY_BLOCKED',
      code: staticReadiness.code,
      eligible: false,
      active: false,
      organizationScoped: Boolean(context.organizationId),
      packId: pack.pack_id,
      packVersion: pack.version,
      missingDependencies: Object.freeze([...staticReadiness.missingDependencies]),
    });
  }

  const lifecycleState = String(lifecycle?.state || 'NOT_INSTALLED').trim().toUpperCase();
  const eligible = ['INSTALLED', 'ELIGIBLE', 'ACTIVE', 'DEACTIVATED', 'UPGRADE_AVAILABLE'].includes(lifecycleState);
  const active = lifecycleState === 'ACTIVE';

  return Object.freeze({
    state: active ? 'ACTIVE' : eligible ? 'ELIGIBLE' : lifecycleState,
    code: active ? 'ACTIVE' : eligible ? 'READY' : lifecycleState,
    eligible,
    active,
    organizationScoped: Boolean(context.organizationId),
    packId: pack.pack_id,
    packVersion: lifecycle?.packVersion || pack.version,
    missingDependencies: Object.freeze([]),
  });
}

export function assertPackLifecyclePrecondition(packId, targetState) {
  const result = evaluatePackLifecyclePrecondition(packId, targetState);
  if (!result.ok) {
    readinessFailure(
      result.code,
      result.code === 'PACK_UNKNOWN'
        ? `Unknown Pack: ${String(packId ?? '')}`
        : result.code === 'DEPENDENCY_UNAVAILABLE'
          ? `Pack dependencies unavailable: ${result.missingDependencies.join(', ')}`
          : 'Pack configuration does not establish an executable lifecycle state',
      getPackLifecycleManifest(packId),
      result.missingDependencies,
    );
  }
  return result;
}

export function packLifecycleReadinessContract() {
  return Object.freeze({
    authority: 'existing app/src/verticals/*/pack.js declarative manifests',
    evaluator: 'backend/lib/pack-lifecycle-readiness.js',
    purpose: 'server lifecycle precondition only',
    authorizationAuthority: 'backend/lib/authorization.js',
    configurationAuthority: 'app/src/state.js#config',
    duplicateAuthorizationAuthority: false,
    duplicateConfigurationAuthority: false,
    packs: Object.freeze(PACKS.map((pack) => pack.pack_id)),
  });
}
