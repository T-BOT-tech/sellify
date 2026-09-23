import assert from 'node:assert/strict';
import { resolveTradeLane, crossBorderContract } from '../app/src/cross-border-contract.js';

let checks = 0;
const eq = (a,b,m) => { checks += 1; assert.deepEqual(a,b,m); };
const ok = (v,m) => { checks += 1; assert.equal(Boolean(v),true,m); };

const lane = resolveTradeLane({ origin: 'ET', destination: 'KE', provenance: { source: 'phase20.2-test' } });
eq(lane.origin, 'ET', 'origin is canonical country code');
eq(lane.destination, 'KE', 'destination is canonical country code');
eq(lane.capabilities.originCountryPack, 'ET', 'origin country pack composed');
eq(lane.capabilities.destinationCountryPack, 'KE', 'destination country pack composed');
eq(lane.capabilities.originCurrency, 'ETB', 'origin currency comes from country pack');
eq(lane.capabilities.destinationCurrency, 'KES', 'destination currency comes from country pack');
eq(lane.capabilities.crossRegionIntegration, 'country_overlay_plus_existing_core_capability', 'existing cross-region boundary remains canonical');
eq(lane.persistent, false, 'trade lane remains non-persistent');
eq(lane.authoritative, false, 'trade lane remains non-authoritative');
eq(lane.provenance.source, 'phase20.2-test', 'provenance preserved');
ok(Array.isArray(lane.capabilities.originPaymentProviders), 'origin payment provider metadata is derived');
ok(Array.isArray(lane.capabilities.destinationPaymentProviders), 'destination payment provider metadata is derived');

assert.throws(() => resolveTradeLane({ origin: 'ET', destination: 'ET' }), /cross country/i); checks += 1;
assert.throws(() => resolveTradeLane({ origin: 'XX', destination: 'KE' }), /active country|unknown country|country/i); checks += 1;
assert.throws(() => resolveTradeLane({ origin: 'GH', destination: 'KE' }), /active country/i); checks += 1;

eq(crossBorderContract().persistence, 'none', '20.2 preserves persistence-free constitution');
eq(crossBorderContract().mutation, 'none', '20.2 preserves mutation-free constitution');
eq(crossBorderContract().transactionAuthority, 'existing_domain_transaction', 'existing transaction authority remains canonical');

console.log(`PHASE20.2 TRADE LANE: ${checks} PASS / 0 FAIL`);
