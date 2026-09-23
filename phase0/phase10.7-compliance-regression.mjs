// Phase 10.7 — Compliance / Audit hardening regression checks.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = await mkdtemp(join(tmpdir(), 'sellify-phase10-7-compliance-'));
process.env.SELLIFY_DATA_DIR = dir;

const store = await import('../backend/lib/store-sqlite.js');
const user = await store.getOrCreateUserByTelegram('phase107-compliance-user', 'Compliance Test');
const tenantResult = await store.createTenantForUser({
  userId: user.id,
  sellerName: 'Compliance Test',
  country: 'ET',
  currency: 'ETB',
  timezone: 'Africa/Addis_Ababa',
});
const chatId = tenantResult.chatId;
const session = await store.createSession({ userId: user.id, chatId });
const tenant = await store.getTenant(chatId);

await store.recordAuditEvent({
  chatId,
  organizationId: tenant.organizationId,
  locationId: session.locationId,
  actorId: user.id,
  deviceId: session.deviceId,
  action: 'compliance.test',
  entityType: 'test',
  entityId: 'audit-1',
  reason: 'regression',
  result: 'success',
  metadata: { phase: '10.7' },
});

const events = await store.listAuditEvents(chatId, 20);
const event = events.find(e => e.action === 'compliance.test');
assert.ok(event);
assert.equal(event.actorId, user.id);
assert.equal(event.deviceId, session.deviceId);
assert.equal(event.locationId, session.locationId);
assert.equal(event.reason, 'regression');
assert.equal(event.result, 'success');

const { DatabaseSync } = await import('node:sqlite');
const database = new DatabaseSync(store.getDatabasePath());
assert.equal(database.prepare('SELECT COUNT(*) AS c FROM schema_migrations WHERE version = 11').get().c, 1);

const auditRow = database.prepare('SELECT id FROM audit_events WHERE action = ? ORDER BY id DESC LIMIT 1').get('compliance.test');
assert.throws(() => database.prepare('UPDATE audit_events SET action = ? WHERE id = ?').run('tampered', auditRow.id), /append-only/);
assert.throws(() => database.prepare('DELETE FROM audit_events WHERE id = ?').run(auditRow.id), /append-only/);

const policy = await store.setAuditRetentionPolicy(chatId, 730, session);
assert.equal(policy.retentionDays, 730);
assert.equal((await store.getAuditRetentionPolicy(chatId)).retentionDays, 730);

const customer = await store.upsertCustomer(chatId, {
  name: 'Compliance Customer',
  phone: '+251900000000',
});
const request = await store.createComplianceRequest(chatId, {
  requestType: 'DELETION',
  subjectType: 'customer',
  subjectId: customer.id,
  reason: 'privacy request',
}, session);
assert.equal(request.status, 'pending');
const resolved = await store.resolveComplianceRequest(chatId, request.id, 'approved', 'reviewed', session);
assert.equal(resolved.status, 'approved');
await assert.rejects(() => store.resolveComplianceRequest(chatId, request.id, 'rejected', 'invalid transition', session), /Invalid compliance request transition/);
const completed = await store.resolveComplianceRequest(chatId, request.id, 'completed', 'fulfilled', session);
assert.equal(completed.status, 'completed');
await assert.rejects(() => store.resolveComplianceRequest(chatId, request.id, 'approved', 'should fail', session), /Invalid compliance request transition/);

const exported = await store.buildComplianceExport(chatId, { subjectType: 'organization' });
assert.equal(exported.subject.type, 'organization');
assert.equal(exported.organization.id, tenant.organizationId);
assert.ok(Array.isArray(exported.customers));
assert.ok(Array.isArray(exported.orders));
assert.ok(Array.isArray(exported.auditEvents));
assert.ok(Array.isArray(exported.complianceRequests));
assert.ok(exported.complianceRequests.some(r => r.id === request.id && r.status === 'completed'));

database.close();
console.log('Phase 10.7 Compliance/Audit Regression: PASS');
await rm(dir, { recursive: true, force: true });
