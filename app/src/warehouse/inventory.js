// warehouse/inventory.js
// Phase 6 extraction (see modularization plan §5): stock-tracking core —
// isStockTracked/getLowStockProducts/getOutOfStockProducts/applyStockChange
// — moved out of main.js unchanged. Stock is opt-in per install
// (config.warehouseEnabled); products created before warehouse mode was
// turned on simply have no `stock` field, treated as "not tracked" rather
// than "zero", so enabling this never falsely flags every existing product
// as out of stock. warehouseLocations/stockTransactions themselves already
// live in state.js (Phase 2).
import { STORAGE_KEYS } from '../constants.js';
import { config, products, currentStaff, stockTransactions } from '../state.js';
import { saveJSON } from '../storage/json.js';
import { hasPermission } from '../auth/permissions.js';
import { recordInventoryMovement } from './ledger.js';

export function isWarehouseEnabled() {
  return !!config.warehouseEnabled;
}
export function isStockTracked(p) {
  return typeof p.stock === 'number';
}
export function getLowStockProducts() {
  return products.filter(p => isStockTracked(p) && p.stock > 0 && p.stock <= (p.reorder_point || 0));
}
export function getOutOfStockProducts() {
  return products.filter(p => isStockTracked(p) && p.stock <= 0);
}
export function saveStockTransactions() {
  saveJSON(STORAGE_KEYS.stockTransactions, stockTransactions);
}
// Records a stock movement and applies it to the product's stock count in one step.
// type: 'received' | 'adjusted'. delta may be negative (e.g. correcting a miscount).
export function applyStockChange(productId, delta, type, meta) {
  // Phase 3 fix (see modularization plan §5, Phase 3): gated here rather
  // than in each caller (saveStockAdjustModal, saveReceiveModal in
  // warehouse/ui.js) since this is the one function that actually writes
  // to product.stock — gating the modal handlers alone would leave a
  // console call to applyStockChange() itself unguarded. Uses the same
  // inventory:edit permission as editing/removing a product.
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'inventory:edit')) return null;
  const product = products.find(p => p.id === productId);
  if (!product) return null;
  const before = isStockTracked(product) ? product.stock : 0;
  product.stock = Math.max(0, before + delta);
  if (meta && meta.batch_number) product.batch_number = meta.batch_number;
  if (meta && meta.expiry_date) product.expiry_date = meta.expiry_date;
  if (meta && meta.bin_location) product.bin_location = meta.bin_location;
  if (meta && meta.reorder_point !== undefined && meta.reorder_point !== null) product.reorder_point = meta.reorder_point;
  saveJSON(STORAGE_KEYS.products, products);

  const tx = {
    id: 'ST_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    product_id: productId,
    product_name: product.name,
    type: type,
    quantity: delta,
    resulting_stock: product.stock,
    bin_location: (meta && meta.bin_location) || product.bin_location || undefined,
    batch_number: (meta && meta.batch_number) || undefined,
    reference: (meta && meta.reference) || undefined,
    reference_id: (meta && meta.referenceId) || undefined,
    notes: (meta && meta.notes) || undefined,
    timestamp: Date.now(),
    performed_by: currentStaff ? currentStaff.name : 'Owner'
  };
  stockTransactions.unshift(tx);
  saveStockTransactions();

  // Phase 10.5: append the canonical movement stream without changing the
  // legacy stock mutation above. The compatibility transaction remains the
  // UI projection while the new ledger becomes the migration target.
  recordInventoryMovement(product, delta, type, {
    referenceType: meta?.referenceType || 'stock_transaction',
    referenceId: meta?.referenceId || meta?.reference || tx.id,
      eventId: meta?.eventId,
    locationId: meta?.locationId || config.locationId || '',
    reason: meta?.reason || meta?.notes || '',
    metadata: {
      legacyTransactionId: tx.id,
      binLocation: tx.bin_location || null,
      batchNumber: tx.batch_number || null,
    },
  });
  return tx;
}
