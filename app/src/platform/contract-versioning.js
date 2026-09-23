// Phase 16.6 — Canonical Platform Contract Versioning.
//
// Versioning is metadata and compatibility policy only. It does not create a
// registry, persistence layer, migration store, broker, or runtime authority.
// Existing capability, adapter, and integration contracts remain authoritative.
//
// Compatibility rule:
//   same major + provider version >= consumer minimum minor
//
// Major changes are incompatible by default. Minor/patch changes are additive
// and compatible when the requested minimum is not newer than the provider.

export const PLATFORM_CONTRACT_VERSIONING_VERSION = '1.0';

function invalid(message) {
  const error = new Error(`Invalid platform contract version: ${message}`);
  error.code = 'PLATFORM_CONTRACT_VERSION_INVALID';
  throw error;
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} must be a non-empty string`);
  return value.trim();
}

function parseVersion(value, field = 'version') {
  const raw = text(value, field);
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) invalid(`${field} must use MAJOR.MINOR or MAJOR.MINOR.PATCH`);
  return Object.freeze({
    raw,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3] || 0),
  });
}

export function parsePlatformContractVersion(value) {
  return parseVersion(value);
}

export function comparePlatformContractVersions(left, right) {
  const a = parseVersion(left, 'left version');
  const b = parseVersion(right, 'right version');
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}

export function isPlatformContractCompatible(providerVersion, minimumVersion) {
  const provider = parseVersion(providerVersion, 'providerVersion');
  const minimum = parseVersion(minimumVersion, 'minimumVersion');
  return provider.major === minimum.major
    && comparePlatformContractVersions(provider.raw, minimum.raw) >= 0;
}

export function assertPlatformContractCompatibility(providerVersion, minimumVersion) {
  if (!isPlatformContractCompatible(providerVersion, minimumVersion)) {
    const error = new Error(`Contract ${providerVersion} is incompatible with minimum ${minimumVersion}`);
    error.code = 'PLATFORM_CONTRACT_VERSION_INCOMPATIBLE';
    throw error;
  }
  return true;
}

export function resolvePlatformContractVersion({ providerVersion, minimumVersion = '1.0' }) {
  const provider = parseVersion(providerVersion, 'providerVersion');
  const minimum = parseVersion(minimumVersion, 'minimumVersion');
  const compatible = isPlatformContractCompatible(provider.raw, minimum.raw);
  return Object.freeze({
    providerVersion: provider.raw,
    minimumVersion: minimum.raw,
    compatible,
    compatibility: compatible ? 'compatible' : 'incompatible',
    policy: 'same_major_and_provider_at_least_minimum',
    breakingChangeRequiresMajor: true,
    persistence: 'none',
    migrationStore: 'none',
  });
}

export function definePlatformContractVersion(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('manifest must be an object');
  const contract = text(input.contract, 'contract');
  const providerVersion = text(input.providerVersion, 'providerVersion');
  const minimumVersion = text(input.minimumVersion || '1.0', 'minimumVersion');
  const resolved = resolvePlatformContractVersion({ providerVersion, minimumVersion });
  return Object.freeze({
    versioning_version: PLATFORM_CONTRACT_VERSIONING_VERSION,
    contract,
    ...resolved,
    execution: 'metadata_only',
    authority: 'existing_contract_authority',
  });
}

export function platformContractVersioningContract() {
  return Object.freeze({
    version: PLATFORM_CONTRACT_VERSIONING_VERSION,
    policy: 'same_major_and_provider_at_least_minimum',
    breakingChangeRequiresMajor: true,
    backwardCompatibility: 'minor_and_patch_additive_changes',
    persistence: 'none',
    migrationStore: 'none',
    duplicateAuthority: false,
    duplicateEventStore: false,
    duplicateTransactionEngine: false,
  });
}
