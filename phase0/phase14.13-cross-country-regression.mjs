import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
globalThis.window = { __APP_CONFIG__: {} };

const scripts = [
  'phase0/phase14.0-country-pack-baseline-regression.mjs',
  'phase0/phase14.1-country-pack-contract-regression.mjs',
  'phase0/phase14.2-ethiopia-pack-identity-locale-regression.mjs',
  'phase0/phase14.3-country-currency-money-regression.mjs',
  'phase0/phase14.4-tax-boundary-regression.mjs',
  'phase0/phase14.5-document-invoice-boundary-regression.mjs',
  'phase0/phase14.6-phone-address-regression.mjs',
  'phase0/phase14.7-ethiopia-payment-adapter-regression.mjs',
  'phase0/phase14.8-ethiopia-compliance-boundary-regression.mjs',
  'phase0/phase14.9-country-configuration-regression.mjs',
  'phase0/phase14.10-country-security-isolation-regression.mjs',
  'phase0/phase14.11-country-events-outbox-regression.mjs',
  'phase0/phase14.12-ethiopia-integration-regression.mjs',
];

for (const script of scripts) {
  assert(fs.existsSync(script), `Missing Phase 14 regression: ${script}`);
  execFileSync(process.execPath, [script], { cwd: root, stdio: 'pipe' });
}

const pack = await import('../app/src/country-pack-contract.js');
assert.deepEqual(pack.listCountryPacks(), ['et']);
assert.equal(pack.getCountryPack('ET').countryCode, 'ET');
assert.equal(pack.getCountryPack('ethiopia').countryCode, 'ET');
for (const unsupported of ['US', 'KE', 'NG', 'GB', 'IN']) {
  assert.throws(() => pack.getCountryPack(unsupported), error => error?.code === 'COUNTRY_PACK_UNKNOWN');
}

const config = await import('../app/src/country-configuration.js');
const etConfig = config.resolveCountryConfiguration({ organization: { country: 'ET', currency: 'ETB' }, config: { lang: 'en' } });
assert.equal(etConfig.countryCode, 'ET');
assert.equal(etConfig.configuration.currency, 'ETB');
assert.throws(() => config.resolveCountryConfiguration({ organization: { country: 'US' } }), /Unknown country pack/);

const event = await import('../app/src/country-event-integration.js');
assert.throws(() => event.buildCountryVersionedEvent({ countryCode: 'US', eventId: 'US:x', eventType: 'customer.upsert', aggregateType: 'customer', aggregateId: 'c1', organizationId: 'o1', payload: {} }), /Unknown country pack/);

const source = fs.readFileSync('app/src/country-pack-contract.js', 'utf8');
assert.doesNotMatch(source, /fallback|default.*country|US|KE|NG/);
assert.equal(pack.countryPackContract().ownsAuthorization, false);
assert.equal(pack.countryPackContract().ownsEvents, false);
assert.equal(pack.countryPackContract().ownsPayments, false);

console.log('Phase 14.13 Cross-Country Regression: PASS');
console.log('Phase 14.0–14.12 cumulative regression chain: PASS');
console.log('Ethiopia canonical pack remains ET-only: PASS');
console.log('Unsupported country packs fail closed: PASS');
console.log('No silent country fallback/default pack: PASS');
console.log('Country pack owns no authorization/events/payments authority: BLOCKED');
