import assert from 'node:assert/strict';
import { clearDiscoveryProvidersForTests, registerDiscoveryProvider } from '../backend/lib/discovery/provider-registry.js';
import { marketplaceProductDiscoveryProvider } from '../backend/lib/discovery/marketplace-product-provider.js';
import { getDatabaseForTests, createTenantForUser, getOrCreateUserByTelegram } from '../backend/lib/store-sqlite.js';

clearDiscoveryProvidersForTests();
const registered = registerDiscoveryProvider(marketplaceProductDiscoveryProvider);
assert.equal(registered.providerId, 'commerce.marketplace');
assert.equal(registered.entityTypes[0], 'marketplace_product');
assert.equal(registered.capabilities.includes('product-discovery'), true);

const x = Date.now().toString(36);
const user = await getOrCreateUserByTelegram(`p193_${x}`, 'Phase 19.3');
const tenant = await createTenantForUser({ userId:user.id, sellerName:`P19.3 Seller ${x}`, businessType:'retail', country:'ET', currency:'ETB', timezone:'Africa/Addis_Ababa' });
const db = getDatabaseForTests();
db.prepare(`INSERT INTO catalog_products(chat_id,product_id,product_json,price_minor,stock,marketplace_listed,updated_at,stock_revision,currency) VALUES(?,?,?,?,?,?,?,?,?)`).run(tenant.chatId, `p193_${x}`, JSON.stringify({id:`p193_${x}`,name:'Coffee Beans',category:'Coffee'}), 25000, 12, 1, new Date().toISOString(), 0, 'ETB');
const rows = await marketplaceProductDiscoveryProvider.search({ object:'coffee' });
assert.ok(rows.some(r => r.item_id === `p193_${x}`));
const candidate = marketplaceProductDiscoveryProvider.normalize(rows.find(r => r.item_id === `p193_${x}`));
assert.equal(candidate.sourceAuthority, 'commerce');
assert.equal(candidate.productReference.productId, `p193_${x}`);
assert.equal(candidate.commercialSignals.currency, 'ETB');
assert.equal(candidate.availability.available, true);
assert.equal(candidate.organizationId, null);
assert.equal(marketplaceProductDiscoveryProvider.evidence(rows[0])[0].type, 'MARKETPLACE_LISTING');
assert.equal(marketplaceProductDiscoveryProvider.actions(rows[0]).every(a => a.sourceAuthority === 'commerce'), true);
console.log('Phase 19.3 cross-marketplace product discovery regression: PASS');
