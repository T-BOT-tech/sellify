import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crossRegionCountryStatus, regionsForCountry, resolveCrossRegionBoundary, crossRegionIntegrationContract } from '../app/src/cross-region-integration-contract.js';
import { countrySecurityExpansionStatus, countrySecurityExpansionContract } from '../backend/lib/country-security-expansion.js';
import { countryEventExpansionContract } from '../app/src/country-event-expansion.js';
import { complianceExpansionContract } from '../app/src/compliance-expansion-contract.js';
import { resolveCountryPaymentAdapterMapping, countryPaymentAdapterContract } from '../app/src/country-payment-adapter-mapping.js';
import { taxBoundaryExpansionContract } from '../app/src/tax-boundary-expansion-contract.js';
import { documentInvoiceExpansionContract } from '../app/src/document-invoice-expansion-contract.js';
import { countryPhoneAddressContract } from '../app/src/country-phone-address-rules.js';
import { currencyMoneyContract } from '../app/src/currency-money-contract.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let checks = 0;
const eq = (a,b,m) => { checks++; assert.deepEqual(a,b,m); };
const ok = (v,m) => { checks++; assert.equal(Boolean(v),true,m); };

// Active country matrix.
for (const code of ['ET','KE','TZ','NG']) {
  eq(crossRegionCountryStatus(code), 'active_country_pack', `${code} active`);
  eq(countrySecurityExpansionStatus(code), 'active_country_pack', `${code} security active`);
}
for (const code of ['GH','ZM']) {
  eq(crossRegionCountryStatus(code), 'strategic_candidate', `${code} candidate`);
  eq(countrySecurityExpansionStatus(code), 'strategic_candidate', `${code} security candidate`);
}
for (const code of ['UG','BJ','CM']) {
  eq(crossRegionCountryStatus(code), 'regional_country_boundary_only', `${code} regional-only`);
  eq(countrySecurityExpansionStatus(code), 'regional_country_boundary_only', `${code} security regional-only`);
}

// Regional membership and cross-country resolution.
eq(regionsForCountry('KE'), ['eac'], 'KE EAC');
eq(regionsForCountry('TZ'), ['eac'], 'TZ EAC');
eq(regionsForCountry('BJ'), ['waemu'], 'BJ WAEMU');
eq(regionsForCountry('CM'), ['cemac'], 'CM CEMAC');
eq(regionsForCountry('ET'), [], 'ET standalone');
const eac = resolveCrossRegionBoundary({fromCountry:'KE',toCountry:'TZ'});
eq(eac.sameRegion, true, 'KE→TZ same region');
eq(eac.regionalExecution, 'none', 'no regional execution');
eq(eac.persistence, 'none', 'no regional persistence');
const cross = resolveCrossRegionBoundary({fromCountry:'ET',toCountry:'KE'});
eq(cross.sameRegion, false, 'ET→KE cross-region');
eq(cross.integrationMode, 'country_overlay_plus_existing_core_capability', 'canonical composition');

// Canonical authority contract checks.
for (const [name, contract] of [
  ['cross-region', crossRegionIntegrationContract()],
  ['security', countrySecurityExpansionContract()],
  ['events', countryEventExpansionContract()],
  ['compliance', complianceExpansionContract()],
  ['payments', countryPaymentAdapterContract],
  ['tax', taxBoundaryExpansionContract()],
  ['documents', documentInvoiceExpansionContract()],
  ['phone/address', countryPhoneAddressContract],
  ['money', currencyMoneyContract()],
]) {
  ok(contract && typeof contract === 'object', `${name} contract exists`);
  ok(contract.persistence === 'none' || contract.persistence === undefined || String(contract.persistence).startsWith('existing '), `${name} persistence boundary`);
  for (const key of Object.keys(contract)) { if (/^owns[A-Z]/.test(key)) ok(contract[key] === false, `${name} ownership boundary: ${key}`); }
}

// Existing provider mappings remain deferred/non-executable.
for (const code of ['ET','KE','TZ','NG']) {
  const mapping = resolveCountryPaymentAdapterMapping(code);
  ok(mapping, `${code} payment mapping exists`);
  ok(mapping.providers.every((id) => mapping.providerMetadata.some((meta) => meta.id === id)), `${code} provider metadata resolves`);
  eq(mapping.implementation, 'adapter_mapping_only', `${code} payment mapping remains declarative`);
}

// No new regional authority or duplicate stores in Phase 15 country expansion files.
const phaseFiles = [
  'app/src/cross-region-integration-contract.js',
  'backend/lib/country-security-expansion.js',
  'app/src/country-event-expansion.js',
  'app/src/compliance-expansion-contract.js',
  'app/src/country-payment-adapter-mapping.js',
  'app/src/tax-boundary-expansion-contract.js',
  'app/src/document-invoice-expansion-contract.js',
  'app/src/country-phone-address-rules.js',
  'app/src/currency-money-contract.js',
];
const forbidden = /(new\s+Database|CREATE\s+TABLE)/i;
for (const file of phaseFiles) {
  const source = read(file);
  ok(!forbidden.test(source), `no duplicate regional authority in ${file}`);
}

// Fail-closed candidate/unknown cross-region paths.
assert.throws(() => resolveCrossRegionBoundary({fromCountry:'KE',toCountry:'GH'}), /active country packs/);
assert.throws(() => resolveCrossRegionBoundary({fromCountry:'ET',toCountry:'UG'}), /active country packs/);
assert.throws(() => resolveCrossRegionBoundary({fromCountry:'ET',toCountry:'US'}), /Unknown country boundary/);
checks += 3;

console.log('Phase 15.20 Cross-Country Regression Gate: PASS');
console.log(`Golden assertions: ${checks} PASS / 0 FAIL`);
console.log('Active country matrix: PASS');
console.log('Regional/candidate fail-closed matrix: PASS');
console.log('Cross-region composition boundary: PASS');
console.log('Canonical authority preservation: PASS');
console.log('No duplicate regional authority: PASS');
