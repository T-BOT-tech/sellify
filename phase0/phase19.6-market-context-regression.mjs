import assert from 'node:assert/strict';
import { normalizeDiscoveryMarketContext, discoveryMarketContextContract } from '../backend/lib/discovery/market-context.js';

const contract = discoveryMarketContextContract();
assert.equal(contract.version, '1.0');
assert.equal(contract.persistence, 'none');
assert.equal(contract.inventoryAuthority, 'inventory');
assert.equal(contract.pricingAuthority, 'source_domain');
assert.equal(contract.exchangeRateAuthority, 'external_adapter_only');
assert.equal(contract.migrationRequired, false);
assert.equal(contract.fields.includes('countryCode'), true);
assert.equal(contract.fields.includes('currency'), true);
assert.equal(contract.fields.includes('quantity'), true);
assert.equal(contract.fields.includes('commercialMode'), true);

const et = normalizeDiscoveryMarketContext({ q: 'coffee', country: 'ethiopia', quantity: '5000', unit: 'kg', currency: 'etb', commercial_mode: 'wholesale', bulkOrder: 'true', minimum_quantity: '100' });
assert.equal(et.search, 'coffee');
assert.equal(et.countryCode, 'ET');
assert.equal(et.currency, 'ETB');
assert.equal(et.quantity, 5000);
assert.equal(et.unit, 'kg');
assert.equal(et.minimumQuantity, 100);
assert.equal(et.commercialMode, 'WHOLESALE');
assert.equal(et.bulkOrder, true);

const unknownCountry = normalizeDiscoveryMarketContext({ countryCode: 'GH', currency: 'GHS' });
assert.equal(unknownCountry.countryCode, 'GH');
assert.equal(unknownCountry.currency, 'GHS');

const ke = normalizeDiscoveryMarketContext({ countryCode: 'KE' });
assert.equal(ke.countryCode, 'KE');
assert.equal(ke.currency, 'KES');

assert.throws(() => normalizeDiscoveryMarketContext({ countryCode: 'ETH' }), e => e.code === 'DISCOVERY_MARKET_CONTEXT_INVALID');
assert.throws(() => normalizeDiscoveryMarketContext({ currency: 'ET' }), e => e.code === 'DISCOVERY_MARKET_CONTEXT_INVALID');
assert.throws(() => normalizeDiscoveryMarketContext({ quantity: 0 }), e => e.code === 'DISCOVERY_MARKET_CONTEXT_INVALID');
assert.throws(() => normalizeDiscoveryMarketContext({ commercialMode: 'AUCTION' }), e => e.code === 'DISCOVERY_MARKET_CONTEXT_INVALID');

const aliases = normalizeDiscoveryMarketContext({ search: 'coffee', countryCode: 'TZ', currency: 'TZS', wholesale: true, qualification_type: 'CERTIFIED' });
assert.equal(aliases.countryCode, 'TZ');
assert.equal(aliases.currency, 'TZS');
assert.equal(aliases.wholesale, true);
assert.equal(aliases.qualificationType, 'CERTIFIED');

console.log('Phase 19.6 Market Context regression: PASS');
