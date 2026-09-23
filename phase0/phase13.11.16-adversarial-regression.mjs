import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCancellationHandoff,
  buildReturnHandoff,
  transitionReturnHandoff,
  buildCancellationReturnContext,
  buildCancellationReturnEvent,
} from '../app/src/verticals/logistics/cancellation-return-contract.js';
import { buildUnifiedFulfillmentContext } from '../app/src/logistics/unified-fulfillment-contract.js';
import { buildVersionedEvent } from '../app/src/events/event-boundary.js';
import { decideEventReplay } from '../backend/lib/event-replay.js';
import { processEventIsolated } from '../backend/lib/event-failure-isolation.js';
import { AUTHZ, authorize } from '../backend/lib/authorization.js';
import { assertTenantScope, assertLocationScope, TENANT_SCOPE } from '../backend/lib/tenant-isolation.js';
import { buildAuditRecord, recordAudit } from '../app/src/audit/audit-boundary.js';
import { normalizeLogisticsReturn } from '../app/src/verticals/logistics/proof-return-contract.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const orderA = {
  id: 'ORDER-13.11.16-A',
  organization_id: 'org-A',
  location_id: 'loc-A',
  fulfillment_type: 'delivery',
  fulfillment_status: 'delivered',
  status: 'confirmed',
};
const orderB = { ...orderA, id: 'ORDER-13.11.16-B', organization_id: 'org-B', location_id: 'loc-B' };

// 1. Tenant crossing must fail before a cancellation or return can be composed.
assert.doesNotThrow(() => buildCancellationHandoff({ order: orderA, organizationId: 'org-A', locationId: 'loc-A' }));
assert.throws(() => buildCancellationHandoff({ order: orderA, organizationId: 'org-B', locationId: 'loc-B' }), /different organization/);
assert.throws(() => buildReturnHandoff({
  order: orderA,
  organizationId: 'org-A',
  locationId: 'loc-A',
  logisticsReturn: { id: 'RET-A', order_id: 'ORDER-WRONG', status: 'requested' },
}), /does not reference the Core Order/);

// 2. Unified fulfillment cannot reconcile foreign vertical projections.
const baseFulfillment = buildUnifiedFulfillmentContext({ order: orderA, organizationId: 'org-A', locationId: 'loc-A' });
assert.equal(baseFulfillment.order.order_id, orderA.id);
assert.throws(() => buildUnifiedFulfillmentContext({
  order: orderA,
  organizationId: 'org-A',
  locationId: 'loc-A',
  agriculture: { ...baseFulfillment, organization_id: 'org-B', order_id: orderA.id },
}), /Valid Agriculture fulfillment handoff is required/);

// 3. Return lifecycle must preserve Logistics authority and require explicit disposition.
const ret = normalizeLogisticsReturn({ id: 'RET-A', order_id: orderA.id, status: 'requested', reason: 'customer_request' });
const approved = transitionReturnHandoff({ current: ret, nextStatus: 'approved', order: orderA, organizationId: 'org-A', locationId: 'loc-A' });
const received = transitionReturnHandoff({ current: approved.return, nextStatus: 'in_transit', order: orderA, organizationId: 'org-A', locationId: 'loc-A' });
const finalReturn = transitionReturnHandoff({ current: received.return, nextStatus: 'received', order: orderA, organizationId: 'org-A', locationId: 'loc-A' });
assert.equal(finalReturn.inventory_disposition_required, true);
assert.equal(finalReturn.inventory_mutation, 'explicit_injected_capability_only');
assert.throws(() => transitionReturnHandoff({ current: finalReturn.return, nextStatus: 'approved', order: orderA, organizationId: 'org-A', locationId: 'loc-A' }), /Invalid return transition/);

// 4. Event boundary carries identity but does not create an unsupported consumer.
const cancellation = buildCancellationHandoff({ order: orderA, organizationId: 'org-A', locationId: 'loc-A', reason: 'customer_request' });
const cancelEvent = buildCancellationReturnEvent({ handoff: cancellation, eventId: 'evt-cancel-A', correlationId: 'corr-A' });
assert.equal(cancelEvent.organization_id, 'org-A');
assert.equal(cancelEvent.idempotency_key, 'evt-cancel-A');
assert.equal(cancelEvent.metadata.publish_supported, false);
assert.throws(() => buildCancellationReturnEvent({ handoff: cancellation, eventId: 'bad id' }), /event_id/);

// 5. Replay identity: exact duplicate is safe, changed payload is a conflict,
// including when object key ordering differs.
const first = {
  event_id: 'evt-replay-A', organization_id: 'org-A', event_type: 'inventory.movement.record',
  aggregate_type: 'inventory_movement', aggregate_id: 'move-A',
  payload_json: JSON.stringify({ quantity: 3, product_id: 'p-A', nested: { b: 2, a: 1 } }),
};
const incomingSame = {
  eventId: first.event_id, organizationId: first.organization_id, eventType: first.event_type,
  aggregateType: first.aggregate_type, aggregateId: first.aggregate_id,
  payload: { nested: { a: 1, b: 2 }, product_id: 'p-A', quantity: 3 },
};
assert.equal(decideEventReplay(first, incomingSame).decision, 'duplicate');
assert.equal(decideEventReplay(first, { ...incomingSame, payload: { quantity: 4 } }).decision, 'conflict');
assert.equal(decideEventReplay(first, { ...incomingSame, organizationId: 'org-B' }).decision, 'conflict');
assert.equal(decideEventReplay(null, incomingSame).decision, 'new');

// 6. Failure isolation: one failure is rejected without preventing a sibling.
const seen = [];
const failed = await processEventIsolated({ event_id: 'evt-fail-A' }, async () => { throw new Error('intentional adversarial failure'); });
const succeeded = await processEventIsolated({ event_id: 'evt-good-A' }, async (event) => { seen.push(event.event_id); return { ok: true }; });
assert.equal(failed.status, 'rejected');
assert.equal(failed.eventId, 'evt-fail-A');
assert.deepEqual(seen, ['evt-good-A']);
assert.equal(succeeded.ok, true);

// 7. Authorization and tenant/location scope cannot be bypassed by role.
const actor = { userId: 'user-A', chatId: 'tenant-A', organizationId: 'org-A', role: 'manager' };
const ownLocation = { id: 'loc-A', organizationId: 'org-A' };
const foreignLocation = { id: 'loc-B', organizationId: 'org-B' };
assert.equal(authorize(actor, 'org-A', ownLocation, 'inventory', 'inventory:view'), AUTHZ.ALLOW);
assert.equal(authorize(actor, 'org-B', ownLocation, 'inventory', 'inventory:view'), AUTHZ.DENY);
assert.equal(authorize(actor, 'org-A', foreignLocation, 'inventory', 'inventory:view'), AUTHZ.DENY);
assert.equal(assertTenantScope(actor, { chatId: 'tenant-A', organizationId: 'org-A' }).userId, 'user-A');
assert.equal(assertLocationScope(actor, { chatId: 'tenant-A', organizationId: 'org-A' }, ownLocation).id, 'loc-A');
assert.equal(TENANT_SCOPE.DENY, 'DENY');
assert.throws(() => assertTenantScope(actor, { chatId: 'tenant-B', organizationId: 'org-B' }), /not authorized/);
assert.throws(() => assertLocationScope(actor, { chatId: 'tenant-A', organizationId: 'org-A' }, foreignLocation), /not authorized/);

// 8. Audit records preserve tenant context and are immutable/persistence-neutral.
const audit = buildAuditRecord({ organizationId: 'org-A', chatId: 'tenant-A', locationId: 'loc-A', actorId: 'user-A', action: 'return.received', entityType: 'logistics_return', entityId: 'RET-A', correlationId: 'corr-A', eventId: 'evt-return-A' });
assert.equal(Object.isFrozen(audit), true);
let persistedAudit;
recordAudit(audit, (value) => { persistedAudit = value; return true; });
assert.equal(persistedAudit.organizationId, 'org-A');
assert.equal(persistedAudit.metadata.correlationId, 'corr-A');

// 9. Source-level authority locks: no duplicate persistence, shared batch
// transaction, route engine, or new domain authority may appear in this phase.
const server = read('backend/server.js');
const store = read('backend/lib/store-sqlite.js');
const replay = read('backend/lib/event-replay.js');
const isolation = read('backend/lib/event-failure-isolation.js');
const auditBoundary = read('app/src/audit/audit-boundary.js');
const logisticsDir = path.join(root, 'app/src/verticals/logistics');
const logisticsFiles = fs.readdirSync(logisticsDir).filter((name) => name.endsWith('.js'));
assert.match(server, /processEventIsolated\(event/);
assert.doesNotMatch(server, /BEGIN(?: IMMEDIATE)?[\s\S]{0,120}for \(const event of events\)/i);
assert.match(store, /BEGIN IMMEDIATE/);
assert.match(store, /ROLLBACK/);
assert.match(store, /SELECT \* FROM sync_events WHERE event_id = \?/);
assert.match(replay, /eventReplayFingerprint/);
assert.match(isolation, /processEventIsolated/);
assert.match(auditBoundary, /existing backend audit_events \/ recordAuditEvent\(\)/);
assert.doesNotMatch(auditBoundary, /CREATE TABLE|INSERT INTO|UPDATE |DELETE FROM|DatabaseSync|fetch\(/i);
for (const name of logisticsFiles) {
  const content = read(`app/src/verticals/logistics/${name}`);
  assert.doesNotMatch(content, /route[-_ ]?(engine|planner|optimizer)/i);
  assert.doesNotMatch(content, /maps?[-_ ]?(api|provider|sdk)/i);
  assert.doesNotMatch(content, /(?:^|\n)\s*(?:CREATE TABLE|INSERT INTO|UPDATE |DELETE FROM|DatabaseSync)/i);
}
const migration = read('app/src/storage/migration.js');
assert.doesNotMatch(migration, /cancellation_return|logistics_return|unified_fulfillment/i);

console.log('Phase 13.11.16 Adversarial Regression: PASS');
console.log('Cross-tenant cancellation / return boundary: BLOCKED');
console.log('Cross-pack fulfillment identity mismatch: BLOCKED');
console.log('Return lifecycle / explicit Inventory disposition: PASS');
console.log('Event identity / unsupported publication boundary: PASS');
console.log('Replay duplicate / conflict isolation: PASS');
console.log('One-event failure isolation / sibling continuation: PASS');
console.log('Authorization / location tenant crossing: BLOCKED');
console.log('Audit tenant context / persistence neutrality: PASS');
console.log('No shared batch transaction: BLOCKED');
console.log('No duplicate audit / replay / return / fulfillment authority: BLOCKED');
console.log('No route / dispatch implementation: BLOCKED');
