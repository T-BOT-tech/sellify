// restaurant/kitchen.js
// Phase 6 extraction (see modularization plan §5): the Kitchen tab —
// ticket board rendering/patching, sort modes, status/priority transitions,
// the optimistic "mark served" + undo flow, and the per-ticket age timer —
// moved out of main.js unchanged.
//
// NOTE on the `../main.js` import below: patchList, showUndoToast, and t
// still live in main.js (or are re-exported through it) at this phase.
// Importing them back from main.js creates a harmless circular import, the
// same temporary pattern storage/json.js established — see that file for
// the fuller explanation.
import { RESTAURANT_COURSES, PRIORITY_ORDER, STORAGE_KEYS } from '../constants.js';
import { escapeHtml, formatElapsed } from '../utils/index.js';
import { isRestaurant } from '../config/niche.js';
import { orders, setOrders, currentStaff } from '../state.js';
import { loadJSON, saveJSON } from '../storage/json.js';
import { getOrderById } from '../orders/queue.js';
import { hasPermission } from '../auth/permissions.js';
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { t } from '../ui/i18n.js';
import { patchList } from '../ui/render.js';
import { showUndoToast } from '../ui/toast.js';

let kitchenSortMode = loadJSON('ledger_kitchen_sort', 'priority');
let kitchenTimerInterval = null;

export function updateKitchenBadge() {
  const badge = document.getElementById('kitchenBadge');
  if (!badge) return;
  const openCount = orders.filter(o => o.kitchen_status && o.kitchen_status !== 'served').length;
  if (isRestaurant() && openCount > 0) {
    badge.style.display = 'inline-block';
    badge.textContent = openCount;
  } else {
    badge.style.display = 'none';
  }
}

const COURSE_ORDER_INDEX = RESTAURANT_COURSES.reduce((acc, c, i) => { acc[c] = i; return acc; }, {});

export function setKitchenSort(mode) {
  kitchenSortMode = mode;
  saveJSON('ledger_kitchen_sort', mode);
  renderKitchen();
}

export function renderKitchen() {
  const list = document.getElementById('kitchenList');
  const sortSel = document.getElementById('kitchenSortSelect');
  if (sortSel) sortSel.value = kitchenSortMode;
  if (!list) return;
  // A ticket pending an undo window after "Mark served" stays visible
  // (greyed out via .kitchen-removing) until the window actually expires.
  let kitchenOrders = orders.filter(o => o.kitchen_status && (o.kitchen_status !== 'served' || o._serving));

  if (kitchenSortMode === 'course') {
    kitchenOrders = [...kitchenOrders].sort((a, b) => {
      const ac = COURSE_ORDER_INDEX[a.course] !== undefined ? COURSE_ORDER_INDEX[a.course] : 999;
      const bc = COURSE_ORDER_INDEX[b.course] !== undefined ? COURSE_ORDER_INDEX[b.course] : 999;
      if (ac !== bc) return ac - bc;
      return (a.created_at || 0) - (b.created_at || 0);
    });
  } else if (kitchenSortMode === 'age') {
    kitchenOrders = [...kitchenOrders].sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
  } else {
    kitchenOrders = [...kitchenOrders].sort((a, b) => {
      const ap = PRIORITY_ORDER[a.priority || 'normal'];
      const bp = PRIORITY_ORDER[b.priority || 'normal'];
      if (ap !== bp) return ap - bp;
      return (a.created_at || 0) - (b.created_at || 0);
    });
  }

  if (kitchenOrders.length === 0) {
    list.innerHTML = `<div class="empty">No active kitchen orders.</div>`;
    updateKitchenBadge();
    stopKitchenTimer();
    return;
  }
  if (list.querySelector(':scope > .empty')) list.innerHTML = '';
  patchList(list, kitchenOrders, o => o.id, createKitchenNode, updateKitchenNode, removeKitchenNode);
  updateKitchenBadge();
  startKitchenTimer();
}

// Builds the parts of a kitchen ticket that only change on a real state
// change (status, priority, items). The age timer is deliberately NOT
// built here — see updateKitchenTimer, which runs on its own tick without
// touching this markup, so a ticket can age into its "warn"/"late" color
// on its own without the whole board re-rendering every 15 seconds.
export function kitchenBodyHtml(o) {
  const tableLabel = o.table_number ? `Table ${o.table_number}` : 'Takeaway';
  const itemsText = o.items.map(i => `${i.qty}× ${escapeHtml(i.name)}`).join(', ');
  const priority = o.priority || 'normal';
  const courseBadge = o.course ? `<span class="kitchen-course-badge">${escapeHtml(o.course)}</span>` : '';

  let actionHtml = '';
  let priorityBtns = '';
  if (!o._serving) {
    if (o.kitchen_status === 'pending') {
      actionHtml = `<button onclick="setKitchenStatus('${o.id}', 'preparing')"><svg class="icon icon-sm"><use href="#i-play"/></svg> Start prep</button>`;
    } else if (o.kitchen_status === 'preparing') {
      actionHtml = `<button onclick="setKitchenStatus('${o.id}', 'ready')"><svg class="icon icon-sm"><use href="#i-check"/></svg> Mark ready</button>`;
    } else if (o.kitchen_status === 'ready') {
      actionHtml = `<button onclick="setKitchenStatus('${o.id}', 'served')"><svg class="icon icon-sm"><use href="#i-plate"/></svg> Mark served</button>`;
    }
    priorityBtns = `
      <div class="priority-btns">
        <button class="${priority === 'low' ? 'active low' : ''}" onclick="setKitchenPriority('${o.id}', 'low')" title="Low priority">Low</button>
        <button class="${priority === 'normal' ? 'active normal' : ''}" onclick="setKitchenPriority('${o.id}', 'normal')" title="Normal priority">Normal</button>
        <button class="${priority === 'urgent' ? 'active urgent' : ''}" onclick="setKitchenPriority('${o.id}', 'urgent')" title="Urgent priority"><svg class="icon icon-sm"><use href="#i-flame"/></svg> Urgent</button>
      </div>`;
  }

  return `
    <div class="kitchen-order-head">
      <div class="kitchen-order-head-left"><span>${tableLabel}</span>${courseBadge}</div>
      <span class="kitchen-timer"></span>
    </div>
    <div class="kitchen-order-items">${itemsText}</div>
    <div class="kitchen-order-actions">${actionHtml}${priorityBtns}</div>`;
}

export function kitchenNodeClassName(o) {
  const priority = o.priority || 'normal';
  return `kitchen-order ${o.kitchen_status} priority-${priority}` + (o._serving ? ' kitchen-removing' : '');
}

export function createKitchenNode(o) {
  const div = document.createElement('div');
  div.className = kitchenNodeClassName(o) + ' kitchen-enter';
  div.innerHTML = kitchenBodyHtml(o);
  updateKitchenTimer(div, o);
  requestAnimationFrame(() => div.classList.remove('kitchen-enter'));
  return div;
}

export function updateKitchenNode(node, o) {
  node.className = kitchenNodeClassName(o);
  node.innerHTML = kitchenBodyHtml(o);
  updateKitchenTimer(node, o);
}

export function removeKitchenNode(node) {
  node.classList.add('kitchen-exit');
  setTimeout(() => node.remove(), 220);
}

// Updates just the age timer + its color-escalation class on one ticket's
// node, without touching the rest of its markup. Called on a fast tick
// (see startKitchenTimer) so tickets age into "warn"/"late" on their own.
export function updateKitchenTimer(node, o) {
  const timerEl = node.querySelector('.kitchen-timer');
  if (!timerEl) return;
  const now = Date.now();
  // Prep timer: counts from when prep started; before that, shows time waiting since the order was placed.
  const timerBase = o.kitchen_started_at || o.created_at;
  const elapsedMs = now - (timerBase || now);
  const warnThreshold = o.kitchen_status === 'preparing' ? 10 * 60 * 1000 : 5 * 60 * 1000;
  const lateThreshold = o.kitchen_status === 'preparing' ? 20 * 60 * 1000 : 12 * 60 * 1000;
  const timerClass = elapsedMs > lateThreshold ? 'late' : (elapsedMs > warnThreshold ? 'warn' : 'ok');
  const timerLabel = o.kitchen_status === 'preparing' ? 'prepping' : (o.kitchen_status === 'ready' ? 'waiting pickup' : 'waiting');
  timerEl.className = `kitchen-timer ${timerClass}`;
  timerEl.textContent = `⏱ ${formatElapsed(elapsedMs)} ${timerLabel}`;
}

export function setKitchenStatus(orderId, status) {
  // Phase 3 fix (see modularization plan §5, Phase 3): kitchen ticket
  // transitions had no permission gate. Gated here AND in
  // optimisticMarkServed below (not just here) since a console call could
  // reach optimisticMarkServed directly without going through this
  // function's 'served' branch.
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'kitchen:manage')) return;
  if (status === 'served') {
    optimisticMarkServed(orderId);
    return;
  }
  setOrders(orders.map(o => {
    if (o.id !== orderId) return o;
    const updated = { ...o, kitchen_status: status };
    if (status === 'preparing') updated.kitchen_started_at = Date.now();
    return updated;
  }));
  saveJSON(STORAGE_KEYS.orders, orders);
  renderKitchen();
}

// Optimistic "mark served": the ticket greys out immediately and stays on
// the board so it can be undone, and is only actually moved out of the
// kitchen view after a 5s window with no reply — same pattern as
// deleteOrder(), and for the same reason: a misclick shouldn't need a
// confirm dialog to recover from, just a fast undo.
const pendingKitchenServe = new Map();

export function optimisticMarkServed(orderId) {
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'kitchen:manage')) return;
  const o = getOrderById(orderId);
  if (!o || o._serving) return;
  o._serving = true;
  renderKitchen();

  const timeoutId = setTimeout(() => finalizeServed(orderId), 5000);
  pendingKitchenServe.set(orderId, timeoutId);

  showUndoToast(t('orderServed'), () => undoMarkServed(orderId));
}

export function undoMarkServed(orderId) {
  const timeoutId = pendingKitchenServe.get(orderId);
  if (timeoutId) { clearTimeout(timeoutId); pendingKitchenServe.delete(orderId); }
  const o = getOrderById(orderId);
  if (o) { delete o._serving; renderKitchen(); }
}

export function finalizeServed(orderId) {
  pendingKitchenServe.delete(orderId);
  setOrders(orders.map(o => o.id === orderId ? { ...o, kitchen_status: 'served', _serving: undefined } : o));
  saveJSON(STORAGE_KEYS.orders, orders);
  renderKitchen();
}

export function setKitchenPriority(orderId, priority) {
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'kitchen:manage')) return;
  setOrders(orders.map(o => o.id === orderId ? { ...o, priority } : o));
  saveJSON(STORAGE_KEYS.orders, orders);
  renderKitchen();
}

// Ticks every 15s while the Kitchen tab is visible, patching just each
// ticket's own age timer (updateKitchenTimer) instead of rebuilding the
// whole board — so color escalation doesn't blow away hover state, running
// CSS transitions, or scroll position on every tick.
export function startKitchenTimer() {
  if (kitchenTimerInterval) return;
  kitchenTimerInterval = setInterval(() => {
    const tab = document.getElementById('tab-kitchen');
    if (!tab || tab.style.display !== 'block') { stopKitchenTimer(); return; }
    const list = document.getElementById('kitchenList');
    if (!list) return;
    orders.forEach(o => {
      if (!o.kitchen_status || (o.kitchen_status === 'served' && !o._serving)) return;
      const node = list.querySelector(`[data-key="${CSS.escape(String(o.id))}"]`);
      if (node) updateKitchenTimer(node, o);
    });
  }, 15000);
}
export function stopKitchenTimer() {
  if (kitchenTimerInterval) { clearInterval(kitchenTimerInterval); kitchenTimerInterval = null; }
}
