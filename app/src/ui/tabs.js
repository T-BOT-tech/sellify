// ui/tabs.js
// Phase 7 extraction (see modularization plan §5): tab switching, the "More"
// overflow sheet, and the nav-button visibility/badge observer that drives
// it — moved out of main.js unchanged.
import { capitalize } from '../utils/index.js';
import { fetchMarketplaceListings, renderMarketplace } from '../marketplace/listings.js';
import { renderTables } from '../restaurant/tables.js';
import { renderKitchen } from '../restaurant/kitchen.js';
import { renderAccounts } from '../b2b/ui.js';
import { renderCustomers } from '../customers.js';
import { switchWarehouseSubtab, warehouseActiveSubtab } from '../warehouse/ui.js';
import { renderLogistics } from '../logistics/ui.js';
import { renderSourcing, bindSourcingUI } from '../procurement/ui.js';

// ---------- Tabs ----------
export function switchTab(tab) {
  const allTabs = ['home', 'order', 'marketplace', 'queue', 'catalog', 'customers', 'tables', 'kitchen', 'accounts', 'warehouse', 'logistics', 'sourcing'];
  const overflowTabs = ['queue', 'marketplace', 'tables', 'kitchen', 'accounts', 'warehouse', 'logistics', 'sourcing'];
  allTabs.forEach(t => {
    const el = document.getElementById('tab-' + t);
    const nav = document.getElementById('nav' + capitalize(t));
    if (el) el.style.display = (t === tab) ? 'block' : 'none';
    if (nav) nav.classList.toggle('active', t === tab);
  });
  // W5: the tab itself lives inside the More sheet now, so its own nav
  // button can't carry the "active" affordance while the sheet is closed —
  // the fixed More slot does that instead.
  const navMore = document.getElementById('navMore');
  if (navMore) navMore.classList.toggle('active', overflowTabs.includes(tab));
  if (tab === 'marketplace') {
    fetchMarketplaceListings();
    renderMarketplace();
  }
  if (tab === 'tables') renderTables();
  if (tab === 'kitchen') renderKitchen();
  if (tab === 'accounts') renderAccounts();
  if (tab === 'customers') renderCustomers();
  if (tab === 'warehouse') switchWarehouseSubtab(warehouseActiveSubtab);
  if (tab === 'logistics') renderLogistics();
  if (tab === 'sourcing') renderSourcing();
}

// ---------- W5: More sheet (nav overflow) ----------
export function openMoreSheet() {
  document.getElementById('moreSheet').classList.add('open');
}
export function closeMoreSheet() {
  document.getElementById('moreSheet').classList.remove('open');
}
// The 5 relocated buttons keep the exact same show/hide code they always
// had (applyWarehouseUI, applyLogisticsUI, applyBusinessModelUI,
// applyWholesaleUI each just toggle navBtn.style.display). Rather than
// teach four separate functions about the new "More" slot, one observer
// watches those buttons and derives: is More itself visible (any of them
// enabled?), and does More need a presence dot (any enabled one currently
// showing a nonzero badge?).
(function initMoreNavManager() {
  const overflowIds = ['navQueue', 'navMarketplace', 'navTables', 'navKitchen', 'navAccounts', 'navWarehouse', 'navLogistics', 'navSourcing'];
  function recompute() {
    const navMore = document.getElementById('navMore');
    const dot = document.getElementById('navMoreDot');
    if (!navMore) return;
    let anyEnabled = false, anyBadge = false;
    overflowIds.forEach(id => {
      const btn = document.getElementById(id);
      if (!btn || btn.style.display === 'none') return;
      anyEnabled = true;
      const badge = btn.querySelector('.queue-count');
      if (badge && badge.style.display !== 'none' && badge.textContent && badge.textContent !== '0') anyBadge = true;
    });
    navMore.style.display = anyEnabled ? '' : 'none';
    if (dot) dot.style.display = anyBadge ? 'inline-block' : 'none';
  }
  document.addEventListener('DOMContentLoaded', () => {
    bindSourcingUI();
    overflowIds.forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      new MutationObserver(recompute).observe(btn, { attributes: true, attributeFilter: ['style'] });
      const badge = btn.querySelector('.queue-count');
      if (badge) new MutationObserver(recompute).observe(badge, { attributes: true, attributeFilter: ['style'], characterData: true, childList: true, subtree: true });
    });
    recompute();
  });
})();
