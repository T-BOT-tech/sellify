// Phase 13.12.3 — canonical resource/action registry.
//
// Declarative vocabulary only. This registry does not authenticate, authorize,
// persist permissions, or evaluate roles. The existing Phase 10.3
// backend/lib/authorization.js remains the sole authorization authority.

const freeze = (value) => Object.freeze(value);

const DEFINITIONS = [
  // Agriculture-owned capabilities. Pack permissions are metadata; the
  // permission field below records the central authorization key that a future
  // enforcement gate must pass to the existing authorize() authority.
  ['agriculture', 'farm', 'view', 'agriculture:view'],
  ['agriculture', 'farm', 'manage', 'agriculture:manage'],
  ['agriculture', 'plot', 'view', 'agriculture:view'],
  ['agriculture', 'plot', 'manage', 'agriculture:manage'],
  ['agriculture', 'season', 'view', 'agriculture:view'],
  ['agriculture', 'season', 'manage', 'agriculture:manage'],
  ['agriculture', 'crop', 'view', 'agriculture:view'],
  ['agriculture', 'crop', 'manage', 'agriculture:manage'],
  ['agriculture', 'harvest', 'view', 'agriculture:view'],
  ['agriculture', 'harvest', 'manage', 'agriculture:manage'],
  ['agriculture', 'commodity', 'view', 'agriculture:view'],
  ['agriculture', 'commodity', 'manage', 'agriculture:manage'],
  ['agriculture', 'collection_center', 'view', 'agriculture:view'],
  ['agriculture', 'collection_center', 'manage', 'agriculture:manage'],
  ['agriculture', 'buyer', 'view', 'agriculture:view'],
  ['agriculture', 'buyer', 'manage', 'agriculture:manage'],

  // Restaurant-owned capabilities. Table/kitchen keys already exist in the
  // central authorization matrix. Recipe/preparation remain vocabulary-only
  // until a canonical central permission is deliberately introduced.
  ['restaurant', 'table', 'view', 'tables:status'],
  ['restaurant', 'table', 'manage', 'tables:manage'],
  ['restaurant', 'kitchen', 'view', 'kitchen:manage'],
  ['restaurant', 'kitchen', 'manage', 'kitchen:manage'],
  ['restaurant', 'recipe', 'view', null],
  ['restaurant', 'recipe', 'manage', null],
  ['restaurant', 'preparation', 'view', null],
  ['restaurant', 'preparation', 'manage', null],

  // Warehouse-owned capabilities. Inventory remains the canonical stock and
  // movement authority; these actions are only the security vocabulary.
  ['warehouse', 'storage', 'view', 'inventory:view'],
  ['warehouse', 'storage', 'manage', 'inventory:edit'],
  ['warehouse', 'receiving', 'view', 'inventory:view'],
  ['warehouse', 'receiving', 'manage', 'inventory:add'],
  ['warehouse', 'stock_adjustment', 'view', 'inventory:view'],
  ['warehouse', 'stock_adjustment', 'manage', 'inventory:edit'],

  // Logistics currently has no pack-level permission metadata and no central
  // logistics-specific permission in Phase 10.3. Register the vocabulary
  // without inventing policy. Later enforcement must remain DENY until a
  // deliberate central authorization change exists.
  ['logistics', 'shipment', 'view', null],
  ['logistics', 'shipment', 'manage', null],
  ['logistics', 'route', 'view', null],
  ['logistics', 'route', 'manage', null],
  ['logistics', 'delivery', 'view', null],
  ['logistics', 'delivery', 'manage', null],
  ['logistics', 'proof', 'view', null],
  ['logistics', 'proof', 'manage', null],
  ['logistics', 'return', 'view', null],
  ['logistics', 'return', 'manage', null],
  ['logistics', 'courier', 'view', null],
  ['logistics', 'courier', 'manage', null],
  ['logistics', 'scheduling', 'view', 'logistics:scheduling:view'],
  ['logistics', 'scheduling', 'request', 'logistics:scheduling:request'],
  ['logistics', 'scheduling', 'manage', 'logistics:scheduling:manage'],
  ['logistics', 'scheduling', 'confirm', 'logistics:scheduling:confirm'],
  ['logistics', 'scheduling', 'cancel', 'logistics:scheduling:cancel'],
];

const RESOURCE_ACTIONS = new Map();
const REGISTRY = DEFINITIONS.map(([packId, resource, action, permission]) => {
  const key = `${packId}:${resource}:${action}`;
  const entry = freeze({
    key,
    packId,
    resource,
    action,
    permission,
    authorizationAuthority: 'backend/lib/authorization.js',
    policyDefined: permission !== null,
  });
  RESOURCE_ACTIONS.set(key, entry);
  return entry;
});

export const RESOURCE_ACTION_REGISTRY = freeze(REGISTRY);

function normalize(value) {
  const result = String(value ?? '').trim().toLowerCase();
  return result || null;
}

export function getResourceAction(packId, resource, action) {
  const key = `${normalize(packId)}:${normalize(resource)}:${normalize(action)}`;
  return RESOURCE_ACTIONS.get(key) ?? null;
}

export function listResourceActions({ packId = null, resource = null } = {}) {
  const p = normalize(packId);
  const r = normalize(resource);
  return RESOURCE_ACTION_REGISTRY.filter((entry) =>
    (!p || entry.packId === p) && (!r || entry.resource === r)
  );
}

export function resourceActionRegistryContract() {
  return freeze({
    authority: 'backend/lib/authorization.js authorize(actor, organization, location, resource, action)',
    persistence: 'none',
    evaluator: 'none',
    permission_store: 'none',
    registry_entries: RESOURCE_ACTION_REGISTRY.length,
    packs: freeze(['agriculture', 'restaurant', 'warehouse', 'logistics']),
    policy_defined_entries: RESOURCE_ACTION_REGISTRY.filter((entry) => entry.policyDefined).length,
    vocabulary_only_entries: RESOURCE_ACTION_REGISTRY.filter((entry) => !entry.policyDefined).length,
  });
}
