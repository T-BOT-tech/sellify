import assert from 'node:assert/strict';
import { getCountryPack } from '../app/src/country-pack-contract.js';
import { resolveEthiopiaIdentity } from '../app/src/ethiopia-country-identity.js';
import { resolveCountryTaxBoundary, resolveEthiopiaTaxBoundary, COUNTRY_TAX_BOUNDARY_CONTRACT } from '../app/src/country-tax-boundary.js';

const pack = getCountryPack('ET');
assert.equal(pack.tax.mode, 'country_defined');
assert.equal(pack.tax.implementation, 'deferred');

const identity = resolveEthiopiaIdentity({ organization: { country: 'Ethiopia', currency: 'ETB', timezone: 'Africa/Addis_Ababa' }, config: { lang: 'am' } });
assert.equal(identity.active, true);
assert.equal(identity.countryCode, 'ET');

const boundary = resolveCountryTaxBoundary('ET');
assert.deepEqual(boundary, {
  countryCode: 'ET', mode: 'country_defined', implementation: 'deferred',
  taxAuthority: 'country_tax_boundary', calculationAuthority: null,
  persistence: 'none', ownsTaxLedger: false, ownsInvoiceTaxState: false,
});

const active = resolveEthiopiaTaxBoundary({ organization: { country: 'ET', currency: 'ETB' }, config: { lang: 'om' } });
assert.equal(active.active, true);
assert.equal(active.boundary.countryCode, 'ET');

const inactive = resolveEthiopiaTaxBoundary({ organization: { country: 'Kenya', currency: 'KES' }, config: { lang: 'en' } });
assert.equal(inactive.active, false);

assert.equal(COUNTRY_TAX_BOUNDARY_CONTRACT.implementationStatus, 'boundary_only');
assert.equal(COUNTRY_TAX_BOUNDARY_CONTRACT.persistence, 'none');
assert.equal(COUNTRY_TAX_BOUNDARY_CONTRACT.ownsTaxCalculation, false);
assert.equal(COUNTRY_TAX_BOUNDARY_CONTRACT.ownsTaxLedger, false);
assert.equal(COUNTRY_TAX_BOUNDARY_CONTRACT.ownsInvoiceState, false);

console.log('Phase 14.4 Tax Boundary Regression: PASS');
console.log('Ethiopia tax declaration preserved: PASS');
console.log('Existing identity / money / invoice authority preserved: PASS');
console.log('No country tax engine / ledger / persistence authority: BLOCKED');
