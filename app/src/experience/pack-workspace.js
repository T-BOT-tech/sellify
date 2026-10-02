// P1-11 — Unified Pack Workspace / Navigation Composition.
// Composition only: Pack manifests + existing configuration determine which
// product surfaces are offered. Navigation visibility is not authorization.
import { config, currentStaff } from '../state.js';
import { getVerticalPackConfiguration } from '../verticals/configuration.js';
import { AGRICULTURE_PACK } from '../verticals/agriculture/pack.js';
import { RESTAURANT_PACK } from '../verticals/restaurant/pack.js';
import { WAREHOUSE_PACK } from '../verticals/warehouse/pack.js';
import { LOGISTICS_PACK } from '../verticals/logistics/pack.js';
import { renderPackJourneyComposition } from './pack-journey-composition.js';
import { getLogisticsWorkspaceComposition } from '../verticals/logistics/workspace-contract.js';

const PACKS = Object.freeze([AGRICULTURE_PACK, RESTAURANT_PACK, WAREHOUSE_PACK, LOGISTICS_PACK]);
const ENTRY_TO_TAB = Object.freeze({
  tables: 'tables',
  kitchen: 'kitchen',
  inventory: 'warehouse',
  receiving: 'warehouse',
  transactions: 'warehouse',
  locations: 'warehouse',
  logistics: 'logistics',
});

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function label(value) {
  return String(value || '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function packState(pack, resolved) {
  if (resolved.enabled === null) return 'DECLARATIVE';
  return resolved.enabled ? 'ACTIVE_BY_EXISTING_CONFIG' : 'INACTIVE_BY_EXISTING_CONFIG';
}

export function getPackWorkspaceModel() {
  return PACKS.map(pack => {
    const resolved = getVerticalPackConfiguration({
      packId: pack.pack_id,
      config,
      organizationId: config.organizationId || null,
      locationId: config.locationId || null,
    });
    const entries = pack.ui_entry_points.map(entry => ({
      entry,
      label: label(entry),
      tab: ENTRY_TO_TAB[entry] || null,
    }));
    return Object.freeze({
      packId: pack.pack_id,
      name: pack.name,
      version: pack.version,
      state: packState(pack, resolved),
      enabled: resolved.enabled,
      capabilities: Object.freeze([...pack.capabilities]),
      entries: Object.freeze(entries),
      authority: resolved.authority,
    });
  });
}

export function renderPackWorkspace(containerId = 'fux-pack-workspace') {
  const el = document.getElementById(containerId);
  if (!el) return;
  const model = getPackWorkspaceModel();

  el.innerHTML = `
    <section class="fux-workspace-section" aria-labelledby="fux-pack-workspace-title">
      <div class="fux-section-heading">
        <h3 id="fux-pack-workspace-title">Packs &amp; Workspaces</h3>
        <span>Composed from existing Pack contracts</span>
      </div>
      <div class="fux-pack-grid">
        ${model.map(pack => {
          const usableEntries = pack.entries.filter(entry => entry.tab);
          const active = pack.enabled === true;
          const declarative = pack.enabled === null;
          return `<article class="fux-pack-card" data-pack-id="${esc(pack.packId)}">
            <div class="fux-pack-card-header">
              <div><strong>${esc(pack.name)}</strong><small>${esc(pack.packId)} · v${esc(pack.version)}</small></div>
              <span class="status-badge">${esc(pack.state)}</span>
            </div>
            <div class="hint">${pack.capabilities.slice(0, 4).map(esc).join(' · ') || 'No declared capabilities'}</div>
            ${active && usableEntries.length ? `<div class="fux-pack-actions">${usableEntries.map(entry => `<button class="fux-action" type="button" data-pack-tab="${esc(entry.tab)}"><strong>${esc(entry.label)}</strong><small>Open existing workspace</small></button>`).join('')}</div>` : ''}
            ${active && pack.pack_id === 'logistics' ? (() => {
              const composition = getLogisticsWorkspaceComposition(currentStaff?.role || 'staff');
              const labels = composition.views.map(view => esc(view.label)).join(' · ');
              return '<div class="hint">Role workspace composition: ' + (labels || 'No Logistics Pack role workspace declared for this role.') + '</div>';
            })() : ''}
            ${declarative ? '<div class="hint">This Pack is declarative in the current source; no executable Pack activation state is claimed.</div>' : ''}
            ${!active && !declarative ? '<div class="hint">No Pack workspace entry is offered because the existing configuration is inactive.</div>' : ''}
          </article>`;
        }).join('')}
      </div>
      <div id="fux-pack-journey-composition"></div>
      <div class="hint" style="margin-top:10px;"><strong>Boundary:</strong> this surface composes Pack navigation only. It does not grant permissions. Canonical server authorization remains authoritative when an action is attempted.</div>
    </section>`;

  renderPackJourneyComposition();

  el.querySelectorAll('[data-pack-tab]').forEach(button => {
    button.addEventListener('click', async () => {
      const { switchTab } = await import('../ui/tabs.js');
      switchTab(button.dataset.packTab);
    });
  });
}
