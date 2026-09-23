import assert from 'node:assert/strict';
import {
  buildCurrencyContext,
  resolveCrossBorderCurrencyContext,
  assertCrossBorderCurrencyContext,
  CROSS_BORDER_CURRENCY_CONTEXT,
  CROSS_BORDER_FX_STATES,
} from '../app/src/cross-border-currency-context.js';

let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log(`PASS ${name}`); };

test('contract is non-persistent and non-authoritative', () => {
  assert.equal(CROSS_BORDER_CURRENCY_CONTEXT.persistence, 'none');
  assert.equal(CROSS_BORDER_CURRENCY_CONTEXT.mutation, 'none');
  assert.equal(CROSS_BORDER_CURRENCY_CONTEXT.ownsExchangeRates, false);
  assert.equal(CROSS_BORDER_CURRENCY_CONTEXT.ownsMoneyLedger, false);
});

test('builds same-currency context without FX request', () => {
  const value = buildCurrencyContext({ transactionCurrency: 'ETB' });
  assert.equal(value.transactionCurrency, 'ETB');
  assert.equal(value.settlementCurrency, 'ETB');
  assert.equal(value.fxState, CROSS_BORDER_FX_STATES.NOT_REQUESTED);
  assertCrossBorderCurrencyContext(value);
});

test('resolves country currencies through existing country authority', () => {
  const value = resolveCrossBorderCurrencyContext({ origin: 'ET', destination: 'KE' });
  assert.equal(value.origin.currencyCode, 'ETB');
  assert.equal(value.destination.currencyCode, 'KES');
  assert.equal(value.transactionCurrency, 'ETB');
  assert.equal(value.authoritative, false);
  assertCrossBorderCurrencyContext(value);
});

test('supports explicit settlement and display currency', () => {
  const value = buildCurrencyContext({
    transactionCurrency: 'ETB',
    settlementCurrency: 'KES',
    displayCurrency: 'TZS',
  });
  assert.equal(value.settlementCurrency, 'KES');
  assert.equal(value.displayCurrency, 'TZS');
});

test('observed FX requires a reference', () => {
  assert.throws(() => buildCurrencyContext({
    transactionCurrency: 'ETB',
    settlementCurrency: 'KES',
    fxState: CROSS_BORDER_FX_STATES.OBSERVED,
  }), /fxReference/);
});

test('observed FX accepts a reference without owning the rate', () => {
  const value = buildCurrencyContext({
    transactionCurrency: 'ETB',
    settlementCurrency: 'KES',
    fxState: CROSS_BORDER_FX_STATES.OBSERVED,
    fxReference: { provider: 'example', reference: 'fx-1', observedAt: '2026-09-15T00:00:00Z' },
  });
  assert.equal(value.fxReference.reference, 'fx-1');
  assert.equal(value.ownsExchangeRates, false);
  assertCrossBorderCurrencyContext(value);
});

test('rejects malformed currency code', () => {
  assert.throws(() => buildCurrencyContext({ transactionCurrency: 'ET' }), /ISO-4217/);
});

test('rejects unknown currency metadata', () => {
  assert.throws(() => buildCurrencyContext({ transactionCurrency: 'ZZZ' }), /Unknown currency metadata/);
});

test('rejects same-country cross-border resolution', () => {
  assert.throws(() => resolveCrossBorderCurrencyContext({ origin: 'ET', destination: 'ET' }), /different countries/);
});

test('rejects financial authority claims', () => {
  const value = buildCurrencyContext({ transactionCurrency: 'ETB' });
  assert.throws(() => assertCrossBorderCurrencyContext({ ...value, ownsMoneyLedger: true }), /financial authority/);
});

test('unknown FX cannot be asserted as successful', () => {
  const value = buildCurrencyContext({
    transactionCurrency: 'ETB',
    settlementCurrency: 'KES',
    fxState: CROSS_BORDER_FX_STATES.UNKNOWN,
  });
  assert.throws(() => assertCrossBorderCurrencyContext({ ...value, fxReference: { result: 'success' } }), /Unknown FX state/);
});

console.log(`PHASE20.5 CURRENCY CONTEXT: ${passed} PASS / 0 FAIL`);
