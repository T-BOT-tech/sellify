// FUX-11: first productized Workspace layer.
// This is deliberately a composition surface over existing canonical modules;
// it owns no supplier, procurement, order, or inventory state.
import { config, currentStaff, orders, products } from '../state.js';
import { UI_STATES } from './state-contract.js';
import { statusClass } from '../design-system/index.js';
import { t } from '../ui/i18n.js';
import { hasPermission } from '../auth/permissions.js';
import { renderPackWorkspace } from './pack-workspace.js';
import { getLowStockProducts, getOutOfStockProducts } from '../warehouse/inventory.js';
import { getInventoryBalanceRefreshState, loadInventoryBalances } from '../warehouse/ledger.js';

let inventoryRefreshScope = '';
let inventoryRefreshInFlight = null;

function startInventoryRefresh({ force = false } = {}) {
  if (!config.chatId || !config.sessionToken) return null;
  const locationId = config.locationId || '';
  const scope = [config.chatId, locationId].join('::');
  if (inventoryRefreshInFlight && inventoryRefreshScope === scope) return inventoryRefreshInFlight;
  if (!force && inventoryRefreshScope === scope) return null;

  inventoryRefreshScope = scope;
  const task = loadInventoryBalances({ locationId })
    .catch(() => null)
    .finally(() => {
      if (inventoryRefreshInFlight === task) {
        inventoryRefreshInFlight = null;
        renderWorkspace();
      }
    });
  inventoryRefreshInFlight = task;
  return task;
}

export function refreshWorkspaceInventory() {
  return startInventoryRefresh({ force: true });
}

function inventoryRefreshMessage(refresh) {
  const time = refresh.refreshedAt ? new Date(refresh.refreshedAt).toLocaleTimeString() : null;
  if (refresh.status === 'REFRESHING') return 'Refreshing balances from the server…';
  if (refresh.status === 'FRESH') return 'Last successful client refresh: ' + (time || 'just now') + '. Server freshness metadata is not supplied.';
  if (refresh.status === 'CACHED') return 'Refresh unavailable; saved projection only' + (time ? ' · last successful refresh ' + time : '') + '.';
  if (refresh.status === 'OFFLINE') return 'Offline; no successful refresh for this business and location in this session.';
  if (refresh.status === 'PERMISSION_DENIED') return 'Inventory refresh denied; freshness is unknown. Check your access.';
  return config.sessionToken ? 'Freshness unknown; saved projection only.' : 'Sign in to refresh inventory. Saved projection only.';
}

function connectivityState() {
  return navigator.onLine ? 'ONLINE' : UI_STATES.OFFLINE;
}

function roleLabel(role) {
  return String(role || 'staff').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function currentRole() {
  return String(currentStaff?.role || 'staff').toLowerCase();
}

export function renderWorkspace() {
  const root = document.getElementById('sellerHome');
  if (!root) return;

  startInventoryRefresh();
  const queued = orders.filter(order => order.status === 'queued').length;
  // Use Sellify's existing inventory projection and reorder-point rules rather
  // than inventing a fixed threshold in the Home workspace. These are saved
  // projections; this surface does not claim that they were freshly verified.
  const lowStock = getLowStockProducts().length;
  const outOfStock = getOutOfStockProducts().length;
  const inventoryAttention = lowStock + outOfStock;
  const inventoryRefresh = getInventoryBalanceRefreshState({ locationId: config.locationId || '' });
  const refreshMessage = inventoryRefreshMessage(inventoryRefresh);
  const state = connectivityState();
  const business = config.sellerName || t('setupBusiness');
  const role = roleLabel(currentRole());

  root.innerHTML = `
    <section class="fux-workspace" aria-labelledby="fux-workspace-title">
      <header class="fux-workspace-header">
        <div>
          <div class="fux-eyebrow">SELLIFY WORKSPACE</div>
          <h2 id="fux-workspace-title">${business}</h2>
          <p class="fux-context">${role} · ${state === UI_STATES.SUCCESS ? 'Online' : 'Offline'}</p>
        </div>
        <span class="${statusClass(state === 'ONLINE' ? 'success' : 'warning')}" data-state="${state}">
          ${state === 'ONLINE' ? 'Online' : 'Offline'}
        </span>
      </header>

      <section class="fux-workspace-section" aria-labelledby="fux-attention-title">
        <div class="fux-section-heading">
          <h3 id="fux-attention-title">Attention</h3>
          <span>${queued + inventoryAttention} items</span>
        </div>
        <div class="fux-card-grid">
          <button class="fux-work-card ${queued ? 'has-attention' : ''}" type="button" onclick="switchTab('queue')">
            <span class="fux-card-label">Orders & sync</span>
            <strong>${queued ? `${queued} waiting` : 'All synced'}</strong>
            <small>${queued ? 'Review queued work' : 'No queued orders'}</small>
          </button>
          <button class="fux-work-card ${inventoryAttention ? 'has-attention' : ''}" type="button" onclick="switchTab('catalog')">
            <span class="fux-card-label">Inventory health</span>
            <strong>${inventoryAttention ? `${inventoryAttention} to review` : 'No saved exceptions'}</strong>
            <small>${lowStock} below reorder point · ${outOfStock} out of stock. ${refreshMessage}</small>
          </button>
          ${config.chatId && config.sessionToken ? '<button class="fux-action" type="button" data-action="refresh-inventory">Refresh inventory</button>' : ''}
        </div>
      </section>

      <section class="fux-workspace-section" aria-labelledby="fux-actions-title">
        <div class="fux-section-heading">
          <h3 id="fux-actions-title">Next actions</h3>
        </div>
        <div class="fux-action-list">
          <button class="fux-action primary" type="button" onclick="switchTab('order')">
            <strong>Take an order</strong><small>Start a new sale</small>
          </button>
          <button class="fux-action" type="button" onclick="switchTab('catalog')">
            <strong>Manage catalog</strong><small>${products.length} products</small>
          </button>
          <button class="fux-action" type="button" onclick="switchTab('queue')">
            <strong>Review work</strong><small>Orders and synchronization</small>
          </button>
        </div>
      </section>

      <section class="fux-workspace-section" aria-labelledby="fux-network-title">
        <div class="fux-section-heading">
          <h3 id="fux-network-title">Supplier Network & Procurement</h3>
          <span>Existing canonical workflows</span>
        </div>
        <div id="fux-supply-intelligence-summary" class="fux-procurement-summary" data-state="${UI_STATES.LOADING}">
          <div class="fux-summary-state">Loading supplier discovery and supply intelligence…</div>
        </div>
        <div id="fux-procurement-summary" class="fux-procurement-summary" data-state="${UI_STATES.LOADING}">
          <div class="fux-summary-state">Loading sourcing and procurement activity…</div>
        </div>
        <div class="fux-action-list">
          ${hasPermission(role, 'supplier-network:discovery:discover') || hasPermission(role, 'procurement:demand:view') ? `
          <button class="fux-action primary" type="button" onclick="switchTab('sourcing')">
            <strong>Open sourcing workspace</strong><small>Supplier discovery → demand → RFQ → award → PO → receiving</small>
          </button>` : ''}
        </div>
      </section>
      <div id="fux-pack-workspace"></div>
    </section>`;
  renderPackWorkspace();
  root.querySelector('[data-action="refresh-inventory"]')?.addEventListener('click', () => {
    refreshWorkspaceInventory();
  });
}


async function loadSupplyIntelligenceSummary() {
  const summary = document.getElementById('fux-supply-intelligence-summary');
  if (!summary) return;
  const role = currentRole();
  if (!hasPermission(role, 'supplier-network:discovery:discover')) {
    summary.dataset.state = UI_STATES.UNKNOWN;
    summary.innerHTML = '<div class="fux-summary-state">Supplier discovery is not available for this role.</div>';
    return;
  }
  if (!config.chatId || !config.sessionToken || !navigator.onLine) {
    summary.dataset.state = !navigator.onLine ? UI_STATES.OFFLINE : UI_STATES.UNKNOWN;
    summary.innerHTML = `<div class="fux-summary-state">${!navigator.onLine ? 'Offline — supplier discovery is not refreshed from the server.' : 'Sign in to load supplier discovery activity.'}</div>`;
    return;
  }
  const base = (config.syncUrl || window.location.origin).replace(/\/$/, '');
  const headers = { ...(config.sessionToken ? { Authorization: `Bearer ${config.sessionToken}` } : {}) };
  try {
    const response = await fetch(`${base}/api/discovery?chatId=${encodeURIComponent(config.chatId)}&providers=supplier-network&limit=25`, { headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || `Request failed (${response.status})`);
    const candidates = Array.isArray(body.candidates) ? body.candidates : [];
    const opportunities = Array.isArray(body.opportunities) ? body.opportunities : [];
    const eligible = opportunities.filter(item => ['ELIGIBLE', 'MATCH'].includes(String(item?.status || '').toUpperCase())).length;
    const scores = candidates.map(item => Number(item?.score ?? item?.match?.matchScore)).filter(Number.isFinite);
    const highest = scores.length ? Math.max(...scores) : null;
    summary.dataset.state = UI_STATES.SUCCESS;
    summary.innerHTML = `
      <div class="fux-summary-grid">
        <div><strong>${candidates.length}</strong><span>supplier candidates</span></div>
        <div><strong>${opportunities.length}</strong><span>derived opportunities</span></div>
        <div><strong>${eligible}</strong><span>eligible opportunities</span></div>
      </div>
      <small class="fux-summary-note">Discovery and supply intelligence are read-only projections. Matching is deterministic; source evidence remains authoritative in Supplier Network/Discovery, and owning domains execute actions.</small>
      ${highest != null ? `<small class="fux-summary-note">Highest observed discovery match: ${highest}</small>` : ''}`;
  } catch (error) {
    summary.dataset.state = UI_STATES.FAILURE;
    summary.innerHTML = '<div class="fux-summary-state">Could not refresh supplier intelligence. Open the sourcing workspace to retry safely.</div>';
  }
}

async function loadProcurementWorkspaceSummary() {
  const summary = document.getElementById('fux-procurement-summary');
  if (!summary) return;
  const role = currentRole();
  if (!config.chatId || !config.sessionToken || !navigator.onLine) {
    summary.dataset.state = !navigator.onLine ? UI_STATES.OFFLINE : UI_STATES.UNKNOWN;
    summary.innerHTML = `<div class="fux-summary-state">${!navigator.onLine ? 'Offline — sourcing activity is not refreshed from the server.' : 'Sign in to load sourcing and procurement activity.'}</div>`;
    return;
  }
  const base = (config.syncUrl || window.location.origin).replace(/\/$/, '');
  const headers = { ...(config.sessionToken ? { Authorization: `Bearer ${config.sessionToken}` } : {}) };
  const get = async path => {
    const res = await fetch(`${base}${path}`, { headers });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error?.message || `Request failed (${res.status})`);
    return body;
  };
  try {
    const tenant = encodeURIComponent(config.chatId);
    const requests = [];
    if (hasPermission(role, 'procurement:demand:view')) requests.push(get(`/tenants/${tenant}/procurement/demands?limit=100`).then(x => ({ key: 'demands', rows: x.demands || [] })));
    if (hasPermission(role, 'procurement:rfq:view')) requests.push(get(`/tenants/${tenant}/procurement/rfqs?limit=100`).then(x => ({ key: 'rfqs', rows: x.rfqs || [] })));
    if (hasPermission(role, 'b2b:po:view')) requests.push(get(`/tenants/${tenant}/b2b/purchase-orders?limit=100`).then(x => ({ key: 'pos', rows: (x.purchaseOrders || []).filter(po => String(po.sourceType || po.source_type || '').toUpperCase() === 'PROCUREMENT_AWARD') })));
    const results = await Promise.all(requests);
    const byKey = Object.fromEntries(results.map(x => [x.key, x.rows]));
    const demands = byKey.demands || [];
    const rfqs = byKey.rfqs || [];
    const pos = byKey.pos || [];
    const activeDemands = demands.filter(d => !['CANCELLED','FULFILLED','CLOSED'].includes(String(d.status || '').toUpperCase())).length;
    const activeRfqs = rfqs.filter(r => !['CANCELLED','CLOSED'].includes(String(r.status || '').toUpperCase())).length;
    const pendingPos = pos.filter(po => ['DRAFT','SUBMITTED'].includes(String(po.status || '').toUpperCase())).length;
    summary.dataset.state = UI_STATES.SUCCESS;
    summary.innerHTML = `
      <div class="fux-summary-grid">
        <div><strong>${activeDemands}</strong><span>active demands</span></div>
        <div><strong>${activeRfqs}</strong><span>open RFQs</span></div>
        <div><strong>${pendingPos}</strong><span>pending POs</span></div>
      </div>
      <small class="fux-summary-note">Read from existing Procurement/B2B authorities. Workspace is a view and entry point, not a transaction authority.</small>`;
  } catch (error) {
    summary.dataset.state = UI_STATES.FAILURE;
    summary.innerHTML = `<div class="fux-summary-state">Could not refresh sourcing activity. Open the sourcing workspace to retry safely.</div>`;
  }
}

// The workspace is a composition surface; refresh its canonical summary after the
// synchronous shell is rendered. No local procurement state is persisted here.
export function refreshWorkspaceData() {
  return Promise.all([loadSupplyIntelligenceSummary(), loadProcurementWorkspaceSummary()]);
}
