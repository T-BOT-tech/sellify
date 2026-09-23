// FUX-24 — In-product Documentation / Help Architecture.
// Experience-only composition contract. Documentation may explain or link to
// canonical capabilities, but it never becomes an authority for permissions,
// transactions, Pack lifecycle, domain state, or execution.

export const FUX_24_VERSION = '1.0';

export const DOCUMENTATION_TYPES = Object.freeze([
  'ONBOARDING',
  'CONTEXTUAL_HELP',
  'OPERATIONAL_GUIDANCE',
]);

export const DOCUMENTATION_AUDIENCES = Object.freeze([
  'ROLE',
  'PACK',
  'CHANNEL',
  'STATE',
  'GLOBAL',
]);

export const DOCUMENTATION_ACTIONS = Object.freeze([
  'READ',
  'OPEN_CANONICAL_DESTINATION',
]);

export const FUX_24_FORBIDDEN_AUTHORITIES = Object.freeze([
  'authorization',
  'permissionStore',
  'transaction',
  'ledger',
  'eventStore',
  'auditStore',
  'packLifecycle',
  'domainState',
  'recoveryEngine',
  'analyticsStore',
  'experimentAssignment',
  'providerStore',
]);

function assertObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
}

function normalizeList(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [String(value)];
}

export function assertFux24Boundary(input = {}) {
  assertObject(input, 'contract');
  for (const authority of FUX_24_FORBIDDEN_AUTHORITIES) {
    const key = `owns${authority[0].toUpperCase()}${authority.slice(1)}`;
    if (input[key] === true) throw new Error(`FUX-24 cannot own ${authority}`);
  }
  return true;
}

export function validateHelpEntry(entry = {}) {
  assertObject(entry, 'entry');
  if (!DOCUMENTATION_TYPES.includes(entry.type)) throw new Error('invalid documentation type');
  if (!entry.id || !entry.titleKey || !entry.bodyKey) throw new Error('documentation entry requires id/titleKey/bodyKey');
  const actions = normalizeList(entry.actions);
  if (actions.some(action => !DOCUMENTATION_ACTIONS.includes(action))) throw new Error('invalid documentation action');
  if (entry.authority) throw new Error('documentation entries must not declare canonical authority');
  return true;
}

export function selectDocumentation(entries = [], context = {}) {
  assertObject(context, 'context');
  const roles = new Set(normalizeList(context.roles));
  const packs = new Set(normalizeList(context.packs));
  const channels = new Set(normalizeList(context.channels));
  const states = new Set(normalizeList(context.states));

  return entries.filter(entry => {
    validateHelpEntry(entry);
    const matches = (values, allowed) => values.length === 0 || values.some(value => allowed.has(value));
    return matches(normalizeList(entry.roles), roles)
      && matches(normalizeList(entry.packs), packs)
      && matches(normalizeList(entry.channels), channels)
      && matches(normalizeList(entry.states), states);
  });
}

export function documentationContract() {
  return Object.freeze({
    version: FUX_24_VERSION,
    purpose: 'role-aware onboarding, contextual help and operational guidance',
    authority: 'experience documentation only',
    contentAuthority: 'localized documentation content supplied by the product',
    executionAuthority: 'none',
    actions: DOCUMENTATION_ACTIONS,
    audiences: DOCUMENTATION_AUDIENCES,
    types: DOCUMENTATION_TYPES,
    forbiddenAuthorities: FUX_24_FORBIDDEN_AUTHORITIES,
    roleContextAuthority: 'existing identity/membership/role/scope context',
    packContextAuthority: 'existing Pack/entitlement/readiness context',
    stateContextAuthority: 'app/src/experience/state-contract.js',
    localizationAuthority: 'app/src/i18n/translations.js + existing i18n helpers',
    canonicalDestinationRule: 'documentation may link to canonical capability screens; it cannot execute mutations',
    duplicateAuthority: false,
    duplicatePersistence: false,
  });
}
