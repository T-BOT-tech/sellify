// warehouse/inventory.js
// FUX-47 — canonical inventory balance projection.
// Legacy product.stock remains only as a compatibility fallback for installs
// that have not yet received canonical inventory data.
import { config, products, currentStaff, stockTransactions, inventoryBalances, inventoryMovements } from '../state.js';
import { saveJSON } from '../storage/json.js';
import { STORAGE_KEYS } from '../constants.js';
import { hasPermission } from '../auth/permissions.js';
import { getInventoryBalance } from './ledger.js';

export function isWarehouseEnabled() {
  return !!config.warehouseEnabled;
}

function hasCanonicalInventory(productId) {
  const tenantChatId = String(config.chatId || '');
  const locationId = String(config.locationId || '');
  const hasScopedBalance = inventoryBalances.some(row =>
    String(row.productId) === String(productId)
    && (!tenantChatId || String(row.tenantChatId || '') === tenantChatId)
    && (!locationId || String(row.locationId || '') === locationId)
  );
  // Movement rows predate tenant-scoped balance metadata. Do not use another
  // tenant's balance projection to declare this product canonically tracked.
  return hasScopedBalance
    || inventoryMovements.some(row =>
      String(row.productId) === String(productId)
      && (!locationId || String(row.locationId || '') === locationId)
    );
}

export function isStockTracked(p) {
  return typeof p.stock === 'number' || hasCanonicalInventory(p.id);
}

export function projectedStock(p, locationId = config.locationId || '') {
  if (hasCanonicalInventory(p.id)) return getInventoryBalance(p.id, locationId);
  return typeof p.stock === 'number' ? p.stock : null;
}

export function getLowStockProducts() {
  return products.filter(p => {
    const stock = projectedStock(p);
    return stock !== null && stock > 0 && stock <= (p.reorder_point || 0);
  });
}

export function getOutOfStockProducts() {
  return products.filter(p => {
    const stock = projectedStock(p);
    return stock !== null && stock <= 0;
  });
}

export function saveStockTransactions() {
  saveJSON(STORAGE_KEYS.stockTransactions, stockTransactions);
}

// Compatibility-only legacy mutation path. Active Warehouse UI no longer calls
// this function; canonical mutations use recordCanonicalInventoryMovement().
export function applyStockChange(productId, delta, type, meta) {
  // Hard legacy boundary: once the station is connected/authenticated, local
  // stock mutation must never become an alternate authority. Callers must use
  // recordCanonicalInventoryMovement(), which queues safely when offline.
  if (config.sessionToken || hasCanonicalInventory(productId)) {
    throw Object.assign(new Error('Legacy local inventory mutation is disabled; use the canonical inventory movement API.'), {
      code: 'LEGACY_INVENTORY_MUTATION_DISABLED',
    });
  }
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'inventory:edit')) return null;
  const product = products.find(p => p.id === productId);
  if (!product) return null;
  const before = isStockTracked(product) ? projectedStock(product) : 0;
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
    type,
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
  return tx;
}
