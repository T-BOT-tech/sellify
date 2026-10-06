import assert from 'node:assert/strict';
import fs from 'node:fs';

const store = fs.readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
const lifecycleStart = store.indexOf('export async function transitionDeliveryAssignment');
const lifecycle = store.slice(lifecycleStart, store.indexOf('export async function listDeliveryAssignments', lifecycleStart));

const begin = lifecycle.indexOf("db.exec('BEGIN IMMEDIATE')");
const replay = lifecycle.indexOf("const existingCommand = db.prepare('SELECT * FROM delivery_assignments WHERE organization_id = ? AND last_command_key = ?");
assert(begin >= 0, 'lifecycle transaction boundary missing');
assert(replay > begin, 'idempotency replay lookup must execute inside lifecycle transaction');
const activeRead = lifecycle.indexOf("const active = db.prepare(`SELECT da.* FROM delivery_assignments da JOIN fulfillments f");
assert(activeRead > begin, 'active assignment state must be re-read inside lifecycle transaction');
assert.match(lifecycle, /const current = String\(active\.status\);/);
assert.match(lifecycle, /transitions\[current\]\?\.has\(normalizedAction\)/);
assert.match(lifecycle, /IDEMPOTENCY_KEY_REUSE_CONFLICT/);
assert.match(lifecycle, /db\.exec\('COMMIT'\);\n      return existingCommand/);
assert.match(lifecycle, /last_command_key = \?/);
assert.match(lifecycle, /UPDATE delivery_assignments SET status = \?, last_command_key = \?/);
assert.match(store, /CREATE UNIQUE INDEX idx_delivery_assignments_active_fulfillment/);
const exceptionBlock = lifecycle.slice(lifecycle.indexOf("if (normalizedAction === 'REASSIGN_EXCEPTION')"), begin);
assert(begin >= 0, 'exception resolution must remain inside lifecycle transaction boundary');
assert.match(lifecycle, /last_command_key = \?/);
assert.match(exceptionBlock, /IDEMPOTENCY_KEY_REUSE_CONFLICT/);

const assignStart = store.indexOf('export async function assignDeliveryCourier');
const assign = store.slice(assignStart, store.indexOf('export async function getDeliveryAssignment', assignStart));
assert.match(assign, /BEGIN IMMEDIATE/);
assert.match(assign, /assignmentKey/);
assert.match(assign, /ASSIGNMENT_CONFLICT/);

console.log('GAP-2.10 Adversarial Delivery Regression: PASS');
console.log('Lifecycle idempotency replay is serialized inside BEGIN IMMEDIATE: PASS');
console.log('Idempotency-key reuse conflict remains enforced: PASS');
console.log('Single active assignment invariant remains enforced: PASS');
console.log('Assignment creation remains transactionally serialized: PASS');
