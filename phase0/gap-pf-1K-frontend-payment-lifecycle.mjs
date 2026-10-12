import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');

const syncOrders = read('app/src/sync/orders.js');
const projection = read('app/src/payments/projection.js');
const client = read('app/src/payments/client.js');
const server = read('backend/server.js');
const paymentProof = read('app/src/orders/payment-proof.js');

assert.match(syncOrders, /ensurePaymentForSyncedOrder/);
assert.match(syncOrders, /server_order_id: result\\.order_id/);
assert.match(syncOrders, /await ensurePaymentForSyncedOrder\\(order\\)/);
assert.match(syncOrders, /Canonical payment\\/status refresh deferred/);

assert.match(projection, /listPayments\\(\\{ orderId: serverOrderId, limit: 10 \\}\\)/);
assert.match(projection, /createPayment\\(/);
assert.match(projection, /paymentCommandKey\\('create-order', serverOrderId\\)/);
assert.match(projection, /refreshCanonicalPaymentStatus\\(payment\\.id, \\{\\}, \\{ idempotencyKey: queryKey \\}\\)/);
assert.match(projection, /queryPaymentStatus\\(id, body, \\{ idempotencyKey: queryKey \\}\\)/);
assert.match(projection, /paymentCommandKey\\('status',/);
assert.match(projection, /const paymentEnsureInFlight = new Map\(\)/);
assert.match(projection, /if \(statusQueryKey\) return ensurePaymentForSyncedOrderOnce\(order, \{ statusQueryKey \}\)/);
assert.match(projection, /paymentEnsureInFlight\.delete\(serverOrderId\)/);

assert.match(client, /method: 'POST'/);
assert.match(client, /\\/status/);
assert.match(client, /'Idempotency-Key': requiredIdempotencyKey\\(idempotencyKey\\)/);

assert.match(server, /POST.*payments.*status|status.*POST/s);

assert.doesNotMatch(paymentProof, /createPayment\\(/);
assert.doesNotMatch(paymentProof, /queryPaymentStatus\\(/);
assert.doesNotMatch(paymentProof, /VERIFIED|RECONCILED/);

const syncAck = syncOrders.indexOf('server_order_id: result.order_id');
const paymentEnsure = syncOrders.indexOf('await ensurePaymentForSyncedOrder(order)');
assert.ok(syncAck >= 0 && paymentEnsure > syncAck, 'server order identity must be captured before canonical payment resolution');

const projectionRefresh = projection.indexOf('refreshCanonicalPaymentStatus(payment.id');
const projectionQuery = projection.indexOf('queryPaymentStatus(id, body');
assert.ok(projectionRefresh >= 0 && projectionQuery > projectionRefresh, 'canonical payment refresh must invoke the PaymentCore status query');

console.log('PASS PF-1K frontend order-sync → canonical payment → PaymentCore status lifecycle');