// Phase 19.4 — Seller & Organization Discovery provider.
// Read-only projection of canonical Organizations that have discoverable
// Marketplace presence. Organization identity remains authoritative in organizations.
import { getDatabaseForTests } from '../store-sqlite.js';
import { normalizeDiscoveryMarketContext } from './market-context.js';

function text(value) { return String(value == null ? '' : value).trim().toLowerCase(); }

function database() { return getDatabaseForTests(); }

export const marketplaceOrganizationDiscoveryProvider = Object.freeze({
  providerId: 'commerce.organization',
  version: '1.0',
  entityTypes: ['seller_organization'],
  capabilities: ['organization-discovery', 'seller-discovery'],
  filters: ['search', 'country', 'currency'],
  async search(intent = {}) {
    const context = normalizeDiscoveryMarketContext(intent);
    const q = text(context.search || context.object || context.seller);
    const country = text(context.countryCode);
    const currency = text(context.currency);
    const rows = database().prepare(`
      SELECT o.id, o.name, o.country, o.currency, o.timezone,
             COUNT(DISTINCT CASE WHEN p.marketplace_listed = 1 AND (p.stock IS NULL OR p.stock > 0) THEN p.product_id END) AS listing_count,
             MIN(t.chat_id) AS representative_tenant
      FROM organizations o
      JOIN tenants t ON t.organization_id = o.id
      JOIN catalog_products p ON p.chat_id = t.chat_id
      WHERE p.marketplace_listed = 1 AND (p.stock IS NULL OR p.stock > 0)
      GROUP BY o.id, o.name, o.country, o.currency, o.timezone
      ORDER BY o.name COLLATE NOCASE ASC, o.id ASC
    `).all();
    return rows.filter(row => {
      if (q && ![row.name, row.id].some(v => text(v).includes(q))) return false;
      if (country && text(row.country) !== country) return false;
      if (currency && text(row.currency) !== currency) return false;
      return Number(row.listing_count) > 0;
    });
  },
  normalize(row) {
    return {
      source: 'commerce.organization',
      sourceAuthority: 'organizations',
      sourceEntityId: row.id,
      entityType: 'seller_organization',
      organizationId: row.id,
      organization: { id: row.id, name: row.name, country: row.country, currency: row.currency, timezone: row.timezone },
      marketplacePresence: { present: true, listingCount: Number(row.listing_count) },
      evidence: [],
      matchFactors: {},
      actions: [],
    };
  },
  evidence(row) {
    return [{ type: 'MARKETPLACE_PRESENCE', sourceAuthority: 'commerce', sourceEntityId: row.id, observedAt: null, listingCount: Number(row.listing_count) }];
  },
  actions(row) {
    return [{ action: 'view', method: 'GET', path: '/api/marketplace/search', sourceAuthority: 'commerce', sourceEntityId: row.id }];
  },
});
