// FUX-2B — target Pack-role reconciliation register.
// Read-only product metadata. It never creates roles, permissions, evaluators,
// or policy. Canonical enforcement remains backend/lib/authorization.js.
import { CANONICAL_ROLES } from './role-catalog-data.js';
import { TARGET_PACK_ROLE_FAMILIES } from './role-target-data.js';
import { RESOURCE_ACTION_REGISTRY } from '../../../backend/lib/resource-action-registry.js';

const freeze = (v) => Object.freeze(v);
const canonicalNames = new Set(CANONICAL_ROLES.map(r => r.name.toLowerCase()));
const canonicalIds = new Set(CANONICAL_ROLES.map(r => r.id));

const exactCanonical = new Map(CANONICAL_ROLES.map(r => [r.name.toLowerCase(), r.id]));
const semanticMap = new Map([
  ['store owner', 'owner'], ['store manager', 'manager'],
  ['procurement manager', 'manager'], ['buyer/requester', 'buyer'],
  ['buyer network user', 'buyer'], ['farm/operations manager', 'manager'],
  ['seller admin', 'marketplace_seller_admin'], ['seller staff', 'marketplace_seller_staff'],
]);

function statusFor(role) {
  const key = role.toLowerCase();
  if (exactCanonical.has(key)) return { status: 'MAP', canonicalRole: exactCanonical.get(key), rationale: 'Target role name maps directly to an existing canonical server role.' };
  if (semanticMap.has(key)) return { status: 'MAP', canonicalRole: semanticMap.get(key), rationale: 'Target product role has an explicit product-level mapping to an existing canonical role; no new server role is created.' };
  if (key === 'admin') return { status: 'NEW', canonicalRole: null, rationale: 'No canonical admin role exists in the current server policy; assignment requires deliberate server policy work.' };
  return { status: 'EXTEND', canonicalRole: null, rationale: 'No distinct canonical server role is evidenced; permissions/scope/conditions must be deliberately reconciled before executable assignment.' };
}

const policyPacks = new Set(RESOURCE_ACTION_REGISTRY.filter(e => e.policyDefined).map(e => e.packId));

export const PACK_ROLE_RECONCILIATION = freeze(TARGET_PACK_ROLE_FAMILIES.flatMap(family => family.roles.map(role => {
  const result = statusFor(role);
  return freeze({
    pack: family.pack,
    role,
    status: result.status,
    typicalScope: family.typicalScope,
    canonicalRole: result.canonicalRole,
    capabilityPolicyEvidence: policyPacks.has(family.pack.toLowerCase().replace(/\s*\/\s*pos/i, '').replace(/\s+/g, '-')) ? 'POLICY_DEFINED_CAPABILITIES_PRESENT' : 'NO_DISTINCT_PACK_ROLE_POLICY',
    rationale: result.rationale,
    authority: 'backend/lib/authorization.js',
    persistence: 'none',
    evaluator: 'none',
  });
})));

export function listPackRoleReconciliation({ pack = null, status = null } = {}) {
  const p = pack == null ? null : String(pack).trim().toLowerCase();
  const s = status == null ? null : String(status).trim().toUpperCase();
  return PACK_ROLE_RECONCILIATION.filter(row => (!p || row.pack.toLowerCase() === p) && (!s || row.status === s));
}

export function packRoleReconciliationContract() {
  return freeze({
    rows: PACK_ROLE_RECONCILIATION.length,
    statuses: freeze(['EXISTING', 'MAP', 'EXTEND', 'NEW', 'DEFERRED']),
    authority: 'backend/lib/authorization.js',
    persistence: 'none', evaluator: 'none', policyMutation: 'none',
    note: 'Reconciliation is product metadata until a deliberate central authorization change exists.',
  });
}
