// ui/render.js
// Phase 7 extraction (see modularization plan §5): the generic keyed-list
// DOM reconciler and the top-level renderAll() fan-out — moved out of
// main.js unchanged. renderAll() calls into ui/i18n.js and ui/settings.js,
// both of which call back into this module (updateI18n()/renderAll()) —
// circular imports between ui/*.js modules are expected here (same as the
// feature-module <-> main.js pattern from Phases 1–6): every cross-reference
// below is only ever invoked from inside a function body, never at
// module-init time, so the cycle never actually gets walked during import.
import { config, orders, currentStaff } from '../state.js';
import { updateI18n } from './i18n.js';
import { applyBusinessModelUI } from './settings.js';
import { applyRolePermissions } from '../auth/permissions.js';
import { renderProducts } from '../products/render.js';
import { renderCatalog, renderProductFormSelects } from '../products/catalog.js';
import { renderQueue } from '../orders/queue.js';
import { applyWholesaleUI } from '../b2b/ui.js';
import { applyWarehouseUI } from '../warehouse/ui.js';
import { applyLogisticsUI } from '../logistics/ui.js';
import { t } from './i18n.js';
import { renderWorkspace, refreshWorkspaceData } from '../experience/workspace.js';

// Generic keyed-list DOM reconciliation. Patches a container's children
// against a list of items instead of wiping and rebuilding it wholesale.
// Existing nodes are matched by key and updated in place; only genuinely
// new items get a freshly created node, and only items that disappeared
// get removed. This is what lets:
//   - entrance animations fire once per new node, not on every re-render
//   - a periodic tick (e.g. a kitchen ticket's age timer) update just its
//     own node without touching sibling nodes or losing their state
//   - an "optimistic" removal (delete + undo toast) keep its node alive
//     and visually distinct for the undo window instead of vanishing
// createFn(item) returns a new detached element (patchList sets its data-key).
// updateFn(node, item) mutates an existing node in place.
// removeFn(node) defaults to an immediate node.remove(); pass a custom one
// to play an exit animation before the node actually leaves the DOM.
export function patchList(container, items, keyFn, createFn, updateFn, removeFn) {
  if (!container) return;
  removeFn = removeFn || (node => node.remove());

  const existingNodes = new Map();
  Array.from(container.children).forEach(node => {
    if (node.dataset && node.dataset.key) existingNodes.set(node.dataset.key, node);
  });

  const seenKeys = new Set();
  let anchor = null;
  items.forEach(item => {
    const key = String(keyFn(item));
    seenKeys.add(key);
    let node = existingNodes.get(key);
    if (node) {
      updateFn(node, item);
    } else {
      node = createFn(item);
      node.dataset.key = key;
    }
    const nextSibling = anchor ? anchor.nextElementSibling : container.firstElementChild;
    if (node !== nextSibling) container.insertBefore(node, nextSibling);
    anchor = node;
  });

  existingNodes.forEach((node, key) => {
    if (!seenKeys.has(key)) removeFn(node);
  });
}

export function renderAll() {
  updateI18n();
  renderBrand();
  renderStatus();
  renderWorkspace();
  refreshWorkspaceData().catch(() => {});
  renderProducts();
  renderQueue();
  renderCatalog();
  renderProductFormSelects();
  applyBusinessModelUI();
  applyWholesaleUI();
  applyWarehouseUI();
  applyLogisticsUI();
  applyRolePermissions(currentStaff ? currentStaff.role : 'owner');
}

export function renderBrand() {
  document.getElementById('brandName').innerHTML =
    `<small>${t('brandName')}</small>` + (config.sellerName || t('setupBusiness'));
}

export function renderStatus() {
  const pill = document.getElementById('statusPill');
  const text = document.getElementById('statusText');
  const online = navigator.onLine;
  pill.className = 'status-pill ' + (online ? 'online' : 'offline');
  const queuedCount = orders.filter(o => o.status === 'queued').length;
  text.textContent = online
    ? (queuedCount > 0 ? `${t('online')} · ${queuedCount} ${t('toSync')}` : t('online'))
    : (queuedCount > 0 ? `${t('offline')} · ${queuedCount} ${t('queued')}` : t('offline'));

  const badge = document.getElementById('queueBadge');
  if (queuedCount > 0) { badge.style.display = 'inline-block'; badge.textContent = queuedCount; }
  else { badge.style.display = 'none'; }
}
