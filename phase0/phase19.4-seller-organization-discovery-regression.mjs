import assert from 'node:assert/strict';
import { clearDiscoveryProvidersForTests, registerDiscoveryProvider } from '../backend/lib/discovery/provider-registry.js';
import { marketplaceOrganizationDiscoveryProvider } from '../backend/lib/discovery/marketplace-organization-provider.js';
import { getDatabaseForTests, createTenantForUser, getOrCreateUserByTelegram } from '../backend/lib/store-sqlite.js';

clearDiscoveryProvidersForTests();
const registered = registerDiscoveryProvider(marketplaceOrganizationDiscoveryProvider);
assert.equal(registered.providerId, 'commerce.organization');
assert.equal(registered.entityTypes[0], 'seller_organization');
assert.equal(registered.capabilities.includes('organization-discovery'), true);

const x = Date.now().toString(36);
const user = await getOrCreateUserByTelegram(`p194_${x}`, 'Phase 19.4');
const tenant = await createTenantForUser({ userId:user.id, sellerName:`P19.4 Seller ${x}`, businessType:'retail', country:'ET', currency:'ETB', timezone:'Africa/Addis_Ababa' });
const db = getDatabaseForTests();
const organizationId = db.prepare('SELECT organization_id FROM tenants WHERE chat_id=?').get(tenant.chatId).organization_id;
db.prepare(`INSERT INTO catalog_products(chat_id,product_id,product_json,price_minor,stock,marketplace_listed,updated_at,stock_revision,currency) VALUES(?,?,?,?,?,?,?,?,?)`).run(tenant.chatId, `p194_${x}`, JSON.stringify({id:`p194_${x}`,name:'Coffee Beans',category:'Coffee'}), 25000, 12, 1, new Date().toISOString(), 0, 'ETB');
const rows = await marketplaceOrganizationDiscoveryProvider.search({ search:`P19.4 Seller ${x}` });
assert.equal(rows.length, 1);
assert.equal(rows[0].id, organizationId);
const candidate = marketplaceOrganizationDiscoveryProvider.normalize(rows[0]);
assert.equal(candidate.sourceAuthority, 'organizations');
assert.equal(candidate.sourceEntityId, organizationId);
assert.equal(candidate.organizationId, organizationId);
assert.equal(candidate.marketplacePresence.listingCount, 1);
assert.equal(marketplaceOrganizationDiscoveryProvider.evidence(rows[0])[0].type, 'MARKETPLACE_PRESENCE');
assert.equal(marketplaceOrganizationDiscoveryProvider.actions(rows[0]).every(a => a.sourceAuthority === 'commerce'), true);

// An organization without a discoverable Marketplace listing must not leak through seller discovery.
const hiddenUser = await getOrCreateUserByTelegram(`p194_hidden_${x}`, 'Hidden');
const hiddenTenant = await createTenantForUser({ userId:hiddenUser.id, sellerName:`P19.4 Hidden ${x}`, businessType:'retail', country:'ET', currency:'ETB', timezone:'Africa/Addis_Ababa' });
const hiddenRows = await marketplaceOrganizationDiscoveryProvider.search({ search:`P19.4 Hidden ${x}` });
assert.equal(hiddenRows.length, 0);

console.log('Phase 19.4 seller and organization discovery regression: PASS');
