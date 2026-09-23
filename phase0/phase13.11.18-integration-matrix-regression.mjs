import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(root, relative));

const ALLOWED_EDGES = Object.freeze([
  ['commerce', 'fulfillment', 'app/src/verticals/physical-commerce/spine-contract.js'],
  ['commerce', 'inventory', 'app/src/verticals/restaurant/commerce-inventory-contract.js'],
  ['warehouse', 'inventory', 'app/src/verticals/warehouse/inventory-contract.js'],
  ['warehouse', 'fulfillment', 'app/src/verticals/warehouse/fulfillment-boundary.js'],
  ['warehouse', 'logistics', 'app/src/verticals/warehouse/fulfillment-boundary.js'],
  ['restaurant', 'commerce', 'app/src/verticals/restaurant/commerce-inventory-contract.js'],
  ['restaurant', 'inventory', 'app/src/verticals/restaurant/commerce-inventory-contract.js'],
  ['restaurant', 'warehouse', 'app/src/verticals/restaurant/warehouse-logistics-contract.js'],
  ['restaurant', 'logistics', 'app/src/verticals/restaurant/warehouse-logistics-contract.js'],
  ['agriculture', 'commerce', 'app/src/verticals/agriculture/commerce-inventory-contract.js'],
  ['agriculture', 'inventory', 'app/src/verticals/agriculture/commerce-inventory-contract.js'],
  ['agriculture', 'warehouse', 'app/src/verticals/agriculture/warehouse-logistics-contract.js'],
  ['agriculture', 'logistics', 'app/src/verticals/agriculture/warehouse-logistics-contract.js'],
  ['all-verticals', 'customers', 'app/src/verticals/contract.js'],
  ['all-verticals', 'locations', 'app/src/verticals/contract.js'],
  ['all-verticals', 'audit', 'app/src/audit/audit-boundary.js'],
  ['logistics', 'commerce', 'app/src/verticals/logistics/cancellation-return-contract.js'],
  ['logistics', 'fulfillment', 'app/src/verticals/logistics/fulfillment-boundary.js'],
  ['logistics', 'inventory', 'app/src/verticals/logistics/cancellation-return-contract.js'],
  ['events', 'outbox', 'app/src/events/event-boundary.js'],
  ['events', 'sync_events', 'backend/lib/event-replay.js'],
  ['authorization', 'tenant', 'backend/lib/tenant-isolation.js'],
  ['returns', 'commerce', 'app/src/verticals/logistics/cancellation-return-contract.js'],
  ['returns', 'fulfillment', 'app/src/verticals/logistics/cancellation-return-contract.js'],
  ['returns', 'inventory', 'app/src/verticals/logistics/cancellation-return-contract.js'],
]);

for (const [, , anchor] of ALLOWED_EDGES) assert(exists(anchor), `matrix anchor missing: ${anchor}`);

// Actual contract surfaces, not documentation alone.
const restaurantCommerce = await import('../app/src/verticals/restaurant/commerce-inventory-contract.js');
const restaurantPhysical = await import('../app/src/verticals/restaurant/warehouse-logistics-contract.js');
const agricultureCommerce = await import('../app/src/verticals/agriculture/commerce-inventory-contract.js');
const agriculturePhysical = await import('../app/src/verticals/agriculture/warehouse-logistics-contract.js');
const warehouseInventory = await import('../app/src/verticals/warehouse/inventory-contract.js');
const warehouseFulfillment = await import('../app/src/verticals/warehouse/fulfillment-boundary.js');
const logisticsReturns = await import('../app/src/verticals/logistics/cancellation-return-contract.js');
const unified = await import('../app/src/logistics/unified-fulfillment-contract.js');
const events = await import('../app/src/events/event-boundary.js');
const audit = await import('../app/src/audit/audit-boundary.js');

const rc = restaurantCommerce.restaurantCommerceInventoryContract();
assert.equal(rc.order_authority, 'commerce');
assert.equal(rc.product_authority, 'commerce');
assert.equal(rc.stock_authority, 'inventory');
assert.equal(rc.payment_authority, 'payments');
assert.equal(rc.duplicate_order_authority, false);
assert.equal(rc.duplicate_inventory_authority, false);

const rp = restaurantPhysical.restaurantWarehouseLogisticsContract();
assert.equal(rp.order_authority, 'commerce');
assert.equal(rp.product_authority, 'commerce');
assert.equal(rp.inventory_authority, 'inventory');
assert.equal(rp.fulfillment_authority, 'app/src/logistics/fulfillment.js');
assert.equal(rp.warehouse_role, 'consume_and_integrate');
assert.equal(rp.logistics_role, 'coordinate_and_project');
assert.equal(rp.persistence, 'none');

const ac = agricultureCommerce.AGRICULTURE_COMMERCE_INVENTORY_CONTRACT;
assert.equal(ac.order_authority, 'commerce');
assert.equal(ac.product_authority, 'commerce');
assert.equal(ac.stock_authority, 'inventory');
assert.equal(ac.payment_authority, 'payments');
assert.equal(ac.fulfillment_authority, 'fulfillment');

const ap = agriculturePhysical.AGRICULTURE_WAREHOUSE_LOGISTICS_CONTRACT;
assert.equal(ap.product_authority, 'commerce');
assert.equal(ap.order_authority, 'commerce');
assert.equal(ap.stock_authority, 'inventory');
assert.equal(ap.warehouse_authority.includes('Receiving'), true);
assert.equal(ap.fulfillment_authority, 'app/src/logistics/fulfillment.js');
assert.equal(ap.location_authority, 'locations');

const wi = warehouseInventory.warehouseInventoryContract();
assert.equal(wi.warehouse_workflow_authority, 'warehouse');
assert.equal(wi.product_authority, 'commerce');
assert.equal(wi.stock_authority, 'inventory');
assert.equal(wi.location_authority, 'locations');
assert.equal(wi.duplicate_inventory_authority, false);
assert.equal(wi.duplicate_ledger_authority, false);

const wf = warehouseFulfillment.warehouseFulfillmentBoundaryContract();
assert.equal(wf.order_authority, 'commerce');
assert.equal(wf.fulfillment_authority, 'app/src/logistics/fulfillment.js');
assert.equal(wf.duplicate_fulfillment_authority, false);

const lr = logisticsReturns.cancellationReturnContract();
assert.equal(lr.cancellation_authority, 'commerce');
assert.equal(lr.return_authority, 'logistics-pack');
assert.equal(lr.fulfillment_authority, 'app/src/logistics/fulfillment.js');
assert.equal(lr.inventory_authority, 'inventory');
assert.equal(lr.event_envelope_authority, 'app/src/events/event-boundary.js');
assert.equal(lr.dispatch_implemented, false);
assert.equal(lr.route_implementation, false);

const uf = unified.unifiedFulfillmentContract();
assert.equal(uf.order_authority, 'commerce');
assert.equal(uf.fulfillment_authority, 'app/src/logistics/fulfillment.js');
assert.equal(uf.inventory_authority, 'inventory');
assert.equal(uf.warehouse_role, 'consume_and_integrate');
assert.equal(uf.logistics_role, 'coordinate_and_project');
assert.equal(uf.persistence, 'none');
assert.equal(uf.dispatch_implemented, false);
assert.equal(uf.route_implementation, false);

const eb = events.eventBoundaryContract();
assert.equal(eb.outbox_authority, 'app/src/sync/outbox.js#enqueueEvent');
assert.equal(eb.backend_event_authority, 'backend/lib/store-sqlite.js#processSyncEvent');
assert.equal(eb.persistence, 'existing outbox and sync_events only');
assert.equal(eb.duplicate_event_store, false);

const ab = audit.auditBoundaryContract();
assert.equal(ab.audit_authority, 'existing backend audit_events / recordAuditEvent()');
assert.equal(ab.tenant_scope, 'organization_id is required and authoritative');
assert.equal(ab.persistence, 'existing audit_events only');
assert.equal(ab.duplicate_audit_store, false);

// Explicitly prove the hub-and-contract topology: vertical implementation
// directories must not import another vertical's implementation internals.
const verticalRoot = path.join(root, 'app/src/verticals');
const packs = ['agriculture', 'restaurant', 'warehouse', 'logistics'];
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(?:js|mjs)$/.test(entry.name)) files.push(full);
  }
}
walk(verticalRoot);
const rawCrossPack = /from\s+['"](?:\.\.\/)+verticals\/(agriculture|restaurant|warehouse|logistics)\/([^'"/]+)(?:\/[^'"]*)?['"]/g;
for (const full of files) {
  const rel = path.relative(root, full).replaceAll('\\', '/');
  const source = fs.readFileSync(full, 'utf8');
  let match;
  while ((match = rawCrossPack.exec(source))) {
    const target = match[1];
    const surface = match[2];
    if (packs.includes(rel.split('/')[3]) && rel.split('/')[3] !== target) {
      assert(/contract|boundary|bridge|pack|authority-map|integration|spine/.test(surface), `forbidden raw cross-pack edge ${rel} -> ${target}/${surface}`);
    }
  }
}

// Every unordered vertical pair is either explicitly represented by an
// approved contract edge or deliberately has no implementation edge.
const verticalPairs = [];
for (let i = 0; i < packs.length; i++) for (let j = i + 1; j < packs.length; j++) verticalPairs.push([packs[i], packs[j]]);
const allowedPairKeys = new Set(ALLOWED_EDGES.filter(([a, b]) => packs.includes(a) && packs.includes(b)).map(([a, b]) => [a, b].sort().join(':')));
for (const [a, b] of verticalPairs) {
  const key = [a, b].sort().join(':');
  if (!allowedPairKeys.has(key)) assert.equal(key, 'agriculture:restaurant', 'unexpected direct vertical pair');
}

// The only deliberately absent vertical pair is Agriculture ↔ Restaurant;
// they converge through Core Commerce/Inventory/Fulfillment rather than a
// new point-to-point integration contract.
assert(!exists('app/src/verticals/agriculture/restaurant-contract.js'));
assert(!exists('app/src/verticals/restaurant/agriculture-contract.js'));

const forbiddenArtifacts = [
  'app/src/verticals/agriculture/restaurant-orchestrator.js',
  'app/src/verticals/restaurant/agriculture-orchestrator.js',
  'app/src/verticals/physical-commerce/orchestrator.js',
  'app/src/logistics/route-engine.js',
  'app/src/logistics/dispatch-engine.js',
];
for (const file of forbiddenArtifacts) assert(!exists(file), `forbidden integration artifact exists: ${file}`);

console.log('Phase 13.11.18 Integration Matrix Regression: PASS');
console.log(`Allowed integration edges declared: ${ALLOWED_EDGES.length}`);
console.log('Actual contract surfaces: PASS');
console.log('Commerce / Inventory / Payments authority continuity: PASS');
console.log('Warehouse / Restaurant / Agriculture / Logistics edge continuity: PASS');
console.log('Events / Outbox / sync_events boundary continuity: PASS');
console.log('Returns / Fulfillment / Inventory continuity: PASS');
console.log('Authorization / tenant / location boundary anchor: PASS');
console.log('Audit / tenant / correlation boundary anchor: PASS');
console.log('Forbidden N×N vertical implementation paths: BLOCKED');
console.log('Agriculture ↔ Restaurant direct integration: BLOCKED');
console.log('Route / Dispatch implementation: BLOCKED');
