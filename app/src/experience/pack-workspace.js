// P1-11 / GAP-6.3 — Unified Pack Workspace / Navigation Composition.
// Composition only: Pack manifests determine product surfaces; canonical Pack
// lifecycle state comes from the server. Navigation visibility is not authorization.
import { currentStaff } from '../state.js';
import { getPackLifecycleSnapshot } from './pack-lifecycle-client.js';
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

function packState(lifecycle) {
  const state = String(lifecycle?.state || '').trim().toUpperCase();
  return state || 'UNKNOWN';
}

export function getPackWorkspaceModel(lifecycles = new Map()) {
  return PACKS.map(pack => {
    const snapshot = lifecycles.get(pack.pack_id) || null;
    const lifecycle = snapshot?.lifecycle || null;
    const entries = pack.ui_entry_points.map(entry => ({
      entry,
      label: label(entry),
      tab: ENTRY_TO_TAB[entry] || null,
    }));
    return Object.freeze({
      packId: pack.pack_id,
      name: pack.name,
      version: pack.version,
      state: packState(lifecycle),
      lifecycle,
      enabled: String(lifecycle?.state || '').toUpperCase() === 'ACTIVE',
      capabilities: Object.freeze([...pack.capabilities]),
      entries: Object.freeze(entries),
      authority: lifecycle ? 'backend/server.js#handlePackLifecycle' : 'backend/server.js#handlePackLifecycle (unavailable)',
    });
  });
}

export function renderPackWorkspace(containerId = 'fux-pack-workspace') {
  const el = document.getElementById(containerId);
  if (!el) return;

  // Render immediately without inventing lifecycle state, then hydrate the
  // same surface from the canonical server lifecycle authority. A failed
  // lifecycle read is UNKNOWN rather than a local configuration-derived state.
  renderPackWorkspaceModel(el, getPackWorkspaceModel());
  Promise.allSettled(PACKS.map(async pack => [pack.pack_id, await getPackLifecycleSnapshot(pack.pack_id)]))
    .then(results => {
      const lifecycles = new Map();
      results.forEach(result => {
        if (result.status === 'fulfilled') lifecycles.set(result.value[0], result.value[1]);
      });
      renderPackWorkspaceModel(el, getPackWorkspaceModel(lifecycles));
    })
    .catch(() => {});
}

function renderPackWorkspaceModel(el, model) {
  el.innerHTML = `
    <section class="fux-workspace-section" aria-labelledby="fux-pack-workspace-title">
      <div class="fux-section-heading">
        <h3 id="fux-pack-workspace-title">Packs &amp; Workspaces</h3>
        <span>Composed from existing Pack contracts</span>
      </div>
      <div class="fux-pack-grid">
        ${model.map(pack => {
          const usableEntries = pack.entries.filter(entry => entry.tab);
          const active = pack.state === 'ACTIVE';
          const installed = ['INSTALLED', 'ACTIVE', 'DEACTIVATED', 'UPGRADE_AVAILABLE', 'UPGRADE_BLOCKED', 'RECOVERY_REQUIRED'].includes(pack.state);
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
            ${!active && installed ? '<div class="hint">Pack is installed but not active; no Pack workspace entry is offered.</div>' : ''}
            ${pack.state === 'UNKNOWN' ? '<div class="hint">Lifecycle state is unavailable; no local configuration is used as a substitute for server truth.</div>' : ''}
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
