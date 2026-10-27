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
const fulfillmentReplayLookup = fulfillmentTransition.indexOf('const priorCommand = db.prepare');
assert.ok(fulfillmentReplayLookup >= 0
    && fulfillmentReplayLookup < fulfillmentTransition.indexOf('const freshCommandFingerprint')
    && fulfillmentReplayLookup < fulfillmentTransition.indexOf('assertServiceDeliveryReadyForExecution(freshOrderJson)'),
  'durable fulfillment retries must replay before mutable order fingerprint and readiness validation');
assert.match(fulfillmentTransition, /priorCommand\.server_order_id[\s\S]*?priorCommand\.command_fingerprint/,
  'durable fulfillment replay must reject key reuse across orders or changed command intent');
assert.match(fulfillmentTransition, /FULFILLMENT_REPLAY_STATE_MISSING/,
  'durable fulfillment replay must fail closed if its canonical result row is missing');
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
assert.match(store, /Array\.isArray\(proofInput\)/,
  'delivery completion must reject arrays instead of treating them as valid proof objects');
assert.match(store, /typeof proofInput !== 'string'/,
  'delivery completion must reject unsupported primitive proof values');
assert.match(store, /DELIVERY_PROOF_IMMUTABLE/);
assert.match(store, /proofReference/);
assert.match(store, /existingProof/);
assert.match(store, /EXCEPTION_REASON_REQUIRED/);
assert.match(store, /REASSIGN_EXCEPTION/);
assert.match(store, /EXCEPTION_NOT_FOUND/);
assert.match(store, /delivery\.assignment\.exception_resolved/);
assert.match(store, /REASSIGNMENT_TARGET_REQUIRED/);
assert.match(store, /if \(!applied\.includes\(72\)\)/,
  'service-delivery assessment idempotency history must use an additive migration');
assert.match(store, /CREATE TABLE IF NOT EXISTS service_delivery_assessment_commands/,
  'assessment command keys must be unique within an organization across orders');
const readinessStart = store.indexOf('function assertServiceDeliveryReadyForExecution(order)');
const readinessEnd = store.indexOf('export async function recordServiceDeliveryAssessment(', readinessStart);
assert.ok(readinessStart >= 0 && readinessEnd > readinessStart,
  'service-delivery execution readiness guard must remain explicit');
const readinessGuard = store.slice(readinessStart, readinessEnd);
assert.match(readinessGuard, /assessment\?\.outcome[\s\S]*?ELIGIBLE/,
  'fulfillment and courier assignment must require a canonical ELIGIBLE assessment, not only a status flag');
assert.match(readinessGuard, /customer_acceptance\?\.accepted === true/,
  'execution readiness must verify recorded customer acceptance');
assert.match(readinessGuard, /acceptedEvidenceTypes\.has\(evidenceType\)/,
  'execution readiness must reject unsupported customer acceptance evidence types');
assert.match(readinessGuard, /evidenceReference\.length >= 3[\s\S]*?evidenceReference\.length <= 200/,
  'execution readiness must validate the persisted evidence reference');
assert.match(readinessGuard, /delivery_model[\s\S]*?availability_confirmed === true[\s\S]*?availability_confirmation\?\.result === 'CONFIRMED'/,
  'instant delivery execution must require the persisted availability confirmation');
const serviceAssessmentStart = store.indexOf('export async function recordServiceDeliveryAssessment(');
const serviceAssessmentEnd = store.indexOf('function insertProduct(', serviceAssessmentStart);
assert.ok(serviceAssessmentStart >= 0 && serviceAssessmentEnd > serviceAssessmentStart,
  'canonical service-delivery assessment command must remain explicit');
const serviceAssessment = store.slice(serviceAssessmentStart, serviceAssessmentEnd);
assert.match(serviceAssessment, /FROM service_delivery_assessment_commands[\s\S]*?WHERE organization_id = \? AND command_key = \?/,
  'assessment retries must check organization-scoped durable command history');
assert.match(serviceAssessment, /INSERT INTO service_delivery_assessment_commands/,
  'successful assessments must persist durable command identity');
assert.ok(
  serviceAssessment.indexOf('const priorAssessmentCommand = db.prepare')
    < serviceAssessment.indexOf("if (request.assessment?.command_key === commandKey)"),
  'durable assessment key reuse must be resolved before the embedded per-order replay check',
);
assert.ok(
  serviceAssessment.indexOf('const priorAssessmentCommand = db.prepare')
    < serviceAssessment.indexOf("if (!request) throw Object.assign(new Error('Order is not a logistics service request')"),
  'assessment retries must replay before rejecting mutable canonical service-request state',
);
assert.match(serviceAssessment, /availability_confirmed: availabilityConfirmed,/,
  'assessment command identity must not change when the canonical delivery model changes after a committed command');
assert.doesNotMatch(
  serviceAssessment.slice(serviceAssessment.indexOf('const commandFingerprint ='), serviceAssessment.indexOf("db.exec('BEGIN IMMEDIATE')")),
  /availability_confirmed: deliveryModel === 'instant'/,
  'assessment replay fingerprint must not depend on mutable preflight delivery-model state',
);
assert.ok(
  serviceAssessment.indexOf('const priorAssessmentCommand = db.prepare')
    < serviceAssessment.indexOf("assertLogisticsSchedulingAuthorization(actor, organizationId, transactionLocationId, 'logistics:scheduling:request')"),
  'committed assessment retries must resolve durable command history before rechecking mutable caller authorization',
);
const assessmentCommandInsert = serviceAssessment.indexOf('INSERT INTO service_delivery_assessment_commands');
const assessmentCommit = serviceAssessment.indexOf("db.exec('COMMIT')", assessmentCommandInsert);
assert.ok(
  serviceAssessment.indexOf("db.exec('BEGIN IMMEDIATE')")
    < serviceAssessment.indexOf('const priorAssessmentCommand = db.prepare')
    && serviceAssessment.indexOf("db.prepare('UPDATE orders SET order_json = ?")
      < assessmentCommandInsert
    && assessmentCommandInsert >= 0
    && assessmentCommit > assessmentCommandInsert,
  'canonical assessment state and durable command identity must commit in the same transaction',
);
assert.ok(
  serviceAssessment.indexOf("db.exec('BEGIN IMMEDIATE')")
    < serviceAssessment.indexOf('const priorAssessmentCommand = db.prepare')
    && serviceAssessment.indexOf('const priorAssessmentCommand = db.prepare')
      < serviceAssessment.indexOf("assertLogisticsSchedulingAuthorization(actor, organizationId, transactionLocationId, 'logistics:scheduling:request')"),
  'assessment authorization must be rechecked inside the transaction for new commands, after durable replay lookup',
);
assert.ok(
  serviceAssessment.indexOf("db.exec('BEGIN IMMEDIATE')")
    < serviceAssessment.indexOf('const priorAssessmentCommand = db.prepare'),
  'assessment command replay must be resolved inside the write transaction',
);
assert.ok(
  serviceAssessment.indexOf('UPDATE orders SET order_json = ?')
    < serviceAssessment.indexOf('INSERT INTO service_delivery_assessment_commands')
    && serviceAssessment.indexOf('INSERT INTO service_delivery_assessment_commands')
      < serviceAssessment.lastIndexOf("db.exec('COMMIT')"),
  'canonical assessment state and durable command identity must commit atomically',
);
assert.ok(
  serviceAssessment.includes('assertLogisticsSchedulingAuthorization(actor, organizationId, transactionLocationId'),
  'assessment authorization must be rechecked against canonical location inside the transaction',
);
assert.match(store, /BEGIN IMMEDIATE/);
assert.match(store, /No unresolved delivery exception exists/);
assert.match(store, /UPDATE delivery_assignments SET status = \\'REASSIGNED\\'/);
assert.match(store, /delivery\.assignment\.reassigned/);
assert.match(store, /Target courier does not have an active logistics courier role/);
const exceptionResolutionStart = store.indexOf("if (normalizedAction === 'REASSIGN_EXCEPTION')");
const exceptionResolutionEnd = store.indexOf("  const transitions =", exceptionResolutionStart);
const exceptionResolution = store.slice(exceptionResolutionStart, exceptionResolutionEnd);
assert.match(exceptionResolution, /BEGIN IMMEDIATE[\s\S]*?const freshCourierGrants = db\.prepare/,
  'exception reassignment must revalidate target courier authorization inside the write transaction');
assert.ok(
  exceptionResolution.indexOf('const existingCommand = db.prepare') >= 0
    && exceptionResolution.indexOf('const freshCourierGrants = db.prepare') > exceptionResolution.indexOf('const existingCommand = db.prepare'),
  'committed exception reassignment retries must replay durable command history before rechecking mutable courier role',
);
assert.ok(
  exceptionResolution.indexOf('const existingCommand = db.prepare') < exceptionResolution.indexOf('if (!targetCourierId)'),
  'exception reassignment retries must resolve key reuse before validating a missing target courier',
);
assert.ok(
  exceptionResolution.indexOf('if (!targetCourierId)') < exceptionResolution.indexOf('const freshCourierGrants = db.prepare'),
  'new exception reassignment commands must require a target before checking its active courier role',
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
assert.ok(
  assignmentCreation.indexOf('const priorCommand = db.prepare') < assignmentCreation.indexOf('const selected = await selectDeliveryCourier'),
  'automatic courier retries must resolve durable command history before selecting a currently eligible courier',
);
const autoSelectionStart = assignmentCreation.indexOf('if (!selectedCourierUserId)');
const autoSelectionEnd = assignmentCreation.indexOf('const courier = db.prepare', autoSelectionStart);
assert.ok(autoSelectionStart >= 0 && autoSelectionEnd > autoSelectionStart,
  'automatic courier selection and subsequent role validation must remain explicit');
assert.ok(
  assignmentCreation.indexOf('requested_courier_user_id: selectedCourierUserId || null') < autoSelectionStart
    && assignmentCreation.indexOf('assignmentFingerprint = crypto.createHash', assignmentCreation.indexOf('db.exec(\'BEGIN IMMEDIATE\')')) < autoSelectionStart,
  'automatic assignment fingerprint must capture the caller intent before a courier is selected',
);
assert.equal(
  (assignmentCreation.match(/assignmentFingerprint = crypto\.createHash/g) || []).length,
  2,
  'assignment fingerprint must not be rewritten after automatic courier selection; retries replay the original command intent',
);
const courierSelectionStart = store.indexOf('export async function selectDeliveryCourier(');
const courierSelectionEnd = store.indexOf('export async function ', courierSelectionStart + 30);
assert.ok(courierSelectionStart >= 0 && courierSelectionEnd > courierSelectionStart,
  'canonical eligible-courier selection must remain explicit');
const courierSelection = store.slice(courierSelectionStart, courierSelectionEnd);
assert.match(courierSelection, /mr\.role_id = 'logistics_courier'/,
  'automatic selection must only consider active logistics-courier roles');
assert.match(courierSelection, /mr\.status = 'active'[\s\S]*?m\.status = 'active'/,
  'automatic selection must exclude inactive memberships and role grants');
assert.match(courierSelection, /da\.status IN \('ASSIGNED','ACCEPTED','OUT_FOR_DELIVERY'\)/,
  'automatic selection workload must count only active delivery assignments');
assert.match(courierSelection, /ORDER BY active_workload ASC, m\.user_id ASC/,
  'automatic selection must use deterministic workload and user-id tie-breaking');
assert.ok(
  assignmentCreation.indexOf("db.exec('BEGIN IMMEDIATE')") >= 0
    && assignmentCreation.indexOf("db.exec('BEGIN IMMEDIATE')") < assignmentCreation.indexOf('await selectDeliveryCourier'),
  'automatic courier selection and assignment creation must share one immediate write transaction');
assert.match(store, /CREATE UNIQUE INDEX idx_delivery_assignments_active_fulfillment[\s\S]*?WHERE status IN \('ASSIGNED','ACCEPTED','OUT_FOR_DELIVERY'\)/,
  'database must prevent concurrent commands from creating multiple active courier assignments for one fulfillment');
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
const courierMutationGuard = assignmentTransition.indexOf('const courierActor = actorRoles.includes(\'logistics_courier\')');
assert.ok(
  assignmentTransition.indexOf('const active = db.prepare') < courierMutationGuard
    && courierMutationGuard < assignmentTransition.indexOf('const current = String(active.status)'),
  'courier lifecycle mutations must revalidate current courier role and assignment ownership inside the write transaction');
assert.match(assignmentTransition, /FROM memberships m[\s\S]*?mr\.role_id = 'logistics_courier'/,
  'courier lifecycle mutation must re-read active courier membership inside the transaction');
assert.match(assignmentTransition, /String\(active\.courier_user_id\) !== actorUserId/,
  'courier lifecycle mutation must reject assignment ownership changes between route authorization and transaction');
assert.match(assignmentTransition, /COURIER_SCOPE_DENIED/,
  'courier lifecycle mutation must enforce current location-scoped courier role inside the transaction');
assert.ok(
  assignmentTransition.indexOf('const canonicalLocationId = freshOrderRow.location_id')
    < assignmentTransition.indexOf("if (normalizedAction === 'REASSIGNED')"),
  'canonical order location must be loaded before courier reassignment scope checks',
);
assert.match(assignmentTransition, /const locationId = canonicalLocationId \|\| active\.location_id \|\| order\.location_id \|\| null/,
  'normal reassignment must not let request input override canonical order location');
assert.match(assignmentTransition, /applyCoreFulfillmentInventoryConsequence\(String\(chatId\), updatedFulfillment, orderFromRow\(freshOrderRow\), actor\)/,
  'delivery completion inventory consequences must use the freshly revalidated canonical order');
const activeAssignmentLookup = assignmentTransition.indexOf('const active = db.prepare');
const deliveredTransactionStart = assignmentTransition.lastIndexOf("db.exec('BEGIN IMMEDIATE')", activeAssignmentLookup);
const deliveredCommit = assignmentTransition.indexOf("db.exec('COMMIT')", activeAssignmentLookup);
const deliveredRollback = assignmentTransition.indexOf("db.exec('ROLLBACK')", deliveredCommit);
const inventoryConsequenceWrite = assignmentTransition.indexOf('applyCoreFulfillmentInventoryConsequence', activeAssignmentLookup);
const deliveredAuditWrite = assignmentTransition.indexOf("delivery.assignment.delivered", activeAssignmentLookup);
const commandHistoryWrite = assignmentTransition.indexOf('INSERT INTO delivery_assignment_commands', activeAssignmentLookup);
assert.ok(
  deliveredTransactionStart >= 0
    && deliveredTransactionStart < activeAssignmentLookup
    && inventoryConsequenceWrite > activeAssignmentLookup
    && deliveredAuditWrite > inventoryConsequenceWrite
    && commandHistoryWrite > deliveredAuditWrite
    && deliveredCommit > commandHistoryWrite
    && deliveredRollback > deliveredCommit,
  'delivery state, inventory consequences, audit evidence and durable command history must remain inside one rollback-capable transaction',
);


const assessmentStart = store.indexOf('export async function recordServiceDeliveryAssessment(');
const assessmentEnd = store.indexOf('export async function ', assessmentStart + 40);
assert.ok(assessmentStart >= 0 && assessmentEnd > assessmentStart,
  'canonical service-delivery assessment must remain discoverable');
const assessmentTransition = store.slice(assessmentStart, assessmentEnd);
const assessmentReplayLookup = assessmentTransition.indexOf('const priorAssessmentCommand = db.prepare');
const assessmentLocationCheck = assessmentTransition.indexOf('LOGISTICS_ASSESSMENT_LOCATION_MISMATCH');
assert.ok(assessmentReplayLookup >= 0 && assessmentLocationCheck > assessmentReplayLookup,
  'durable assessment replay must be resolved before mutable canonical-location validation');
assert.ok(
  assessmentTransition.indexOf('if (priorAssessmentCommand)') < assessmentLocationCheck,
  'a committed assessment retry must not be rejected because canonical order location changed later',
);

const fulfillmentTransitionStart = store.indexOf('export async function transitionOrderFulfillment(');
const fulfillmentTransitionEnd = store.indexOf('export async function ', fulfillmentTransitionStart + 40);
assert.ok(fulfillmentTransitionStart >= 0 && fulfillmentTransitionEnd > fulfillmentTransitionStart,
  'canonical fulfillment transition must remain discoverable');
const fulfillmentTransitionBody = store.slice(fulfillmentTransitionStart, fulfillmentTransitionEnd);
const fulfillmentReplayCheck = fulfillmentTransitionBody.indexOf('const priorCommand = db.prepare');
const fulfillmentLocationCheck = fulfillmentTransitionBody.indexOf('FULFILLMENT_LOCATION_MISMATCH');
assert.ok(fulfillmentReplayCheck >= 0 && fulfillmentLocationCheck > fulfillmentReplayCheck,
  'durable fulfillment replay must be resolved before mutable canonical-location validation');
assert.ok(
  fulfillmentTransitionBody.indexOf('if (priorCommand)') < fulfillmentLocationCheck,
  'a committed fulfillment command replay must not be rejected because canonical location changed later',
);

assert.match(store, /delivery\.assignment\.delivered/);
assert.match(store, /applyCoreFulfillmentInventoryConsequence/);
const inventoryConsequenceStart = store.indexOf('function applyCoreFulfillmentInventoryConsequence(');
const inventoryConsequenceEnd = store.indexOf('export async function ', inventoryConsequenceStart + 30);
assert.ok(inventoryConsequenceStart >= 0 && inventoryConsequenceEnd > inventoryConsequenceStart,
  'canonical fulfillment inventory consequence helper must remain discoverable');
const inventoryConsequence = store.slice(inventoryConsequenceStart, inventoryConsequenceEnd);
assert.match(inventoryConsequence, /const quantitiesByProduct = new Map\(\)/,
  'duplicate order lines for the same product must be aggregated before stock is decremented');
assert.match(inventoryConsequence, /quantitiesByProduct\.set\(productId, \(quantitiesByProduct\.get\(productId\) \|\| 0\) \+ quantity\)/,
  'fulfillment inventory quantity must include every valid line for a product');
assert.match(inventoryConsequence, /for \(const \[productId, quantity\] of quantitiesByProduct\)/,
  'inventory movement must be emitted once per fulfillment/product using the aggregated quantity');
const inventoryEventReplayLookup = inventoryConsequence.indexOf("SELECT * FROM inventory_movements WHERE event_id = ?");
const inventoryStockCheck = inventoryConsequence.indexOf("FULFILLMENT_INSUFFICIENT_INVENTORY");
assert.ok(inventoryEventReplayLookup >= 0 && inventoryStockCheck > inventoryEventReplayLookup,
  'existing fulfillment inventory events must replay before current stock checks can reject a retry');
assert.match(inventoryConsequence, /FULFILLMENT_INVENTORY_REPLAY_CONFLICT/,
  'an existing event with a different canonical inventory intent must fail closed rather than silently replay');
assert.match(inventoryConsequence, /Number\(existing\.quantity\) === -quantity/,
  'inventory replay must verify the recorded movement quantity matches the aggregated order quantity');
assert.match(inventoryConsequence, /String\(existing\.location_id\) === locationId/,
  'inventory replay must verify the recorded location matches the canonical fulfillment location');
assert.match(store, /event_id TEXT NOT NULL UNIQUE/,
  'inventory event IDs must remain database-unique to prevent duplicate movements under retries');

assert.match(server, /method: 'PATCH'.*delivery-assignment/);
assert.match(server, /transitionDeliveryAssignment/);
assert.match(server, /logistics:deliveries:update_assigned/);
assert.match(server, /logistics:deliveries:reassign/);
assert.match(server, /Idempotency-Key is required/);

// Multi-location couriers may hold more than one active location-scoped grant.
// Ownership enforcement must evaluate all grants rather than an arbitrary first row.
const courierOwnershipStart = store.indexOf('export async function assertCourierOwnsDelivery(');
const courierOwnershipEnd = store.indexOf('export async function ', courierOwnershipStart + 40);
assert.ok(courierOwnershipStart >= 0 && courierOwnershipEnd > courierOwnershipStart,
  'courier ownership guard must remain explicit');
const courierOwnership = store.slice(courierOwnershipStart, courierOwnershipEnd);
assert.match(courierOwnership, /SELECT mr\.scope_type, mr\.scope_id[\s\S]*?\.all\(actorUserId, String\(chatId\)\)/,
  'courier ownership must load all active location-scoped role grants');
assert.match(courierOwnership, /memberships\.some\(membership =>[\s\S]*?membership\.scope_type !== 'LOCATION'[\s\S]*?membership\.scope_id[\s\S]*?assignment\.location_id/,
  'a matching location-scoped grant must authorize access even if another grant appears first');
assert.match(courierOwnership, /if \(!hasLocationAccess\)[\s\S]*?COURIER_SCOPE_DENIED/,
  'courier requests must still fail closed when no active grant covers the assigned location');

// All assignment paths must use the same all-grants location check. Cover initial
// assignment, normal reassignment, exception reassignment, and courier lifecycle.
const courierScopeHelperStart = store.indexOf('function hasCourierLocationGrant(');
const courierScopeHelperEnd = store.indexOf('export async function selectDeliveryCourier(', courierScopeHelperStart + 30);
assert.ok(courierScopeHelperStart >= 0 && courierScopeHelperEnd > courierScopeHelperStart,
  'shared courier location-grant predicate must remain explicit');
const courierScopeHelper = store.slice(courierScopeHelperStart, courierScopeHelperEnd);
assert.ok(courierScopeHelper.includes('memberships.some(')
    && courierScopeHelper.includes("membership.scope_type !== 'LOCATION'")
    && courierScopeHelper.includes('membership.scope_id')
    && courierScopeHelper.includes('locationId'),
  'shared courier location check must authorize any matching active grant');

const assignCourierStart = store.indexOf('export async function assignDeliveryCourier(');
const assignCourierEnd = store.indexOf('export async function listDeliveryAssignments(', assignCourierStart + 40);
assert.ok(assignCourierStart >= 0 && assignCourierEnd > assignCourierStart,
  'canonical initial courier assignment must remain explicit');
const assignCourierBody = store.slice(assignCourierStart, assignCourierEnd);
assert.ok(assignCourierBody.includes('.all(selectedCourierUserId, String(chatId))')
    && assignCourierBody.includes('hasCourierLocationGrant(couriers, locationId)'),
  'initial assignment must validate all active target courier grants');

const assignmentScopeTransitionStart = store.indexOf('export async function transitionDeliveryAssignment(');
const assignmentScopeTransitionEnd = store.indexOf('export async function ', assignmentScopeTransitionStart + 40);
assert.ok(assignmentScopeTransitionStart >= 0 && assignmentScopeTransitionEnd > assignmentScopeTransitionStart,
  'canonical delivery assignment transition must remain explicit');
const assignmentScopeTransitionBody = store.slice(assignmentScopeTransitionStart, assignmentScopeTransitionEnd);
assert.ok(assignmentScopeTransitionBody.includes('.all(actorUserId, String(chatId))')
    && assignmentScopeTransitionBody.includes('hasCourierLocationGrant(courierMemberships, assignedLocationId)'),
  'courier lifecycle commands must validate all active actor grants');
assert.ok(assignmentScopeTransitionBody.includes('freshCourierGrants')
    && assignmentScopeTransitionBody.includes('hasCourierLocationGrant(freshCourierGrants, locationId)'),
  'exception reassignment must validate all target courier grants');
assert.ok(assignmentScopeTransitionBody.includes('courierGrants')
    && assignmentScopeTransitionBody.includes('hasCourierLocationGrant(courierGrants, locationId)'),
  'normal reassignment must validate all target courier grants');

// Workload projection must honor every active courier location grant too.
// Fixing command authorization alone is insufficient if the courier cannot see
// their assignments for other valid locations.
const courierListStart = store.indexOf('export async function listDeliveryAssignments(');
const courierListEnd = store.indexOf('export async function getDeliveryAssignment(', courierListStart + 40);
assert.ok(courierListStart >= 0 && courierListEnd > courierListStart,
  'courier assignment listing must remain explicit');
const courierList = store.slice(courierListStart, courierListEnd);
assert.ok(courierList.includes('SELECT mr.scope_type, mr.scope_id')
    && courierList.includes('.all(actorUserId, String(chatId))'),
  'courier workload must load all active role grants');
assert.ok(courierList.includes("courierMemberships.some(membership => membership.scope_type !== 'LOCATION')"),
  'a broad active grant must preserve organization-level workload access');
assert.ok(courierList.includes('scopedLocations.includes(String(locationId))'),
  'requested location filters must be checked against every granted location');
assert.ok(courierList.includes("if (locationId) {") && courierList.includes("clauses.push('da.location_id = ?')"),
  'an allowed explicit location filter must narrow results to that location');
assert.ok(courierList.includes("da.location_id IN (${scopedLocations.map(() => '?').join(', ')})"),
  'courier workload must include all granted locations without exposing other branches');

console.log('GAP-2 Delivery Assignment Lifecycle Regression: PASS');
console.log('Assignment history + active-assignment uniqueness: PASS');
console.log('Courier accept/start/deliver authorization boundary: PASS');
console.log('Delivery proof requirement: PASS');
console.log('Exception reason + explicit exception-resolution reassignment: PASS');
console.log('Idempotent lifecycle command boundary: PASS');