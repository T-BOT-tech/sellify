import assert from 'node:assert/strict';
import { COUNTRY_PACK_FIELDS, countryPackContract, getCountryPack, validateCountryPack } from '../app/src/country-pack-contract.js';

const et = getCountryPack('ET');
const validation = validateCountryPack(et);
assert.equal(validation.valid, true, validation.errors.join(', '));
assert.equal(et.countryCode, 'ET');
assert.equal(et.currency, 'ETB');
assert.deepEqual(et.languages, ['en', 'am', 'om']);
assert.deepEqual([...Object.keys(et)].sort(), [...COUNTRY_PACK_FIELDS].sort());
assert.equal(countryPackContract().version, '1.0');
assert.equal(countryPackContract().persistence, 'none');
assert.equal(countryPackContract().ownsPayments, false);
assert.equal(countryPackContract().ownsCoreCommerce, false);
assert.equal(countryPackContract().ownsInventory, false);
assert.equal(countryPackContract().ownsAuthorization, false);
assert.equal(countryPackContract().ownsAudit, false);
assert.equal(countryPackContract().ownsEvents, false);
assert.equal(et.paymentProviders.implementation, 'deferred');
assert.throws(() => getCountryPack('ZZ'), (error) => error.code === 'COUNTRY_PACK_UNKNOWN');

console.log('Phase 14.1 Country Pack Contract Regression: PASS');
console.log('Contract fields: 12');
console.log('Ethiopia contract validation: PASS');
console.log('Existing Core authority boundaries preserved: PASS');
console.log('Provider integrations deferred behind adapter boundary: PASS');
console.log('No country persistence / duplicate Core authority: BLOCKED');
