import assert from 'node:assert/strict';
import { buildCommercialObservation, buildCrossBorderCommercialContext, crossBorderCommercialContextContract } from '../app/src/cross-border-commercial-context.js';

let pass = 0;
const test = (name, fn) => { fn(); pass += 1; console.log(`PASS ${name}`); };

test('contract is non-persistent', () => assert.equal(crossBorderCommercialContextContract().persistence, 'none'));
test('contract is non-mutating', () => assert.equal(crossBorderCommercialContextContract().mutation, 'none'));
test('pricing remains external authority', () => assert.equal(crossBorderCommercialContextContract().ownsPricing, false));
test('quotes remain external authority', () => assert.equal(crossBorderCommercialContextContract().ownsQuotes, false));
test('PO remains external authority', () => assert.equal(crossBorderCommercialContextContract().ownsPurchaseOrders, false));
test('supplier terms remain external authority', () => assert.equal(crossBorderCommercialContextContract().ownsProcurement, false));
test('valid commercial observation is accepted', () => assert.equal(buildCommercialObservation({ source: 'b2b_quote', currency: 'ETB', unitPriceMinor: 1000, quantity: 5 }).unitPriceMinor, 1000));
test('unknown source fails closed', () => assert.throws(() => buildCommercialObservation({ source: 'global_pricing_engine' }), /Unsupported commercial source/));
test('negative price rejected', () => assert.throws(() => buildCommercialObservation({ source: 'commerce', unitPriceMinor: -1 }), /unitPriceMinor/));
test('zero quantity rejected', () => assert.throws(() => buildCommercialObservation({ source: 'commerce', quantity: 0 }), /quantity/));
test('same-country context rejected', () => assert.throws(() => buildCrossBorderCommercialContext({ origin: 'ET', destination: 'ET' }), /cross country/));
test('observations are normalized', () => assert.equal(buildCrossBorderCommercialContext({ origin: 'ET', destination: 'KE', observations: [{ source: 'supplier_network_commercial', currency: 'KES' }] }).observations.length, 1));
test('references are preserved without copying authority state', () => { const x = buildCrossBorderCommercialContext({ origin: 'ET', destination: 'KE', quoteReference: { id: 'Q1' } }); assert.equal(x.references.quote.id, 'Q1'); });
test('context is immutable', () => { const x = buildCrossBorderCommercialContext({ origin: 'ET', destination: 'KE' }); assert.equal(Object.isFrozen(x), true); });
test('no persistence field', () => assert.equal(buildCrossBorderCommercialContext({ origin: 'ET', destination: 'KE' }).persistent, false));
test('no authority claims accepted', () => assert.throws(() => buildCrossBorderCommercialContext({ origin: 'ET', destination: 'KE', ownsPricing: true }), /cannot declare ownsPricing/));
test('money contract is reused', () => assert.equal(crossBorderCommercialContextContract().calculationAuthority, 'existing_commerce_b2b_money_authorities'));
console.log(`PHASE20.6 CROSS-BORDER COMMERCIAL REGRESSION: ${pass} PASS / 0 FAIL`);
