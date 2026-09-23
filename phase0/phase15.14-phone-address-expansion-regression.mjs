import assert from 'node:assert/strict';
import { resolveCountryPhoneAddressRules, listCountryPhoneAddressRules, countryPhoneAddressContract } from '../app/src/country-phone-address-rules.js';

assert.equal(resolveCountryPhoneAddressRules('ET').callingCode, '+251');
assert.deepEqual(resolveCountryPhoneAddressRules('ET').address.hierarchy, ['region', 'zone', 'woreda', 'kebele']);
assert.equal(resolveCountryPhoneAddressRules('KE').callingCode, '+254');
assert.equal(resolveCountryPhoneAddressRules('TZ').callingCode, '+255');
assert.equal(resolveCountryPhoneAddressRules('NG').callingCode, '+234');
assert.equal(resolveCountryPhoneAddressRules('GH').callingCode, '+233');
assert.equal(resolveCountryPhoneAddressRules('ZM').callingCode, '+260');

const eac = ['BI','CD','KE','RW','SO','SS','TZ','UG'];
const waemu = ['BJ','BF','CI','GW','ML','NE','SN','TG'];
const cemac = ['CM','CF','TD','CG','GQ','GA'];
for (const code of [...eac, ...waemu, ...cemac]) {
  const rules = resolveCountryPhoneAddressRules(code);
  assert.match(rules.callingCode, /^\+\d+$/);
  assert.equal(rules.phone.format, 'E.164');
  assert.equal(rules.address.implementation.includes('boundary_only'), true);
}
assert.equal(new Set(listCountryPhoneAddressRules()).size, 26);
assert.equal(countryPhoneAddressContract.persistence, 'none');
assert.equal(countryPhoneAddressContract.ownsCustomerIdentity, false);
assert.equal(countryPhoneAddressContract.ownsAddressPersistence, false);
assert.equal(countryPhoneAddressContract.ownsPhonePersistence, false);
assert.equal(countryPhoneAddressContract.ownsGeocoding, false);
assert.throws(() => resolveCountryPhoneAddressRules('XX'), /Unsupported country/);
console.log('Phase 15.14 Phone / Address Expansion Regression: PASS');
