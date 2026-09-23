import assert from 'node:assert/strict';
import {
  parsePlatformContractVersion,
  comparePlatformContractVersions,
  isPlatformContractCompatible,
  assertPlatformContractCompatibility,
  resolvePlatformContractVersion,
  definePlatformContractVersion,
  platformContractVersioningContract,
} from '../app/src/platform/contract-versioning.js';

let pass = 0;
const check = (condition, message) => { assert.equal(Boolean(condition), true, message); pass += 1; };
const throwsCode = (fn, code, message) => { assert.throws(fn, (e) => e?.code === code, message); pass += 1; };

const contract = platformContractVersioningContract();
check(contract.version === '1.0', 'versioning contract version');
check(contract.policy === 'same_major_and_provider_at_least_minimum', 'compatibility policy');
check(contract.breakingChangeRequiresMajor === true, 'major breaking-change rule');
check(contract.persistence === 'none', 'no persistence');
check(contract.migrationStore === 'none', 'no migration store');
check(contract.duplicateAuthority === false, 'no duplicate authority');
check(contract.duplicateEventStore === false, 'no duplicate event store');
check(contract.duplicateTransactionEngine === false, 'no duplicate transaction engine');

const parsed = parsePlatformContractVersion('2.4.7');
check(parsed.major === 2, 'major parsed');
check(parsed.minor === 4, 'minor parsed');
check(parsed.patch === 7, 'patch parsed');
check(comparePlatformContractVersions('1.0', '1.0.0') === 0, 'equivalent versions');
check(comparePlatformContractVersions('1.2.0', '1.1.9') > 0, 'higher minor compares greater');
check(comparePlatformContractVersions('2.0.0', '1.9.9') > 0, 'higher major compares greater');
check(comparePlatformContractVersions('1.0.1', '1.0.2') < 0, 'lower patch compares lower');

check(isPlatformContractCompatible('1.2.0', '1.0'), 'same major newer provider compatible');
check(isPlatformContractCompatible('1.0.1', '1.0'), 'same major patch compatible');
check(isPlatformContractCompatible('1.0.0', '1.0'), 'exact compatible');
check(!isPlatformContractCompatible('2.0.0', '1.0'), 'major mismatch incompatible');
check(!isPlatformContractCompatible('1.0.0', '1.1'), 'provider below minimum incompatible');
check(assertPlatformContractCompatibility('1.3.0', '1.1') === true, 'compatible assertion');
throwsCode(() => assertPlatformContractCompatibility('2.0.0', '1.0'), 'PLATFORM_CONTRACT_VERSION_INCOMPATIBLE', 'incompatible assertion');

const resolved = resolvePlatformContractVersion({ providerVersion: '1.4.0', minimumVersion: '1.2.0' });
check(resolved.compatible === true, 'resolved compatible');
check(resolved.compatibility === 'compatible', 'resolved compatibility label');
check(resolved.persistence === 'none', 'resolved no persistence');
check(resolved.migrationStore === 'none', 'resolved no migration store');

const manifest = definePlatformContractVersion({ contract: 'capability', providerVersion: '1.2.0', minimumVersion: '1.1' });
check(manifest.contract === 'capability', 'manifest contract');
check(manifest.versioning_version === '1.0', 'manifest versioning version');
check(manifest.compatible === true, 'manifest compatibility');
check(manifest.execution === 'metadata_only', 'manifest metadata only');
check(manifest.authority === 'existing_contract_authority', 'manifest existing authority');

throwsCode(() => parsePlatformContractVersion('1'), 'PLATFORM_CONTRACT_VERSION_INVALID', 'short version rejected');
throwsCode(() => parsePlatformContractVersion('v1.0'), 'PLATFORM_CONTRACT_VERSION_INVALID', 'prefixed version rejected');
throwsCode(() => parsePlatformContractVersion('1.x'), 'PLATFORM_CONTRACT_VERSION_INVALID', 'non numeric version rejected');
throwsCode(() => definePlatformContractVersion(null), 'PLATFORM_CONTRACT_VERSION_INVALID', 'invalid manifest rejected');

console.log(`Phase 16.6 Contract Versioning Regression: ${pass} PASS / 0 FAIL`);
