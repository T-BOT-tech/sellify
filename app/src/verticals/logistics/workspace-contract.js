// Phase 13.10.18 — Logistics Pack Workspace Composition Contract.
//
// Product metadata only. This maps the Logistics Pack's contextual roles to
// workspace views/capabilities for UI composition. It does not grant access,
// evaluate permissions, persist workspace state, or create a new authority.
// Server authorization remains backend/lib/authorization.js.

export const LOGISTICS_WORKSPACE_CONTRACT_VERSION = '1.0';

const ROLE_VIEWS = Object.freeze({
  logistics_manager: Object.freeze([
    'dispatch',
    'tracking',
    'proof',
    'exceptions',
    'workload',
  ]),
  logistics_dispatcher: Object.freeze([
    'dispatch',
    'tracking',
    'exceptions',
    'workload',
  ]),
  logistics_courier: Object.freeze([
    'my_assignments',
    'tracking',
    'proof',
    'exceptions',
  ]),
  logistics_viewer: Object.freeze([
    'tracking',
    'proof',
  ]),
});

const VIEW_LABELS = Object.freeze({
  dispatch: 'Dispatch',
  tracking: 'Tracking',
  proof: 'Proof',
  exceptions: 'Exceptions',
  workload: 'Workload',
  my_assignments: 'My assignments',
});

const ENTRY = Object.freeze({
  entry_point: 'logistics',
  tab: 'logistics',
  authority: 'logistics-pack',
});

function cleanRole(role) {
  return String(role ?? '').trim().toLowerCase();
}

export function getLogisticsWorkspaceComposition(role) {
  const normalizedRole = cleanRole(role);
  const views = ROLE_VIEWS[normalizedRole] || [];
  return Object.freeze({
    contract_version: LOGISTICS_WORKSPACE_CONTRACT_VERSION,
    role: normalizedRole || null,
    views: Object.freeze(views.map(view => Object.freeze({
      id: view,
      label: VIEW_LABELS[view],
      entry_point: ENTRY.entry_point,
      tab: ENTRY.tab,
    }))),
    authority: ENTRY.authority,
    authorization: 'backend/lib/authorization.js',
    persistence: 'none',
  });
}

export function logisticsWorkspaceContract() {
  return Object.freeze({
    version: LOGISTICS_WORKSPACE_CONTRACT_VERSION,
    entry: Object.freeze({ ...ENTRY }),
    roles: Object.freeze(Object.keys(ROLE_VIEWS)),
    views: Object.freeze(Object.keys(VIEW_LABELS)),
    role_views: Object.freeze(Object.fromEntries(
      Object.entries(ROLE_VIEWS).map(([role, views]) => [role, Object.freeze([...views])])
    )),
    authorization: 'backend/lib/authorization.js',
    persistence: 'none',
    permission_evaluator: 'none',
    mutation_authority: 'none',
  });
}

export function isLogisticsWorkspaceComposition(value) {
  return Boolean(value &&
    value.contract_version === LOGISTICS_WORKSPACE_CONTRACT_VERSION &&
    typeof value.role === 'string' &&
    Array.isArray(value.views) &&
    value.authority === ENTRY.authority &&
    value.authorization === 'backend/lib/authorization.js' &&
    value.persistence === 'none');
}
