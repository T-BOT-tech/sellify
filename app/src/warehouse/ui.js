// warehouse/ui.js
// Phase 10.6: canonical Organization → Location selection is now distinct
// from legacy warehouse storage bins. Stock movements carry the canonical
// location id while existing bin/location text remains a compatibility UI.
// Phase 6 extraction (see modularization plan §5): the Warehouse tab's four
// sub-tabs (inventory, receiving, locations, transactions) and the
// adjust-stock / receive-stock modals — moved out of main.js unchanged.
//
// NOTE on the `../main.js` import below: switchTab and t still live in
// main.js (or are re-exported through it) at this phase. Importing them
// back from main.js creates a harmless circular import, the same temporary
// pattern storage/json.js established — see that file for the fuller
// explanation.
import { escapeHtml, escapeAttr } from '../utils/index.js';
import { products, warehouseLocations, stockTransactions, organizationLocations, config } from '../state.js';
import {
  isWarehouseEnabled, isStockTracked, getLowStockProducts, getOutOfStockProducts
} from './inventory.js';
import { loadInventoryBalances, getInventoryBalance, recordCanonicalInventoryMovement } from './ledger.js';
import { loadOrganizationLocations, selectOrganizationLocation } from './locations.js';
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { t } from '../ui/i18n.js';
import { switchTab } from '../ui/tabs.js';
import { showToast } from '../ui/toast.js';
import { renderProcurementReceiving, bindProcurementReceivingEvents } from './procurement-receiving.js';

// Exported as a live binding: switchTab() (main.js) re-invokes
// switchWarehouseSubtab() with whatever subtab was last active whenever the
// user navigates back to the Warehouse tab, so it needs to read the current
// value from outside this module (Rule 1's live-binding pattern, applied at
// feature scope — see modularization plan §1).
export let warehouseActiveSubtab = 'inventory';

export function applyWarehouseUI() {
  const enabled = isWarehouseEnabled();
  const navBtn = document.getElementById('navWarehouse');
  if (navBtn) navBtn.style.display = enabled ? '' : 'none';

  const activeWarehouse = document.getElementById('tab-warehouse');
  if (!enabled && activeWarehouse && activeWarehouse.style.display === 'block') {
    switchTab('order');
  }
}

export function switchWarehouseSubtab(tab) {
  warehouseActiveSubtab = tab;
  if (config.sessionToken) loadOrganizationLocations().then(() => {
    if (tab === 'inventory') loadInventoryBalances({ locationId: config.locationId }).then(() => renderWarehouseInventory());
    renderWarehouseLocationsList();
  }).catch(() => {});
  ['inventory', 'receiving', 'locations', 'transactions'].forEach(name => {
    const content = document.getElementById('warehouse-' + name);
    const btn = document.querySelector(`.warehouse-tab[data-wtab="${name}"]`);
    if (content) content.style.display = (name === tab) ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', name === tab);
  });
  if (tab === 'inventory') renderWarehouseInventory();
  if (tab === 'receiving') { renderWarehouseReceiving(); renderProcurementReceiving(); bindProcurementReceivingEvents(); }
  if (tab === 'locations') renderWarehouseLocationsList();
  if (tab === 'transactions') renderWarehouseTransactions();
}

export function renderWarehouseInventory() {
  const totalEl = document.getElementById('whStatTotal');
  const lowEl = document.getElementById('whStatLow');
  const outEl = document.getElementById('whStatOut');
  const low = getLowStockProducts();
  const out = getOutOfStockProducts();
  if (totalEl) totalEl.textContent = products.length;
  if (lowEl) lowEl.textContent = low.length;
  if (outEl) outEl.textContent = out.length;

  const locationBar = document.getElementById('warehouseInventoryLocation');
  if (locationBar) {
    const canonical = organizationLocations.filter(l => l.status === 'active');
    locationBar.innerHTML = canonical.length
      ? canonical.map(l => `<option value="${escapeAttr(l.id)}" ${String(l.id) === String(config.locationId) ? 'selected' : ''}>${escapeHtml(l.name)} · ${escapeHtml(l.type)}</option>`).join('')
      : '<option value="">Offline / default location</option>';
  }
  const list = document.getElementById('warehouseInventoryList');
  if (!list) return;
  if (products.length === 0) {
    list.innerHTML = `<div class="empty">No products yet. Add some in the Catalog tab.</div>`;
    return;
  }
  list.innerHTML = products.map(p => {
    const tracked = isStockTracked(p);
    const locationStock = tracked && config.locationId ? getInventoryBalance(p.id, config.locationId) : null;
    const stock = tracked ? ((config.locationId && organizationLocations.length > 0) ? locationStock : p.stock) : null;
    let badgeClass = '';
    if (tracked) {
      if (stock <= 0) badgeClass = 'danger';
      else if (p.reorder_point && stock <= p.reorder_point) badgeClass = 'warning';
    }
    const stockLabel = (config.locationId && organizationLocations.length > 0) ? `${stock} ${escapeHtml(p.unit || 'units')}` : (tracked ? `${stock} ${escapeHtml(p.unit || 'units')}` : t('whNotTracked'));
    const details = [
      `<span class="stock-badge ${badgeClass}">${stockLabel}</span>`,
      p.bin_location ? `<span><svg class="icon icon-sm"><use href="#i-pin"/></svg> ${escapeHtml(p.bin_location)}</span>` : '',
      p.batch_number ? `<span>${escapeHtml(p.batch_number)}</span>` : '',
      p.expiry_date ? `<span><svg class="icon icon-sm"><use href="#i-clock"/></svg> ${escapeHtml(p.expiry_date)}</span>` : ''
    ].filter(Boolean).join('');
    return `
      <div class="inventory-item">
        <div class="item-name">${escapeHtml(p.name)}</div>
        <div class="item-details">${details}</div>
        <div class="item-actions">
          <button type="button" onclick="openStockAdjustModal('${p.id}')"><svg class="icon icon-sm"><use href="#i-box"/></svg> ${t('whAdjust')}</button>
          <button type="button" onclick="openReceiveModal('${p.id}')"><svg class="icon icon-sm"><use href="#i-inbox"/></svg> ${t('whReceive')}</button>
        </div>
      </div>`;
  }).join('');
}

export function renderWarehouseReceiving() {
  const list = document.getElementById('warehouseReceivingList');
  if (!list) return;
  const received = stockTransactions.filter(t => t.type === 'received').slice(0, 50);
  if (received.length === 0) {
    list.innerHTML = `<div class="empty">${t('whNoReceiving')}</div>`;
    return;
  }
  list.innerHTML = received.map(txItemMarkup).join('');
}

export function renderWarehouseTransactions() {
  const list = document.getElementById('warehouseTransactionsList');
  if (!list) return;
  if (stockTransactions.length === 0) {
    list.innerHTML = `<div class="empty">${t('whNoHistory')}</div>`;
    return;
  }
  list.innerHTML = stockTransactions.slice(0, 100).map(txItemMarkup).join('');
}

export function txItemMarkup(tx) {
  const sign = tx.quantity > 0 ? '+' : '';
  const qtyClass = tx.quantity > 0 ? 'pos' : 'neg';
  const metaParts = [
    new Date(tx.timestamp).toLocaleString(),
    tx.performed_by ? escapeHtml(tx.performed_by) : '',
    tx.bin_location ? '<svg class="icon icon-sm"><use href="#i-pin"/></svg> ' + escapeHtml(tx.bin_location) : '',
    tx.batch_number ? escapeHtml(tx.batch_number) : '',
    tx.reference ? '#' + escapeHtml(tx.reference) : ''
  ].filter(Boolean).join(' · ');
  return `
    <div class="tx-item">
      <div class="tx-top">
        <span class="tx-product">${escapeHtml(tx.product_name || 'Deleted product')}</span>
        <span class="tx-qty ${qtyClass}">${sign}${tx.quantity}</span>
      </div>
      <div class="tx-meta">${metaParts}</div>
      ${tx.notes ? `<div class="tx-meta">${escapeHtml(tx.notes)}</div>` : ''}
    </div>`;
}

export function renderWarehouseLocationsList() {
  const list = document.getElementById('warehouseLocationsList');
  if (!list) return;
  const canonical = organizationLocations.filter(l => l.status === 'active');
  const canonicalMarkup = canonical.length ? `
    <div class="hint" style="margin-bottom:6px;">Business locations</div>
    <select id="warehouseCanonicalLocation" onchange="selectWarehouseLocation(this.value)" style="width:100%; margin-bottom:10px;">
      ${canonical.map(l => `<option value="${escapeAttr(l.id)}" ${String(l.id) === String(config.locationId) ? 'selected' : ''}>${escapeHtml(l.name)} · ${escapeHtml(l.type)}</option>`).join('')}
    </select>` : '';
  const legacyMarkup = warehouseLocations.length ? `
    <div class="hint" style="margin:8px 0 6px;">Storage bins (legacy)</div>
    ${warehouseLocations.map((loc, idx) => `
    <div class="paymethod-row">
      <span class="pm-name">${escapeHtml(loc.name)}</span>
      <button type="button" class="pm-remove" onclick="removeWarehouseLocation(${idx})" title="Remove"><svg class="icon icon-sm"><use href="#i-close"/></svg></button>
    </div>
  `).join('')}` : '';
  list.innerHTML = canonicalMarkup + legacyMarkup;
}

export function warehouseProductOptions(selectedId) {
  return products.map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('');
}

// ---------- Warehouse: Adjust stock modal ----------
export function openStockAdjustModal(productId) {
  const sel = document.getElementById('stockAdjustProduct');
  sel.innerHTML = warehouseProductOptions(productId);
  if (productId) sel.value = productId;
  document.getElementById('stockAdjustDelta').value = '';
  document.getElementById('stockAdjustNotes').value = '';
  onStockAdjustProductChange();
  renderCanonicalLocationSelect('stockAdjustLocation', config.locationId);
  document.getElementById('stockAdjustModal').style.display = 'flex';
}

export function onStockAdjustProductChange() {
  const sel = document.getElementById('stockAdjustProduct');
  const product = products.find(p => p.id === sel.value);
  const hint = document.getElementById('stockAdjustCurrentStock');
  const reorderInput = document.getElementById('stockAdjustReorderPoint');
  if (!product) { hint.textContent = ''; return; }
  hint.textContent = isStockTracked(product)
    ? `${t('whCurrentStock')}: ${product.stock} ${product.unit || ''}`
    : t('whNotTrackedYet');
  reorderInput.value = (product.reorder_point !== undefined && product.reorder_point !== null) ? product.reorder_point : '';
}

export function closeStockAdjustModal() {
  document.getElementById('stockAdjustModal').style.display = 'none';
}

export async function saveStockAdjustModal() {
  const productId = document.getElementById('stockAdjustProduct').value;
  const delta = parseInt(document.getElementById('stockAdjustDelta').value, 10);
  const reorderRaw = document.getElementById('stockAdjustReorderPoint').value;
  const notes = document.getElementById('stockAdjustNotes').value.trim();
  if (!productId || isNaN(delta) || delta === 0) { showToast(t('whInvalidAdjust')); return; }
  try {
    const result = await recordCanonicalInventoryMovement({
      productId, quantity: delta, movementType: 'ADJUSTMENT', reason: notes,
      locationId: document.getElementById('stockAdjustLocation')?.value || config.locationId || '',
      metadata: { reorderPoint: reorderRaw !== '' ? Math.max(0, parseInt(reorderRaw, 10) || 0) : null },
    });
    closeStockAdjustModal();
    await loadInventoryBalances({ locationId: config.locationId });
    renderWarehouseInventory();
    showToast(result?.queued ? 'Stock adjustment queued for sync.' : t('whStockUpdated'));
  } catch (error) {
    showToast(error.message || 'Could not update stock.');
  }
}

// ---------- Warehouse: Receive stock modal ----------
export function openReceiveModal(productId) {
  const sel = document.getElementById('receiveProduct');
  sel.innerHTML = warehouseProductOptions(productId);
  if (productId) sel.value = productId;
  document.getElementById('receiveQty').value = '';
  document.getElementById('receiveBatch').value = '';
  document.getElementById('receiveExpiry').value = '';
  document.getElementById('receiveReference').value = '';
  document.getElementById('receiveNotes').value = '';
  const locSel = document.getElementById('receiveLocation');
  locSel.innerHTML = `<option value="">—</option>` + warehouseLocations.map(l => `<option value="${escapeAttr(l.name)}">${escapeHtml(l.name)}</option>`).join('');
  renderCanonicalLocationSelect('receiveCanonicalLocation', config.locationId);
  document.getElementById('receiveStockModal').style.display = 'flex';
}

export function closeReceiveModal() {
  document.getElementById('receiveStockModal').style.display = 'none';
}

export async function saveReceiveModal() {
  const productId = document.getElementById('receiveProduct').value;
  const qty = parseInt(document.getElementById('receiveQty').value, 10);
  const batch = document.getElementById('receiveBatch').value.trim();
  const expiry = document.getElementById('receiveExpiry').value;
  const location = document.getElementById('receiveLocation').value;
  const reference = document.getElementById('receiveReference').value.trim();
  const notes = document.getElementById('receiveNotes').value.trim();
  if (!productId || isNaN(qty) || qty <= 0) { showToast(t('whInvalidReceive')); return; }
  const product = products.find(p => p.id === productId);
  try {
    const result = await recordCanonicalInventoryMovement({
      productId, quantity: qty, movementType: 'PURCHASE', reason: notes,
      locationId: document.getElementById('receiveCanonicalLocation')?.value || config.locationId || '',
      referenceType: 'stock_receipt', referenceId: reference || null,
      metadata: { batchNumber: batch || null, expiryDate: expiry || null, binLocation: location || null },
    });
    closeReceiveModal();
    await loadInventoryBalances({ locationId: config.locationId });
    renderWarehouseInventory();
    showToast(result?.queued ? 'Stock receipt queued for sync.' : t('whReceived') + ' ' + qty + ' × ' + (product ? product.name : ''));
  } catch (error) {
    showToast(error.message || 'Could not receive stock.');
  }
}

export function onWarehouseToggle(checked) {
  // No extra sub-fields to show/hide today; kept for symmetry with the other module toggles.
}


export function renderCanonicalLocationSelect(id, selectedId = '') {
  const host = document.getElementById(id);
  if (!host) return;
  const options = organizationLocations.filter(l => l.status === 'active');
  host.innerHTML = options.map(l => `<option value="${escapeAttr(l.id)}" ${String(l.id) === String(selectedId) ? 'selected' : ''}>${escapeHtml(l.name)} · ${escapeHtml(l.type)}</option>`).join('');
}

export function selectWarehouseLocation(locationId) {
  const location = selectOrganizationLocation(locationId);
  if (!location) return;
  loadInventoryBalances({ locationId: location.id }).then(() => renderWarehouseInventory()).catch(() => renderWarehouseInventory());
  renderWarehouseLocationsList();
}
