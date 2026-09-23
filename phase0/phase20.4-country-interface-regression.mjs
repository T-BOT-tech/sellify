import assert from 'node:assert/strict';
import {
  CROSS_BORDER_COUNTRY_INTERFACE,
  resolveCrossBorderCountryInterface,
  assertCrossBorderCountryInterface,
} from '../app/src/cross-border-country-interface.js';

let pass = 0;
const test = (name, fn) => {
  try { fn(); pass += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
};

test('interface is versioned', () => assert.equal(CROSS_BORDER_COUNTRY_INTERFACE.version, '1.0'));
test('interface has no persistence', () => assert.equal(CROSS_BORDER_COUNTRY_INTERFACE.persistence, 'none'));
test('interface has no mutation', () => assert.equal(CROSS_BORDER_COUNTRY_INTERFACE.mutation, 'none'));
test('interface owns no country state', () => assert.equal(CROSS_BORDER_COUNTRY_INTERFACE.ownsCountryState, false));
test('interface owns no payment state', () => assert.equal(CROSS_BORDER_COUNTRY_INTERFACE.ownsPaymentState, false));
test('interface owns no tax state', () => assert.equal(CROSS_BORDER_COUNTRY_INTERFACE.ownsTaxState, false));
test('interface owns no document state', () => assert.equal(CROSS_BORDER_COUNTRY_INTERFACE.ownsDocumentState, false));
test('interface owns no compliance state', () => assert.equal(CROSS_BORDER_COUNTRY_INTERFACE.ownsComplianceState, false));
test('interface executes no providers', () => assert.equal(CROSS_BORDER_COUNTRY_INTERFACE.executesProviders, false));

test('ET/KE resolves', () => {
  const value = resolveCrossBorderCountryInterface({ origin: 'ET', destination: 'KE' });
  assertCrossBorderCountryInterface(value);
  assert.equal(value.origin.countryCode, 'ET');
  assert.equal(value.destination.countryCode, 'KE');
});

test('country currencies come from existing packs', () => {
  const value = resolveCrossBorderCountryInterface({ origin: 'ET', destination: 'KE' });
  assert.equal(value.origin.currency, 'ETB');
  assert.equal(value.destination.currency, 'KES');
  assert.equal(value.origin.money.authority, 'existing_money_authority');
});

test('payment execution remains existing authority only', () => {
  const value = resolveCrossBorderCountryInterface({ origin: 'ET', destination: 'KE' });
  assert.equal(value.paymentExecution, 'existing_payment_authority_only');
  assert.deepEqual(value.origin.payment.providers, ['telebirr', 'cbe']);
  assert.deepEqual(value.destination.payment.providers, ['mpesa']);
});

test('tax is overlay only', () => {
  const value = resolveCrossBorderCountryInterface({ origin: 'ET', destination: 'KE' });
  assert.equal(value.taxExecution, 'country_overlay_only');
});

test('documents remain existing authority', () => {
  const value = resolveCrossBorderCountryInterface({ origin: 'ET', destination: 'KE' });
  assert.equal(value.documentExecution, 'existing_document_authority_only');
});

test('compliance remains existing authority', () => {
  const value = resolveCrossBorderCountryInterface({ origin: 'ET', destination: 'KE' });
  assert.equal(value.complianceExecution, 'existing_compliance_authority_only');
});

test('unknown country fails closed', () => {
  assert.throws(() => resolveCrossBorderCountryInterface({ origin: 'ET', destination: 'XX' }), /Unknown country pack/);
});

test('same-country lane rejected', () => {
  assert.throws(() => resolveCrossBorderCountryInterface({ origin: 'ET', destination: 'ET' }), /requires different countries/);
});

test('country aliases resolve through existing pack', () => {
  const value = resolveCrossBorderCountryInterface({ origin: 'Ethiopia', destination: 'Kenya' });
  assert.equal(value.origin.countryCode, 'ET');
  assert.equal(value.destination.countryCode, 'KE');
});

test('interface exposes no provider execution method', () => {
  const value = resolveCrossBorderCountryInterface({ origin: 'ET', destination: 'NG' });
  assert.equal(value.origin.payment.execution, 'existing_payment_authority_only');
  assert.equal(Object.prototype.hasOwnProperty.call(value, 'execute'), false);
});

test('country views are non-authoritative', () => {
  const value = resolveCrossBorderCountryInterface({ origin: 'ET', destination: 'NG' });
  assert.equal(value.origin.authoritative, false);
  assert.equal(value.destination.authoritative, false);
});

test('country views are non-persistent', () => {
  const value = resolveCrossBorderCountryInterface({ origin: 'ET', destination: 'NG' });
  assert.equal(value.origin.persistent, false);
  assert.equal(value.destination.persistent, false);
});

test('provenance identifies existing source boundaries', () => {
  const value = resolveCrossBorderCountryInterface({ origin: 'ET', destination: 'KE' });
  assert.equal(value.provenance.origin, 'country-pack-contract');
  assert.equal(value.provenance.money, 'country-pack-contract');
  assert.equal(value.provenance.payment, 'country-payment-adapter-mapping');
});

test('invalid interface is rejected', () => {
  assert.throws(() => assertCrossBorderCountryInterface({ persistence: 'sqlite', mutation: 'write' }), /persistence-free/);
});

console.log(`PHASE20.4 COUNTRY INTERFACE: ${pass} PASS / 0 FAIL`);
