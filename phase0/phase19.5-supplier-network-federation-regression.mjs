import assert from 'node:assert/strict';
import { clearDiscoveryProvidersForTests, registerDiscoveryProvider } from '../backend/lib/discovery/provider-registry.js';
import { supplierNetworkDiscoveryProvider } from '../backend/lib/discovery/supplier-network-provider.js';
import { getDatabaseForTests, getOrCreateUserByTelegram, createTenantForUser, setProcurementSupplierParticipation, upsertSupplierNetworkProfile, upsertSupplierNetworkCatalogListing, discoverSupplierNetwork } from '../backend/lib/store-sqlite.js';

clearDiscoveryProvidersForTests();
const registered = registerDiscoveryProvider(supplierNetworkDiscoveryProvider);
assert.equal(registered.providerId, 'supplier-network');
assert.equal(registered.entityTypes[0], 'supplier');
assert.equal(registered.capabilities.includes('supplier-network-federation'), true);

// The provider must require caller context because Phase 18 Supplier Network
// discovery is buyer-tenant scoped and authorization-protected.
await assert.rejects(() => supplierNetworkDiscoveryProvider.search({ search: 'missing-context' }), e => e.code === 'DISCOVERY_PROVIDER_CONTEXT_REQUIRED');

const x = Date.now().toString(36);
const buyerUser = await getOrCreateUserByTelegram(`p195_buyer_${x}`, 'P19.5 Buyer');
const buyer = await createTenantForUser({ userId: buyerUser.id, sellerName: `P19.5 Buyer ${x}`, businessType: 'retail', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa' });
const supplierUser = await getOrCreateUserByTelegram(`p195_supplier_${x}`, 'P19.5 Supplier');
const supplier = await createTenantForUser({ userId: supplierUser.id, sellerName: `P19.5 Supplier ${x}`, businessType: 'retail', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa' });
const db = getDatabaseForTests();
const buyerOrg = db.prepare('SELECT organization_id FROM tenants WHERE chat_id=?').get(buyer.chatId).organization_id;
const supplierOrg = db.prepare('SELECT organization_id FROM tenants WHERE chat_id=?').get(supplier.chatId).organization_id;

// Supplier participation/profile are authoritative Phase 18 structures.
await setProcurementSupplierParticipation(supplier.chatId, { status: 'ACTIVE', discoverable: true }, { userId: supplierUser.id });
await upsertSupplierNetworkProfile(supplier.chatId, { displayName: `P19.5 Supplier ${x}`, description: 'Federated coffee supplier', visibility: 'PUBLIC', status: 'PUBLISHED' }, { userId: supplierUser.id });
const productId = `p195_${x}`;
db.prepare(`INSERT INTO catalog_products(chat_id,product_id,product_json,price_minor,stock,marketplace_listed,updated_at,stock_revision,currency) VALUES(?,?,?,?,?,?,?,?,?)`).run(supplier.chatId, productId, JSON.stringify({ id: productId, name: 'Coffee Beans', category: 'Coffee' }), 25000, 1000, 1, new Date().toISOString(), 0, 'ETB');
await upsertSupplierNetworkCatalogListing(supplier.chatId, { productId, supplierSku: `SKU-${x}`, unit: 'kg', minimumOrderQuantity: 100, indicativePriceMinor: 25000, currency: 'ETB', visibility: 'PUBLIC', status: 'ACTIVE' }, { userId: supplierUser.id });

// Use the existing Phase 18 authority through the new provider.
const rows = await supplierNetworkDiscoveryProvider.search({ chatId: buyer.chatId, actor: { userId: buyerUser.id }, productId });
assert.equal(rows.length, 1);
assert.equal(rows[0].organizationId, supplierOrg);
assert.equal(rows[0].matchScore >= 30, true);
const candidate = supplierNetworkDiscoveryProvider.normalize(rows[0]);
assert.equal(candidate.sourceAuthority, 'supplier_network');
assert.equal(candidate.sourceEntityId, supplierOrg);
assert.equal(candidate.organizationId, supplierOrg);
assert.equal(candidate.entityType, 'supplier');
assert.equal(supplierNetworkDiscoveryProvider.evidence(rows[0])[0].type, 'SUPPLIER_NETWORK_DISCOVERY');
assert.equal(supplierNetworkDiscoveryProvider.actions(rows[0]).some(a => a.sourceAuthority === 'procurement'), true);

// Federation must not mutate the source authority.
const before = db.prepare('SELECT COUNT(*) AS n FROM supplier_network_profiles').get().n;
await supplierNetworkDiscoveryProvider.search({ chatId: buyer.chatId, actor: { userId: buyerUser.id }, search: `P19.5 Supplier ${x}` });
const after = db.prepare('SELECT COUNT(*) AS n FROM supplier_network_profiles').get().n;
assert.equal(after, before);

// Existing Phase 18 discovery remains available and deterministic.
const legacy = await discoverSupplierNetwork(buyer.chatId, { productId }, { userId: buyerUser.id });
assert.equal(legacy.length, 1);
assert.equal(legacy[0].organizationId, supplierOrg);

console.log('Phase 19.5 Supplier Network federation regression: PASS');
