// FUX-13 — Pack Installation / Activation Experience Contract.
// The canonical Pack lifecycle persistence/service now exists server-side.
// The experience layer still does not mutate Pack state directly; API/server
// authorization remains the execution boundary.

export const FUX13_PACK_ACTIVATION_CONTRACT_VERSION = '1.0';

export const PACK_LIFECYCLE_STATES = Object.freeze([
  'NOT_INSTALLED',
  'INSTALLED',
  'ELIGIBILITY_UNKNOWN',
  'ELIGIBLE',
  'DEPENDENCY_BLOCKED',
  'ACTIVATION_AUTHORIZATION_REQUIRED',
  'ACTIVE',
  'DEACTIVATION_AUTHORIZATION_REQUIRED',
  'DEACTIVATED',
  'UPGRADE_AVAILABLE',
  'UPGRADE_AUTHORIZATION_REQUIRED',
  'UPGRADE_BLOCKED',
  'RECOVERY_REQUIRED',
  'UNKNOWN',
]);

export const PACK_LIFECYCLE_ACTIONS = Object.freeze([
  'VIEW',
  'CHECK_ELIGIBILITY',
  'INSTALL',
  'ACTIVATE',
  'DEACTIVATE',
  'UPGRADE',
  'RETRY',
]);

const ACTION_REQUIREMENTS = Object.freeze({
  INSTALL: Object.freeze({ requiresCanonicalLifecycleApi: true, mutation: true }),
  ACTIVATE: Object.freeze({ requiresCanonicalLifecycleApi: true, mutation: true }),
  DEACTIVATE: Object.freeze({ requiresCanonicalLifecycleApi: true, mutation: true }),
  UPGRADE: Object.freeze({ requiresCanonicalLifecycleApi: true, mutation: true }),
  CHECK_ELIGIBILITY: Object.freeze({ requiresCanonicalLifecycleApi: false, mutation: false }),
  RETRY: Object.freeze({ requiresCanonicalLifecycleApi: false, mutation: false }),
  VIEW: Object.freeze({ requiresCanonicalLifecycleApi: false, mutation: false }),
});

export function getPackUxStateProjection({ lifecycle = null, readiness = null, configured = null, entitled = null } = {}) {
  const lifecycleState = String(lifecycle?.state || 'UNKNOWN').trim().toUpperCase();
  const readinessState = String(readiness?.state || readiness?.readiness || 'UNKNOWN').trim().toUpperCase();
  return Object.freeze({
    installed: !['NOT_INSTALLED', 'UNKNOWN'].includes(lifecycleState),
    eligible: readiness?.eligible === true || ['ELIGIBLE', 'ACTIVE'].includes(readinessState),
    active: lifecycleState === 'ACTIVE',
    configured: configured === true,
    entitled: entitled === true,
    operational: lifecycleState === 'ACTIVE' && readiness?.active === true,
    lifecycleState,
    readinessState,
  });
}

export function getPackActivationExperienceModel({ pack, readiness = null, entitlement = null, lifecycle = null } = {}) {
  if (!pack || typeof pack !== 'object' || !pack.pack_id) {
    throw new TypeError('pack.pack_id is required');
  }

  const readinessState = readiness?.readiness || 'UNKNOWN';
  const configurationState = entitlement?.configurationState || 'UNKNOWN';
  const persistedLifecycleState = typeof lifecycle?.state === 'string' && lifecycle.state.trim()
    ? lifecycle.state.trim().toUpperCase()
    : null;
  const lifecycleState = persistedLifecycleState || (readinessState === 'READY'
    ? 'ACTIVE'
    : readinessState === 'CONFIGURATION_INACTIVE'
      ? 'DEACTIVATED'
      : readinessState === 'DECLARATIVE_ONLY'
        ? 'UNKNOWN'
        : readinessState === 'DEPENDENCY_UNAVAILABLE'
          ? 'DEPENDENCY_BLOCKED'
          : 'UNKNOWN');
  const installationStatus = persistedLifecycleState
    ? (persistedLifecycleState === 'NOT_INSTALLED' ? 'NOT_INSTALLED' : 'INSTALLED')
    : 'UNKNOWN';

  return Object.freeze({
    contractVersion: FUX13_PACK_ACTIVATION_CONTRACT_VERSION,
    packId: String(pack.pack_id),
    packVersion: String(pack.version ?? ''),
    lifecycleState,
    readinessState,
    configurationState,
    installation: Object.freeze({
      status: installationStatus,
      reason: persistedLifecycleState
        ? 'Installation status is derived from the canonical server lifecycle record.'
        : 'Canonical lifecycle persistence and authorized server routing now exist; frontend clients must use the server lifecycle boundary rather than mutate local configuration.',
    }),
    eligibility: Object.freeze({
      status: readinessState === 'READY' ? 'ELIGIBLE' : readinessState,
      authority: 'app/src/authorization/pack-readiness.js',
    }),
    dependencies: Object.freeze({
      status: readinessState === 'DEPENDENCY_UNAVAILABLE' ? 'BLOCKED' : 'CHECKED_BY_EXISTING_READINESS',
      authority: 'app/src/authorization/pack-readiness.js',
    }),
    authorization: Object.freeze({
      authority: 'backend/lib/authorization.js',
      mutationBoundary: 'server',
    }),
    configuration: Object.freeze({
      authority: 'app/src/state.js#config',
      persistence: 'STORAGE_KEYS.config',
    }),
    lifecycleMutation: Object.freeze({
      supported: true,
      authority: 'backend/server.js#handlePackLifecycle → backend/lib/store-sqlite.js#transitionPackLifecycle',
      reason: 'Lifecycle mutation is exposed only through the authenticated, centrally authorized server boundary.',
    }),
  });
}

export function packActivationActionModel(action) {
  const key = String(action || '').toUpperCase();
  const requirement = ACTION_REQUIREMENTS[key];
  if (!requirement) throw new TypeError(`Unknown Pack lifecycle action: ${action}`);
  return Object.freeze({
    action: key,
    ...requirement,
    allowedByFux13: true,
    outcome: requirement.mutation ? 'SERVER_AUTHORIZED_MUTATION' : 'READ_ONLY_EXPERIENCE',
  });
}

export const PACK_LIFECYCLE_RECORD_CONTRACT_VERSION = '1.0';

export const PACK_LIFECYCLE_RECORD_FIELDS = Object.freeze([
  'organization_id',
  'pack_id',
  'pack_version',
  'state',
  'installed_at',
  'activated_at',
  'deactivated_at',
  'created_by_user_id',
  'updated_by_user_id',
  'created_at',
  'updated_at',
  'version',
]);

export const PACK_LIFECYCLE_RECORD_BOUNDARY = Object.freeze({
  organizationScoped: true,
  uniqueness: 'organization_id + pack_id',
  owns: Object.freeze(['lifecycle_state']),
  doesNotOwn: Object.freeze([
    'permissions',
    'memberships',
    'domain_configuration',
    'orders',
    'inventory',
    'payments',
    'fulfillment',
    'events',
    'audit',
  ]),
  authorizationAuthority: 'backend/lib/authorization.js',
  auditAuthority: 'existing backend audit_events / recordAuditEvent()',
  eventAuthority: 'existing versioned event boundary / sync_events',
  migration: 'add -> dual-read -> verify -> switch -> deprecate -> remove',
  implementationStatus: 'PERSISTENCE_AND_TRANSACTION_SERVICE',
});

export function packLifecycleRecordContract() {
  return Object.freeze({
    contractVersion: PACK_LIFECYCLE_RECORD_CONTRACT_VERSION,
    fields: PACK_LIFECYCLE_RECORD_FIELDS,
    boundary: PACK_LIFECYCLE_RECORD_BOUNDARY,
    persistenceAuthority: 'backend/lib/store-sqlite.js#pack_lifecycle',
    mutationAuthority: 'backend/lib/store-sqlite.js#transitionPackLifecycle',
    duplicateAuthority: false,
  });
}

export function packActivationContract() {
  return Object.freeze({
    contractVersion: FUX13_PACK_ACTIVATION_CONTRACT_VERSION,
    lifecycleStates: PACK_LIFECYCLE_STATES,
    actions: PACK_LIFECYCLE_ACTIONS,
    lifecycleAuthority: 'backend/lib/store-sqlite.js#pack_lifecycle',
    configurationAuthority: 'app/src/state.js#config',
    entitlementAuthority: 'existing Pack entitlement/configuration surfaces',
    authorizationAuthority: 'backend/lib/authorization.js',
    auditAuthority: 'existing Pack audit/event boundary',
    mutationPolicy: 'Pack lifecycle mutation is server-side only; clients must use the authenticated canonical lifecycle API and must not mutate local lifecycle state.',
    duplicateAuthority: false,
  });
}
