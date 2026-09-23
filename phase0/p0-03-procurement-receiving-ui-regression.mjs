import fs from 'node:fs';
import assert from 'node:assert/strict';
const moduleText = fs.readFileSync('app/src/warehouse/procurement-receiving.js', 'utf8');
const warehouseText = fs.readFileSync('app/src/warehouse/ui.js', 'utf8');
const html = fs.readFileSync('app/index.html', 'utf8');
for (const token of [
  "procurement/purchase-orders/",
  "procurement:receipt:create",
  "idempotencyKey",
  "canonical procurement-receiving API",
  "UNKNOWN",
  "OFFLINE",
]) assert.match(moduleText, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(warehouseText, /renderProcurementReceiving/);
assert.match(warehouseText, /bindProcurementReceivingEvents/);
assert.match(html, /id="warehouseProcurementReceiving"/);
console.log('P0-03 procurement receiving UI regression: PASS');
