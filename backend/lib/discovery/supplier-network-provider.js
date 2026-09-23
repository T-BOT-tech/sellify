// Phase 19.5 — Supplier Network Discovery provider.
// Federates the existing Phase 18 Supplier Network discovery authority into
// the Discovery Fabric. It does not create supplier identity or mutate any
// Supplier Network, Procurement, Marketplace, Inventory, or Payment state.
import { discoverSupplierNetwork } from '../store-sqlite.js';
import { normalizeDiscoveryMarketContext } from './market-context.js';

export const supplierNetworkDiscoveryProvider = Object.freeze({
  providerId: 'supplier-network',
  version: '1.0',
  entityTypes: ['supplier'],
  capabilities: ['supplier-discovery', 'supplier-network-federation'],
  filters: ['search', 'productId', 'capabilityCode', 'countryCode', 'geoCode', 'currency', 'minimumQuantity', 'wholesale', 'bulkOrder', 'qualificationType', 'limit'],
  async search(intent = {}) {
    const chatId = String(intent.chatId || '').trim();
    if (!chatId) throw Object.assign(new Error('chatId is required for supplier-network discovery'), { code: 'DISCOVERY_PROVIDER_CONTEXT_REQUIRED', statusCode: 400 });
    const actor = intent.actor || null;
    const context = normalizeDiscoveryMarketContext(intent);
    const input = { ...context };
    input.countryCode = context.countryCode || undefined;
    input.minimumQuantity = context.minimumQuantity;
    input.wholesale = context.wholesale;
    input.bulkOrder = context.bulkOrder;
    input.qualificationType = context.qualificationType;
    delete input.chatId;
    delete input.actor;
    return discoverSupplierNetwork(chatId, input, actor);
  },
  normalize(row) {
    return {
      source: 'supplier-network',
      sourceAuthority: 'supplier_network',
      sourceEntityId: row.organizationId,
      entityType: 'supplier',
      organizationId: row.organizationId,
      organization: { id: row.organizationId, name: row.organizationName },
      profile: row.profile,
      availability: {
        catalogCount: Array.isArray(row.catalog) ? row.catalog.length : 0,
        capacitySignalCount: Array.isArray(row.capacitySignals) ? row.capacitySignals.length : 0,
      },
      commercialSignals: {
        commercialTermCount: Array.isArray(row.commercialTerms) ? row.commercialTerms.length : 0,
      },
      qualificationEvidence: Array.isArray(row.qualifications) ? row.qualifications : [],
      trustEvidence: Array.isArray(row.trustEvidence) ? row.trustEvidence : [],
      matchFactors: {
        score: Number(row.matchScore || 0),
        reasons: Array.isArray(row.matchReasons) ? row.matchReasons : [],
      },
      evidence: [],
      actions: [],
    };
  },
  evidence(row) {
    return [
      {
        type: 'SUPPLIER_NETWORK_DISCOVERY',
        sourceAuthority: 'supplier_network',
        sourceEntityId: row.organizationId,
        observedAt: null,
        matchScore: Number(row.matchScore || 0),
        relationshipActive: Boolean(row.relationshipActive),
      },
      ...(Array.isArray(row.qualifications) ? row.qualifications.slice(0, 20).map(q => ({
        type: 'QUALIFICATION',
        sourceAuthority: 'supplier_network',
        sourceEntityId: q.id,
        observedAt: q.verifiedAt || null,
        qualificationType: q.qualificationType,
        status: q.status,
      })) : []),
    ];
  },
  actions(row) {
    return [
      {
        action: 'view-supplier-network',
        method: 'GET',
        path: '/tenants/:chatId/supplier-network/discovery',
        sourceAuthority: 'supplier_network',
        sourceEntityId: row.organizationId,
      },
      {
        action: 'request-quote',
        method: 'POST',
        path: '/tenants/:chatId/procurement/rfqs',
        sourceAuthority: 'procurement',
        sourceEntityId: row.organizationId,
        requires: { supplierOrganizationId: row.organizationId },
      },
    ];
  },
});
