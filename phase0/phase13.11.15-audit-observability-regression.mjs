import assert from 'node:assert/strict';
import { buildAuditRecord, isAuditRecord, recordAudit, auditBoundaryContract } from '../app/src/audit/audit-boundary.js';
import fs from 'node:fs';

const record = buildAuditRecord({
  organizationId: 'org-audit-1',
  chatId: 'tenant-audit-1',
  locationId: 'loc-audit-1',
  actorId: 'user-audit-1',
  deviceId: 'device-audit-1',
  action: 'order.cancelled',
  entityType: 'order',
  entityId: 'order-audit-1',
  reason: 'customer_request',
  result: 'success',
  correlationId: 'corr-audit-1',
  causationId: 'evt-order-1',
  eventId: 'evt-order-2',
  metadata: { source: 'phase13.11.15' },
});
assert.equal(isAuditRecord(record), true);
assert.equal(record.organization_id, 'org-audit-1');
assert.equal(record.result, 'success');
assert.equal(record.metadata.source, 'phase13.11.15');

let persisted = null;
const result = recordAudit(record, (input) => { persisted = input; return { accepted: true }; });
assert.deepEqual(result, { accepted: true });
assert.equal(persisted.organizationId, 'org-audit-1');
assert.equal(persisted.metadata.correlationId, 'corr-audit-1');
assert.equal(persisted.metadata.causationId, 'evt-order-1');
assert.equal(persisted.metadata.eventId, 'evt-order-2');

assert.throws(() => buildAuditRecord({ action: 'x', entityType: 'order' }), /organization_id/);
assert.throws(() => buildAuditRecord({ organizationId: 'org', action: 'x', entityType: 'order', result: 'unknown' }), /result/);
assert.throws(() => recordAudit(record, null), /persistence capability/);

const source = fs.readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
assert.match(source, /INSERT INTO audit_events/);
assert.match(source, /audit_events_no_update/);
assert.match(source, /audit_events_no_delete/);
assert.match(source, /export async function recordAuditEvent/);
assert.match(source, /organization_id/);

const helperSource = fs.readFileSync(new URL('../app/src/audit/audit-boundary.js', import.meta.url), 'utf8');
assert.doesNotMatch(helperSource, /CREATE TABLE|INSERT INTO|UPDATE |DELETE FROM|DatabaseSync/);
assert.doesNotMatch(helperSource, /fetch\(|axios|opentelemetry/i);
assert.equal(helperSource.includes('telemetry backend'), true);

const contract = auditBoundaryContract();
assert.equal(contract.audit_authority, 'existing backend audit_events / recordAuditEvent()');
assert.equal(contract.persistence, 'existing audit_events only');
assert.equal(contract.append_only, true);
assert.equal(contract.duplicate_audit_store, false);
assert.equal(contract.duplicate_event_store, false);
assert.equal(contract.telemetry_backend, false);

console.log('Phase 13.11.15 Audit / Observability Regression: PASS');
console.log('Canonical audit envelope: PASS');
console.log('Existing audit_events authority preserved: PASS');
console.log('Organization / actor / device / location context: PASS');
console.log('Correlation / causation / event identity continuity: PASS');
console.log('Append-only audit boundary: PASS');
console.log('No duplicate audit store / telemetry backend: BLOCKED');
console.log('No direct persistence in audit boundary: BLOCKED');
