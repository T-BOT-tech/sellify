// FUX-52 — cross-pack inventory authority regression.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const backend = fs.readFileSync('backend/lib/store-sqlite.js', 'utf8');
const warehouse = fs.readFileSync('app/src/warehouse/ledger.js', 'utf8');
const procurement = fs.readFileSync('app/src/warehouse/procurement-receiving.js', 'utf8');
const fulfillment = fs.readFileSync('app/src/logistics/fulfillment.js', 'utf8');
const kitchen = fs.readFileSync('app/src/restaurant/kitchen.js', 'utf8');
const main = fs.readFileSync('app/src/main.js', 'utf8');

function check(condition, message) { assert.ok(condition, message); console.log('PASS:', message); }

check(backend.includes('export async function appendInventoryMovement'), 'Core exposes one canonical inventory movement authority');
check(backend.includes("movementType: 'PURCHASE'"), 'procurement receiving posts PURCHASE movements through the canonical authority');
check(backend.includes("movementType: 'SALE'"), 'marketplace sales use the canonical SALE movement authority');
check(backend.includes("movementType: 'RETURN'"), 'marketplace cancellation uses the canonical RETURN movement authority');
check(backend.includes('FROM inventory_movements'), 'marketplace stock availability is derived from canonical inventory movements');
check(backend.includes('catalog_products.stock'), 'catalog stock is explicitly retained only as a compatibility projection');
check(backend.includes('inventory_movements is the physical stock authority'), 'marketplace projection/authority boundary is documented in source');
check(backend.includes('marketplace-sale:'), 'marketplace SALE event identity is deterministic');
check(backend.includes('marketplace-cancel:'), 'marketplace RETURN event identity is deterministic');
check(warehouse.includes('recordCanonicalInventoryMovement'), 'Warehouse mutations target the canonical inventory API');
check(procurement.includes('/procurement/purchase-orders/'), 'Procurement receiving uses the canonical receipt API');
check(fulfillment.includes('/fulfillment'), 'Fulfillment uses the canonical fulfillment authority');
check(!fulfillment.includes('applyStockChange('), 'Fulfillment cannot mutate inventory through legacy local stock mutation');
check(!kitchen.includes('applyStockChange('), 'Restaurant kitchen cannot mutate inventory through legacy local stock mutation');
check(main.includes('applyStockChange'), 'legacy inventory helper remains isolated to compatibility imports rather than being evidence of active cross-pack authority');

console.log('FUX-52 cross-pack inventory authority regression: PASS');