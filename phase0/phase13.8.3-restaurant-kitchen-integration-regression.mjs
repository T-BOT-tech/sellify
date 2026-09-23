import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createKitchenTicketFromOrder,
  isKitchenTicket,
  kitchenStatusContract,
  assertKitchenOrderContext,
} from '../app/src/verticals/restaurant/kitchen-integration.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const kitchenPath = path.join(root, 'app/src/restaurant/kitchen.js');
const checkoutPath = path.join(root, 'app/src/orders/checkout.js');
const bridgePath = path.join(root, 'app/src/verticals/restaurant/kitchen-integration.js');
const packPath = path.join(root, 'app/src/verticals/restaurant/pack.js');

for (const p of [kitchenPath, checkoutPath, bridgePath, packPath]) assert(fs.existsSync(p));
const kitchen = fs.readFileSync(kitchenPath, 'utf8');
const checkout = fs.readFileSync(checkoutPath, 'utf8');
const pack = fs.readFileSync(packPath, 'utf8');
assert.match(kitchen, /export function setKitchenStatus/);
assert.match(kitchen, /export function setKitchenPriority/);
assert.match(kitchen, /export function optimisticMarkServed/);
assert.match(checkout, /order\.kitchen_status = 'pending'/);
assert.match(checkout, /order\.priority = 'normal'/);
assert.match(pack, /kitchen_bridge: 'app\/src\/verticals\/restaurant\/kitchen-integration\.js'/);

const order = {
  id: 'order-1',
  items: [{ id: 'prod-1', name: 'Coffee', qty: 2 }],
  kitchen_status: 'preparing',
  priority: 'urgent',
  course: 'main',
  table_id: 'table-7',
  table_number: 7,
  created_at: 123456,
  kitchen_started_at: 123999,
};
const ticket = createKitchenTicketFromOrder(order, { organizationId: 'org-1', locationId: 'loc-1' });
assert.equal(ticket.ticket_id, 'kitchen:order-1');
assert.equal(ticket.order_id, 'order-1');
assert.equal(ticket.organization_id, 'org-1');
assert.equal(ticket.location_id, 'loc-1');
assert.equal(ticket.status, 'preparing');
assert.equal(ticket.priority, 'urgent');
assert.equal(ticket.table_id, 'table-7');
assert.equal(ticket.table_number, 7);
assert.equal(ticket.items[0].qty, 2);
assert.equal(isKitchenTicket(ticket), true);
assert.equal(assertKitchenOrderContext(order, { organizationId: 'org-1', locationId: 'loc-1' }).order_id, 'order-1');

assert.throws(() => createKitchenTicketFromOrder(null, { organizationId: 'org-1', locationId: 'loc-1' }), /Core Commerce order is required/);
assert.throws(() => createKitchenTicketFromOrder({ id: 'order-2', items: [] }, { organizationId: 'org-1', locationId: 'loc-1' }), /must contain items/);
assert.throws(() => createKitchenTicketFromOrder({ ...order, kitchen_status: 'cancelled' }, { organizationId: 'org-1', locationId: 'loc-1' }), /Invalid kitchen status/);
assert.throws(() => createKitchenTicketFromOrder({ ...order, priority: 'critical' }, { organizationId: 'org-1', locationId: 'loc-1' }), /Invalid kitchen priority/);
assert.throws(() => createKitchenTicketFromOrder(order, { organizationId: 'org-1' }), /location_id/);

const contract = kitchenStatusContract();
assert.equal(contract.ticket_authority, 'app/src/restaurant/kitchen.js');
assert.equal(contract.order_authority, 'commerce');
assert.equal(contract.payment_authority, 'payments');
assert.equal(contract.inventory_authority, 'inventory');
assert.equal(contract.customer_authority, 'customers');
assert.equal(contract.location_authority, 'locations');
assert.equal(contract.fulfillment_authority, 'fulfillment');
assert.deepEqual(contract.status_values, ['pending', 'preparing', 'ready', 'served']);
assert.deepEqual(contract.priority_values, ['low', 'normal', 'urgent']);
assert.equal(contract.persistence, 'existing Core Order record');
assert.equal(contract.duplicate_order_authority, false);

console.log('Phase 13.8.3 Restaurant Kitchen Integration Regression: PASS');
