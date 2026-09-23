// Phase 19.3 — Cross-Marketplace Product Discovery provider.
// Read-only projection over the existing Marketplace/Product authority.
import { searchMarketplaceListings, getTenant } from '../store-sqlite.js';
import { normalizeDiscoveryMarketContext } from './market-context.js';

function text(value) { return String(value == null ? '' : value).trim().toLowerCase(); }

export const marketplaceProductDiscoveryProvider = Object.freeze({
  providerId: 'commerce.marketplace',
  version: '1.0',
  entityTypes: ['marketplace_product'],
  capabilities: ['product-discovery', 'marketplace-listing'],
  filters: ['search', 'category', 'currency', 'seller'],
  async search(intent = {}) {
    const rows = await searchMarketplaceListings();
    const enriched = await Promise.all(rows.map(async row => {
      const tenant = await getTenant(row.seller_id);
      return { ...row, organization_id: tenant?.organization_id || null, country: tenant?.country || null };
    }));
    const context = normalizeDiscoveryMarketContext(intent);
    const q = text(context.search || context.object || context.category);
    const category = text(context.category);
    const currency = text(context.currency);
    const seller = text(context.seller);
    return enriched.filter(row => {
      if (q && ![row.title, row.category, row.seller_name, row.vendor_code].some(v => text(v).includes(q))) return false;
      if (category && text(row.category) !== category) return false;
      if (currency && text(row.currency) !== currency) return false;
      if (seller && ![row.seller_name, row.seller_id, row.vendor_code].some(v => text(v).includes(seller))) return false;
      if (context.countryCode && text(row.country) !== text(context.countryCode)) return false;
      return true;
    });
  },
  normalize(row) {
    return {
      source: 'commerce.marketplace',
      sourceAuthority: 'commerce',
      sourceEntityId: row.listing_id,
      entityType: 'marketplace_product',
      organizationId: row.organization_id || null,
      productReference: { sellerId: row.seller_id, productId: row.item_id },
      title: row.title,
      seller: { sellerId: row.seller_id, name: row.seller_name, vendorCode: row.vendor_code },
      commercialSignals: { priceMinor: row.price, currency: row.currency },
      availability: { available: Boolean(row.is_available) },
      evidence: [],
      matchFactors: {},
      actions: [],
    };
  },
  evidence(row) {
    return [{ type: 'MARKETPLACE_LISTING', sourceAuthority: 'commerce', sourceEntityId: row.listing_id, observedAt: null, available: Boolean(row.is_available) }];
  },
  actions(row) {
    return [{ action: 'view', method: 'GET', path: '/api/marketplace/search', sourceAuthority: 'commerce', sourceEntityId: row.listing_id }, { action: 'checkout', method: 'POST', path: '/api/marketplace/checkout', sourceAuthority: 'commerce', sourceEntityId: row.listing_id, requires: { sellerId: row.seller_id, productId: row.item_id } }];
  },
});
