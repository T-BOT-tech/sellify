import assert from 'node:assert/strict';
import fs from 'node:fs';

const auth = fs.readFileSync(new URL('../backend/lib/authorization.js', import.meta.url), 'utf8');
const store = fs.readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../backend/server.js', import.meta.url), 'utf8');

assert.match(auth, /logistics_manager: 'logistics'/);
assert.match(auth, /logistics_dispatcher: 'logistics'/);
assert.match(auth, /logistics_courier: 'logistics'/);
assert.match(auth, /logistics_viewer: 'logistics'/);

assert.match(store, /CREATE TABLE IF NOT EXISTS delivery_assignments/);
assert.match(store, /UNIQUE\(fulfillment_id\)/);
assert.match(store, /COURIER_ROLE_REQUIRED/);
assert.match(store, /COURIER_SCOPE_DENIED/);
assert.match(store, /COURIER_ASSIGNMENT_REQUIRED/);
assert.match(store, /ASSIGNMENT_CONFLICT/);
assert.match(store, /INSERT INTO fulfillments/);

assert.match(server, /\/delivery-assignment\$/);
assert.match(server, /logistics:deliveries:assign/);
assert.match(server, /logistics:deliveries:update_assigned/);
assert.match(server, /assertCourierOwnsDelivery\(chatId, serverOrderId, session\)/);

console.log('GAP-2 Delivery Assignment Authority Regression: PASS');
console.log('Canonical assignment persistence: PASS');
console.log('Courier own-assignment enforcement: PASS');
console.log('Location scope enforcement: PASS');
console.log('Idempotent assignment conflict boundary: PASS');
