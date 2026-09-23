// P1-12 — Pack Capability → Journey Composition.
// Read-only composition contract. It maps declared Pack capabilities and UI
// entry points onto existing product journeys; it does not create workflow,
// authorization, persistence, or business-domain authority.
import { config } from '../state.js';
import { getVerticalPackConfiguration } from '../verticals/configuration.js';
import { AGRICULTURE_PACK } from '../verticals/agriculture/pack.js';
import { RESTAURANT_PACK } from '../verticals/restaurant/pack.js';
import { WAREHOUSE_PACK } from '../verticals/warehouse/pack.js';
import { LOGISTICS_PACK } from '../verticals/logistics/pack.js';

export const PACK_JOURNEY_COMPOSITION = Object.freeze({
  agriculture: Object.freeze({
    journeys: Object.freeze([
      { id: 'agriculture-foundation', label: 'Agriculture foundation', status: 'DECLARATIVE_ONLY', entry: null },
    ]),
    capabilityJourneys: Object.freeze({
      'farm-management': 'agriculture-foundation',
      'plot-management': 'agriculture-foundation',
      'season-management': 'agriculture-foundation',
      'crop-management': 'agriculture-foundation',
      'harvest-management': 'agriculture-foundation',
      'commodity-management': 'agriculture-foundation',
      'collection-center-management': 'agriculture-foundation',
      'buyer-management': 'agriculture-foundation',
    }),
  }),
  restaurant: Object.freeze({
    journeys: Object.freeze([
      { id: 'restaurant-floor', label: 'Restaurant floor', status: 'COMPOSED', entry: 'tables' },
      { id: 'restaurant-kitchen', label: 'Kitchen operations', status: 'COMPOSED', entry: 'kitchen' },
    ]),
    capabilityJourneys: Object.freeze({
      'table-management': 'restaurant-floor',
      'kitchen-management': 'restaurant-kitchen',
      'restaurant-order-context': 'restaurant-floor',
    }),
  }),
  warehouse: Object.freeze({
    journeys: Object.freeze([
      { id: 'warehouse-operations', label: 'Warehouse operations', status: 'COMPOSED', entry: 'warehouse' },
    ]),
    capabilityJourneys: Object.freeze({
      'warehouse-inventory': 'warehouse-operations',
      'warehouse-receiving': 'warehouse-operations',
      'warehouse-storage': 'warehouse-operations',
      'warehouse-transactions': 'warehouse-operations',
      'warehouse-location-context': 'warehouse-operations',
      'warehouse-stock-adjustment': 'warehouse-operations',
    }),
  }),
  logistics: Object.freeze({
    journeys: Object.freeze([
      { id: 'logistics-fulfillment', label: 'Fulfillment & delivery', status: 'COMPOSED', entry: 'logistics' },
    ]),
    capabilityJourneys: Object.freeze({
      'logistics-fulfillment': 'logistics-fulfillment',
      'logistics-shipment': 'logistics-fulfillment',
      'logistics-delivery': 'logistics-fulfillment',
      'logistics-proof': 'logistics-fulfillment',
      'logistics-returns': 'logistics-fulfillment',
      'logistics-routes': 'logistics-fulfillment',
      'logistics-courier': 'logistics-fulfillment',
    }),
  }),
});

const PACKS = Object.freeze([AGRICULTURE_PACK, RESTAURANT_PACK, WAREHOUSE_PACK, LOGISTICS_PACK]);

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function getComposition(packId) {
  return PACK_JOURNEY_COMPOSITION[packId] || { journeys: [], capabilityJourneys: {} };
}

export function getPackJourneyCompositionModel() {
  return PACKS.map(pack => {
    const resolved = getVerticalPackConfiguration({
      packId: pack.pack_id,
      config,
      organizationId: config.organizationId || null,
      locationId: config.locationId || null,
    });
    const composition = getComposition(pack.pack_id);
    const journeys = composition.journeys.map(journey => ({
      ...journey,
      capabilities: pack.capabilities.filter(capability => composition.capabilityJourneys[capability] === journey.id),
      declaredEntry: journey.entry,
      entryDeclaredByPack: journey.entry ? pack.ui_entry_points.includes(journey.entry) : false,
    }));
    return Object.freeze({
      packId: pack.pack_id,
      name: pack.name,
      version: pack.version,
      enabled: resolved.enabled,
      configurationAuthority: resolved.authority,
      journeys: Object.freeze(journeys),
    });
  });
}

export function renderPackJourneyComposition(containerId = 'fux-pack-journey-composition') {
  const el = document.getElementById(containerId);
  if (!el) return;
  const model = getPackJourneyCompositionModel();
  el.innerHTML = `
    <section class="fux-workspace-section" aria-labelledby="fux-pack-journey-title">
      <div class="fux-section-heading">
        <h3 id="fux-pack-journey-title">Pack capabilities → journeys</h3>
        <span>Existing journey composition</span>
      </div>
      <div class="fux-pack-grid">
        ${model.map(pack => `<article class="fux-pack-card" data-pack-journey-pack="${esc(pack.packId)}">
          <div class="fux-pack-card-header">
            <div><strong>${esc(pack.name)}</strong><small>${esc(pack.packId)} · v${esc(pack.version)}</small></div>
            <span class="status-badge">${pack.enabled === null ? 'DECLARATIVE' : (pack.enabled ? 'CONFIGURED' : 'INACTIVE')}</span>
          </div>
          ${pack.journeys.map(journey => `<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--line);">
            <div><strong>${esc(journey.label)}</strong> <span class="status-badge">${esc(journey.status)}</span></div>
            <div class="hint">Journey entry: ${journey.declaredEntry ? esc(journey.declaredEntry) : 'none declared'}</div>
            <div class="hint">Capabilities: ${journey.capabilities.map(esc).join(', ') || '—'}</div>
            ${journey.declaredEntry && journey.entryDeclaredByPack ? `<button class="fux-action" type="button" data-journey-tab="${esc(journey.declaredEntry)}"><strong>Open journey surface</strong><small>Existing workspace entry</small></button>` : '<div class="hint">No executable journey entry is declared by the current Pack contract.</div>'}
          </div>`).join('')}
        </article>`).join('')}
      </div>
      <div class="hint" style="margin-top:10px;"><strong>Boundary:</strong> this maps Pack capabilities to existing journey surfaces. It does not create transactions, grant authorization, or replace canonical domain workflows. Server authorization remains authoritative.</div>
    </section>`;

  el.querySelectorAll('[data-journey-tab]').forEach(button => {
    button.addEventListener('click', async () => {
      const { switchTab } = await import('../ui/tabs.js');
      switchTab(button.dataset.journeyTab);
    });
  });
}
