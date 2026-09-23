// restaurant/tables.js
// Phase 6 extraction (see modularization plan §5): the Tables tab (CRUD,
// status cycling, transfer-an-occupied-table flow) and the Order-tab
// table/course pickers — moved out of main.js unchanged.
//
// NOTE on the `../main.js` import below: switchTab, showToast, and t still
// live in main.js (or are re-exported through it) at this phase, and
// renderKitchen lives in restaurant/kitchen.js's sibling module (see that
// file). Importing switchTab/showToast/t back from main.js creates a
// harmless circular import, the same temporary pattern storage/json.js
// established — see that file for the fuller explanation.
import { escapeHtml, escapeAttr, uid } from '../utils/index.js';
import { RESTAURANT_COURSES, STORAGE_KEYS } from '../constants.js';
import { orders, setOrders, currentStaff } from '../state.js';
import { loadJSON, saveJSON } from '../storage/json.js';
import { hasPermission } from '../auth/permissions.js';
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { t } from '../ui/i18n.js';
import { showToast } from '../ui/toast.js';
import { renderKitchen } from './kitchen.js';

// Phase 4 export (see modularization plan §5): orders/checkout.js's
// saveOrder() reads restaurantTables/selectedOrderTableId/selectedOrderCourse
// directly and resets the latter two via their setters once an order is
// saved — that bridge now points here instead of main.js.
export let restaurantTables = loadJSON('ledger_tables', []);
export let selectedOrderTableId = null;
export function setSelectedOrderTableId(next) { selectedOrderTableId = next; }
export let selectedOrderCourse = null;
export function setSelectedOrderCourse(next) { selectedOrderCourse = next; }

export function saveTables() {
  saveJSON('ledger_tables', restaurantTables);
}

export function addTable() {
  openTableModal('add', null);
}

let tableModalEditingId = null;
export function openTableModal(mode, tableId) {
  tableModalEditingId = mode === 'edit' ? tableId : null;
  const table = tableId ? restaurantTables.find(t => t.id === tableId) : null;
  const nextNumber = restaurantTables.length
    ? Math.max(...restaurantTables.map(t => t.number)) + 1
    : 1;
  document.getElementById('tableEditModalTitle').textContent = mode === 'edit' ? `Edit table ${table.number}` : 'Add table';
  document.getElementById('tableEditNumber').value = table ? table.number : nextNumber;
  document.getElementById('tableEditCapacity').value = table && table.capacity ? table.capacity : 4;
  document.getElementById('tableEditNotes').value = table && table.notes ? table.notes : '';
  document.getElementById('tableEditModal').style.display = 'flex';
}
export function closeTableModal() {
  document.getElementById('tableEditModal').style.display = 'none';
  tableModalEditingId = null;
}
export function saveTableModal() {
  // Phase 3 fix (see modularization plan §5, Phase 3): table CRUD had no
  // permission gate at all — any role reaching this function could add,
  // rename, or resize a table. Structural table edits are tables:manage
  // (manager+); day-to-day seat/free/transfer is the separate,
  // lower-barrier tables:status, gated below on cycleTableStatus/confirmTransfer.
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'tables:manage')) return;
  const number = parseInt(document.getElementById('tableEditNumber').value, 10);
  const capacity = parseInt(document.getElementById('tableEditCapacity').value, 10);
  const notes = document.getElementById('tableEditNotes').value.trim();
  if (isNaN(number) || number < 1) {
    showToast('Enter a valid table number.');
    return;
  }
  if (tableModalEditingId) {
    restaurantTables = restaurantTables.map(t => t.id === tableModalEditingId
      ? { ...t, number, capacity: isNaN(capacity) ? undefined : capacity, notes: notes || undefined }
      : t);
  } else {
    restaurantTables.push({
      id: uid(), number, status: 'free',
      capacity: isNaN(capacity) ? undefined : capacity,
      notes: notes || undefined
    });
  }
  saveTables();
  renderTables();
  renderOrderTableSelect();
  closeTableModal();
}
export function editTable(tableId, event) {
  if (event) event.stopPropagation();
  openTableModal('edit', tableId);
}

export function cycleTableStatus(tableId) {
  // Phase 3 fix (see modularization plan §5, Phase 3): seating/freeing a
  // table was previously unguarded. Gated on tables:status rather than
  // tables:manage — this is routine front-of-house work, not a structural
  // edit, so cashier keeps access to it.
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'tables:status')) return;
  const table = restaurantTables.find(t => t.id === tableId);
  if (!table) return;
  table.status = table.status === 'free' ? 'occupied' : 'free';
  saveTables();
  renderTables();
  renderOrderTableSelect();
}

export function removeTable(tableId, event) {
  if (event) event.stopPropagation();
  // Phase 3 fix (see modularization plan §5, Phase 3): structural edit,
  // same gate as saveTableModal.
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'tables:manage')) return;
  restaurantTables = restaurantTables.filter(t => t.id !== tableId);
  saveTables();
  renderTables();
  renderOrderTableSelect();
}

export function renderTables() {
  const list = document.getElementById('tablesList');
  if (!list) return;
  if (restaurantTables.length === 0) {
    list.innerHTML = `<div class="empty">No tables yet. Tap "+ Add table" to create one.</div>`;
    return;
  }
  list.innerHTML = restaurantTables.map(t => `
    <div class="table-card ${t.status}" onclick="cycleTableStatus('${t.id}')">
      <div class="table-number">Table ${t.number}</div>
      <div class="table-status">${t.status}</div>
      ${t.capacity ? `<div class="table-capacity"><svg class="icon icon-sm"><use href="#i-table"/></svg> seats ${t.capacity}</div>` : ''}
      ${t.notes ? `<div class="table-notes" title="${escapeAttr(t.notes)}">${escapeHtml(t.notes)}</div>` : ''}
      <div class="table-actions">
        <button type="button" class="table-edit" onclick="editTable('${t.id}', event)">edit</button>
        ${t.status === 'occupied' ? `<button type="button" class="table-transfer" onclick="transferTable('${t.id}', event)">transfer</button>` : ''}
        <button type="button" class="table-remove" onclick="removeTable('${t.id}', event)">remove</button>
      </div>
    </div>`).join('');
}

// ---------- Restaurant mode: transfer an occupied table's open order(s) to another table ----------
let tableTransferSourceId = null;
export function transferTable(tableId, event) {
  if (event) event.stopPropagation();
  const freeTables = restaurantTables.filter(t => t.id !== tableId && t.status === 'free');
  if (freeTables.length === 0) {
    showToast('No free tables to transfer to.');
    return;
  }
  tableTransferSourceId = tableId;
  const list = document.getElementById('tableTransferList');
  list.innerHTML = freeTables.map(t => `
    <div class="table-card free" style="display:inline-block; width:auto; margin:4px; cursor:pointer;" onclick="confirmTransfer('${t.id}')">
      <div class="table-number">Table ${t.number}</div>
      ${t.capacity ? `<div class="table-capacity"><svg class="icon icon-sm"><use href="#i-table"/></svg> seats ${t.capacity}</div>` : ''}
    </div>`).join('');
  document.getElementById('tableTransferModal').style.display = 'flex';
}
export function closeTableTransferModal() {
  document.getElementById('tableTransferModal').style.display = 'none';
  tableTransferSourceId = null;
}
export function confirmTransfer(destTableId) {
  // Phase 3 fix (see modularization plan §5, Phase 3): moving an occupied
  // table's open orders to another table is a status transition, gated
  // the same as cycleTableStatus.
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'tables:status')) return;
  if (!tableTransferSourceId) return;
  const srcTable = restaurantTables.find(t => t.id === tableTransferSourceId);
  const destTable = restaurantTables.find(t => t.id === destTableId);
  if (!srcTable || !destTable) return;

  let moved = 0;
  setOrders(orders.map(o => {
    if (o.table_id === tableTransferSourceId && o.kitchen_status && o.kitchen_status !== 'served') {
      moved++;
      return { ...o, table_id: destTable.id, table_number: destTable.number };
    }
    return o;
  }));
  saveJSON(STORAGE_KEYS.orders, orders);

  destTable.status = 'occupied';
  srcTable.status = 'free';
  saveTables();

  closeTableTransferModal();
  renderTables();
  renderOrderTableSelect();
  renderKitchen();
  showToast(moved > 0 ? `Moved ${moved} order(s) to Table ${destTable.number}` : `Table ${srcTable.number} freed up.`);
}

export function renderOrderTableSelect() {
  const sel = document.getElementById('orderTableSelect');
  if (!sel) return;
  if (restaurantTables.length === 0) {
    sel.innerHTML = '<option value="">No tables set up yet — add one in the Tables tab</option>';
    selectedOrderTableId = null;
    return;
  }
  sel.innerHTML = '<option value="">No table (takeaway)</option>' +
    restaurantTables.map(t => `<option value="${t.id}" ${t.id === selectedOrderTableId ? 'selected' : ''}>Table ${t.number}</option>`).join('');
  sel.onchange = () => { selectedOrderTableId = sel.value || null; };
}

export function renderOrderCourseSelect() {
  const sel = document.getElementById('orderCourseSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">No course (fire all together)</option>' +
    RESTAURANT_COURSES.map(c => `<option value="${c}" ${c === selectedOrderCourse ? 'selected' : ''}>${c}</option>`).join('');
}
export function onOrderCourseChange(val) {
  selectedOrderCourse = val || null;
}
