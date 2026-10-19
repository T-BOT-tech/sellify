import assert from 'node:assert/strict';
import fs from 'node:fs';

const store = fs.readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../backend/server.js', import.meta.url), 'utf8');

assert.match(store, /if \(!applied\.includes\(44\)\)/);
assert.match(store, /CREATE UNIQUE INDEX idx_delivery_assignments_active_fulfillment/);
assert.match(store, /last_command_key TEXT/);
assert.match(store, /IDEMPOTENCY_KEY_REUSE_CONFLICT/);
assert.match(store, /transitionDeliveryAssignment/);
const fulfillmentStart = store.indexOf('function transitionOrderFulfillment(');
const fulfillmentEnd = store.indexOf('export function coreFulfillmentContract()', fulfillmentStart);
assert.ok(fulfillmentStart >= 0 && fulfillmentEnd > fulfillmentStart,
  'canonical fulfillment transition implementation must remain discoverable');
const fulfillmentTransition = store.slice(fulfillmentStart, fulfillmentEnd);
assert.match(fulfillmentTransition, /BEGIN IMMEDIATE[\s\S]*?SELECT \* FROM orders WHERE chat_id = \? AND server_order_id = \?/,
  'fulfillment transition must reload canonical order inside the write transaction');
assert.match(fulfillmentTransition, /SELECT organization_id FROM tenants WHERE chat_id = \?/,
  'fulfillment transition must revalidate tenant organization inside the transaction');
assert.match(fulfillmentTransition, /freshCommandFingerprint !== commandFingerprint/,
  'fulfillment transition must reject stale canonical order inputs');
assert.match(store, /if \(!applied\.includes\(70\)\)/,
  'durable fulfillment command history must be introduced through an additive migration');
assert.match(store, /CREATE TABLE IF NOT EXISTS fulfillment_commands/,
  'fulfillment idempotency keys must survive later transitions');
assert.match(fulfillmentTransition, /FROM fulfillment_commands[\s\S]*?WHERE organization_id = \? AND command_key = \?/,
  'fulfillment retries must consult durable command history rather than only the latest command key');
assert.match(fulfillmentTransition, /priorCommand\.command_fingerprint\) !== commandFingerprint/,
  'reusing a historical key with a different command fingerprint must conflict');
assert.match(fulfillmentTransition, /INSERT INTO fulfillment_commands/,
  'successful fulfillment commands must be recorded transactionally');
assert.match(fulfillmentTransition, /ROLLBACK/,
  'failed fulfillment transitions must roll back the write transaction');
assert.match(fulfillmentTransition, /applyCoreFulfillmentInventoryConsequence\(key, updated, freshOrderJson, actor\)/,
  'fulfillment inventory consequences must use the order re-read inside the write transaction');

assert.match(store, /ASSIGNED: new Set\(\['ACCEPTED','CANCELLED','FAILED','REASSIGNED'\]\)/);
assert.match(store, /ACCEPTED: new Set\(\['OUT_FOR_DELIVERY','CANCELLED','FAILED','REASSIGNED'\]\)/);
assert.match(store, /OUT_FOR_DELIVERY: new Set\(\['DELIVERED','CANCELLED','FAILED','REASSIGNED'\]\)/);
assert.match(store, /DELIVERY_PROOF_REQUIRED/);
assert.match(store, /DELIVERY_PROOF_INVALID/);
assert.match(store, /DELIVERY_PROOF_IMMUTABLE/);
assert.match(store, /proofReference/);
assert.match(store, /existingProof/);
assert.match(store, /EXCEPTION_REASON_REQUIRED/);
assert.match(store, /REASSIGN_EXCEPTION/);
assert.match(store, /EXCEPTION_NOT_FOUND/);
assert.match(store, /delivery\.assignment\.exception_resolved/);
assert.match(store, /REASSIGNMENT_TARGET_REQUIRED/);
assert.match(store, /BEGIN IMMEDIATE/);
assert.match(store, /No unresolved delivery exception exists/);
assert.match(store, /UPDATE delivery_assignments SET status = \\'REASSIGNED\\'/);
assert.match(store, /delivery\.assignment\.reassigned/);
assert.match(store, /Target courier does not have an active logistics courier role/);
const exceptionResolutionStart = store.indexOf("if (normalizedAction === 'REASSIGN_EXCEPTION')");
const exceptionResolutionEnd = store.indexOf("  const transitions =", exceptionResolutionStart);
const exceptionResolution = store.slice(exceptionResolutionStart, exceptionResolutionEnd);
assert.match(exceptionResolution, /BEGIN IMMEDIATE[\s\S]*?const freshCourier = db\.prepare/,
  'exception reassignment must revalidate target courier authorization inside the write transaction');
assert.ok(
  exceptionResolution.indexOf('const existingCommand = db.prepare') >= 0
    && exceptionResolution.indexOf('const freshCourier = db.prepare') > exceptionResolution.indexOf('const existingCommand = db.prepare'),
  'committed exception reassignment retries must replay durable command history before rechecking mutable courier role',
);

assert.match(store, /if \(!applied\.includes\(71\)\)/, 'durable assignment command history must use an additive migration');
assert.match(store, /CREATE TABLE IF NOT EXISTS delivery_assignment_commands/, 'assignment lifecycle commands must persist beyond last_command_key');
const assignmentStart = store.indexOf('export async function assignDeliveryCourier(');
const assignmentEnd = store.indexOf('export async function ', assignmentStart + 30);
assert.ok(assignmentStart >= 0 && assignmentEnd > assignmentStart,
  'canonical courier assignment implementation must remain discoverable');
const assignmentCreation = store.slice(assignmentStart, assignmentEnd);
assert.match(assignmentCreation, /FROM delivery_assignment_commands[\s\S]*?WHERE organization_id = \? AND command_key = \?/,
  'initial assignment retries must consult durable command history');
assert.match(assignmentCreation, /INSERT INTO delivery_assignment_commands/,
  'successful initial assignments must persist their command identity');
assert.ok(
  assignmentCreation.indexOf('const priorCommand = db.prepare') >= 0
    && assignmentCreation.indexOf('const priorCommand = db.prepare') < assignmentCreation.indexOf('assertServiceDeliveryReadyForExecution(freshOrder)'),
  'initial assignment retries must replay durable command history before rechecking mutable service readiness',
);
assert.ok(
  assignmentCreation.indexOf('const priorCommand = db.prepare') < assignmentCreation.indexOf("assertLogisticsSchedulingAuthorization(actor, organizationId, locationId, 'logistics:scheduling:request')"),
  'initial assignment retries must replay before rechecking mutable caller authorization',
);
assert.ok(
  assignmentCreation.indexOf('const priorCommand = db.prepare') < assignmentCreation.indexOf('LOGISTICS_ASSIGNMENT_LOCATION_MISMATCH'),
  'initial assignment retries must replay before validating mutable canonical location against caller input',
);
const initialFingerprintStart = assignmentCreation.indexOf('let assignmentFingerprint = crypto.createHash');
const initialFingerprintEnd = assignmentCreation.indexOf("db.exec('BEGIN IMMEDIATE')", initialFingerprintStart);
assert.ok(initialFingerprintStart >= 0 && initialFingerprintEnd > initialFingerprintStart,
  'initial assignment command fingerprint must remain explicit and testable');
assert.doesNotMatch(assignmentCreation.slice(initialFingerprintStart, initialFingerprintEnd), /location_id/,
  'initial assignment idempotency fingerprint must not depend on mutable canonical location');
const assignmentTransitionStart = store.indexOf('export async function transitionDeliveryAssignment(');
const assignmentTransitionEnd = store.indexOf('export async function ', assignmentTransitionStart + 30);
assert.ok(assignmentTransitionStart >= 0 && assignmentTransitionEnd > assignmentTransitionStart,
  'canonical assignment lifecycle transition must remain discoverable');
const assignmentTransition = store.slice(assignmentTransitionStart, assignmentTransitionEnd);
assert.match(assignmentTransition, /FROM delivery_assignment_commands[\s\S]*?WHERE organization_id = \? AND command_key = \?/,
  'assignment retries must consult durable command history');
assert.match(assignmentTransition, /existingCommand\.command_fingerprint\) !== commandFingerprint/,
  'historical assignment key reuse with different intent must conflict');
const assignmentFingerprintStart = assignmentTransition.indexOf('const commandFingerprint = crypto.createHash');
const assignmentFingerprintEnd = assignmentTransition.indexOf("if (normalizedAction === 'REASSIGN_EXCEPTION')", assignmentFingerprintStart);
assert.ok(assignmentFingerprintStart >= 0 && assignmentFingerprintEnd > assignmentFingerprintStart,
  'assignment command fingerprint must remain explicit and testable');
const assignmentFingerprint = assignmentTransition.slice(assignmentFingerprintStart, assignmentFingerprintEnd);
assert.doesNotMatch(assignmentFingerprint, /location_id/,
  'assignment idempotency fingerprint must not depend on mutable or caller-overridden location state');

assert.ok(
  assignmentTransition.indexOf('if (existingCommand)') >= 0
    && assignmentTransition.indexOf('if (existingCommand)') < assignmentTransition.indexOf("EXCEPTION_REASON_REQUIRED")
    && assignmentTransition.indexOf('if (existingCommand)') < assignmentTransition.indexOf("DELIVERY_PROOF_REQUIRED"),
  'durable assignment command replay/conflict must be resolved before action-specific reason/proof validation',
);
assert.match(assignmentTransition, /INSERT INTO delivery_assignment_commands/g,
  'successful assignment lifecycle commands must be recorded durably');
assert.ok(
  assignmentTransition.indexOf('const canonicalLocationId = freshOrderRow.location_id')
    < assignmentTransition.indexOf("if (normalizedAction === 'REASSIGNED')"),
  'canonical order location must be loaded before courier reassignment scope checks',
);
assert.match(assignmentTransition, /const locationId = canonicalLocationId \|\| active\.location_id \|\| order\.location_id \|\| null/,
  'normal reassignment must not let request input override canonical order location');
assert.match(assignmentTransition, /applyCoreFulfillmentInventoryConsequence\(String\(chatId\), updatedFulfillment, orderFromRow\(freshOrderRow\), actor\)/,
  'delivery completion inventory consequences must use the freshly revalidated canonical order');


assert.match(store, /delivery\.assignment\.delivered/);
assert.match(store, /applyCoreFulfillmentInventoryConsequence/);

assert.match(server, /method: 'PATCH'.*delivery-assignment/);
assert.match(server, /transitionDeliveryAssignment/);
assert.match(server, /logistics:deliveries:update_assigned/);
assert.match(server, /logistics:deliveries:reassign/);
assert.match(server, /Idempotency-Key is required/);

console.log('GAP-2 Delivery Assignment Lifecycle Regression: PASS');
console.log('Assignment history + active-assignment uniqueness: PASS');
console.log('Courier accept/start/deliver authorization boundary: PASS');
console.log('Delivery proof requirement: PASS');
console.log('Exception reason + explicit exception-resolution reassignment: PASS');
console.log('Idempotent lifecycle command boundary: PASS');
