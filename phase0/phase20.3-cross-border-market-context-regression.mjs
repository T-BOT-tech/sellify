import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCrossBorderMarketContext, crossBorderMarketContextContract } from '../app/src/cross-border-market-context.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let checks = 0;
const eq = (a, b, m) => { checks += 1; assert.deepEqual(a, b, m); };
const ok = (v, m) => { checks += 1; assert.equal(Boolean(v), true, m); };

const contract = crossBorderMarketContextContract();
eq(contract.version, '1.0', 'market context version');
eq(contract.persistence, 'none', 'no persistence');
eq(contract.mutation, 'none', 'no mutation');
eq(contract.sourceAuthority, 'existing_discovery_market_context', 'discovery context remains source');
eq(contract.countryAuthority, 'country_pack_contract', 'country authority remains canonical');
eq(contract.currencyAuthority, 'currency_metadata_contract', 'currency authority remains canonical');
eq(contract.pricingAuthority, 'source_domain', 'pricing authority remains source domain');
eq(contract.exchangeRateAuthority, 'external_adapter_only', 'FX remains adapter boundary');

eq(contract.createsOrder, false, 'no order creation');
eq(contract.mutatesInventory, false, 'no inventory mutation');
eq(contract.mutatesPayment, false, 'no payment mutation');
eq(contract.executesProviders, false, 'no provider execution');

const context = buildCrossBorderMarketContext({
  origin: { countryCode: 'ET', commercialMode: 'B2B', quantity: 100, unit: 'kg' },
  destination: { countryCode: 'KE', commercialMode: 'WHOLESALE' },
  provenance: { source: 'phase20.3-test', reference: 'ctx-1' },
});
eq(context.origin.countryCode, 'ET', 'origin country');
eq(context.destination.countryCode, 'KE', 'destination country');
eq(context.origin.currency, 'ETB', 'origin currency from country pack');
eq(context.destination.currency, 'KES', 'destination currency from country pack');
eq(context.commercialContext.quantity, 100, 'quantity composition');
eq(context.commercialContext.unit, 'kg', 'unit composition');
eq(context.tradeLaneReference.type, 'trade_lane', 'trade lane reference');
eq(context.persistent, false, 'derived context is not persistent');
eq(context.authoritative, false, 'context is not authoritative');
eq(context.mutates, false, 'context does not mutate');

assert.throws(() => buildCrossBorderMarketContext({ origin: { countryCode: 'ET' }, destination: { countryCode: 'ET' } }), /cross-border.*country/i); checks += 1;
assert.throws(() => buildCrossBorderMarketContext({ origin: { countryCode: 'ET' }, destination: { countryCode: 'KE' }, tradeLane: { origin: 'KE', destination: 'TZ' } }), /tradeLane.*match/i); checks += 1;

const source = read('app/src/cross-border-market-context.js');
ok(!/CREATE\s+TABLE|new\s+Database|sqlite|enqueueEvent\s*\(|fetch\s*\(|axios|providerCredentials|secret|tokenStore/i.test(source), '20.3 adds no store, event, provider, or credential execution');

console.log(`PHASE20.3 CROSS-BORDER MARKET CONTEXT: ${checks} PASS / 0 FAIL`);
