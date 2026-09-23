import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  FUX17_18_CONTRACT_VERSION,
  NOTIFICATION_TYPES,
  buildNotificationExperience,
  deduplicateNotifications,
  evaluateQuietPeriod,
  resolveNotificationPreference,
  buildNotificationAdapterContract,
  buildObservabilitySignal,
  buildOfflineQueueObservability,
  notificationObservabilityContract,
  assertNotificationObservabilityBoundary,
} from '../app/src/experience/notifications-observability-contract.js';

assert.equal(FUX17_18_CONTRACT_VERSION, '1.0');
assert.deepEqual(NOTIFICATION_TYPES, [
  'INFORMATIONAL', 'ACTION_REQUIRED', 'APPROVAL_REQUIRED',
  'FAILURE_RECOVERY', 'SECURITY', 'OPERATIONAL',
]);

const notification = buildNotificationExperience({
  id: 'n-1',
  organizationId: 'org-1',
  type: 'approval_required',
  priority: 'high',
  title: 'Approval required',
  body: 'Purchase order requires approval.',
  entityType: 'purchase_order',
  entityId: 'po-1',
  requiresAcknowledgement: true,
  deliveryState: 'delivered',
});
assert.equal(notification.type, 'APPROVAL_REQUIRED');
assert.equal(notification.priority, 'HIGH');
assert.equal(notification.actionRequired, true);
assert.equal(notification.requiresAcknowledgement, true);
assert.equal(notification.deduplicationKey, 'org-1:APPROVAL_REQUIRED:purchase_order:po-1');
assert.equal(notification.unknownIsSuccess, false);
assert.equal(notification.persistenceAuthority, null);

const unique = deduplicateNotifications([
  { id: 'a', organizationId: 'org-1', type: 'SECURITY', title: 'Session', entityType: 'session', entityId: 's-1' },
  { id: 'b', organizationId: 'org-1', type: 'SECURITY', title: 'Session duplicate', entityType: 'session', entityId: 's-1' },
  { id: 'c', organizationId: 'org-1', type: 'OPERATIONAL', title: 'Different', entityType: 'sync', entityId: 's-1' },
]);
assert.equal(unique.length, 2);

const quiet = evaluateQuietPeriod({ now: new Date('2026-09-20T23:30:00'), quietPeriod: { start: '22:00', end: '07:00' } });
assert.equal(quiet.active, true);
const allowed = resolveNotificationPreference({ type: 'SECURITY', enabled: true, quietPeriod: { start: '22:00', end: '07:00' }, now: new Date('2026-09-20T12:00:00') });
assert.equal(allowed.deliveryAllowed, true);
const suppressed = resolveNotificationPreference({ type: 'INFORMATIONAL', enabled: true, quietPeriod: { start: '22:00', end: '07:00' }, now: new Date('2026-09-20T23:30:00') });
assert.equal(suppressed.deliveryAllowed, false);

const adapter = buildNotificationAdapterContract({ provider: 'test-provider', persistence: 'none' });
assert.equal(adapter.deliveryOnly, true);
assert.equal(adapter.providerSchemaIsCanonical, false);
assert.equal(adapter.persistence, 'none');
assert.throws(() => buildNotificationAdapterContract({ provider: 'x', persistence: 'database' }), /persistence must be none/);
assert.throws(() => buildNotificationAdapterContract({ provider: 'x', ownsTelemetryBackend: true }), /forbidden authority claim/);

const signal = buildObservabilitySignal({
  signal: 'LATENCY',
  requestId: 'req-1',
  correlationId: 'corr-1',
  operation: 'order.create',
  capability: 'commerce.order.create',
  actorId: 'user-1',
  organizationId: 'org-1',
  status: 'SUCCESS',
  latencyMs: 125,
});
assert.equal(signal.correlationId, 'corr-1');
assert.equal(signal.latencyMs, 125);
assert.equal(signal.telemetryBackend, false);
assert.equal(signal.analyticsAuthority, false);
assert.throws(() => buildObservabilitySignal({ signal: 'ERROR', status: 'FAILURE', latencyMs: -1 }), /latencyMs/);

const queue = buildOfflineQueueObservability({ pending: 3, failed: 1, synced: 4 });
assert.equal(queue.signal, 'OFFLINE_QUEUE_DEPTH');
assert.equal(queue.status, 'FAILURE');

const contract = notificationObservabilityContract();
assert.equal(contract.notificationAuthority, 'canonical domain/event/audit sources');
assert.equal(contract.evidenceAuthority, 'existing event outbox + audit_events');
assert.equal(contract.offlineQueueAuthority, 'existing app/src/sync/outbox.js');
assert.equal(contract.telemetryBackend, false);
assert.equal(contract.duplicateEventStore, false);
assert.equal(contract.duplicateAuditStore, false);
assert.equal(contract.duplicateAnalyticsStore, false);
assert.equal(contract.duplicateMessagingAuthority, false);
assert.equal(assertNotificationObservabilityBoundary().version, '1.0');

const source = fs.readFileSync(new URL('../app/src/experience/notifications-observability-contract.js', import.meta.url), 'utf8');
assert.doesNotMatch(source, /CREATE TABLE|INSERT INTO|UPDATE\s+|DELETE FROM|DatabaseSync/);
assert.match(source, /existing event outbox and audit_events only/);
assert.match(source, /provider adapters/);

console.log('FUX-17/FUX-18 Notifications + Observability Regression: PASS');
console.log('Notification taxonomy + read/acknowledgement model: PASS');
console.log('Notification deduplication: PASS');
console.log('Preferences + quiet periods: PASS');
console.log('Provider adapter boundary: PASS');
console.log('Observability signal envelope: PASS');
console.log('Offline queue/sync observability mapping: PASS');
console.log('No duplicate event/audit/analytics/telemetry authority: PASS');
console.log('No direct persistence in experience contract: PASS');
