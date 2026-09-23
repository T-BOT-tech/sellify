import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AUTHZ } from '../backend/lib/authorization.js';
import {
  isSensitiveVerticalAction,
  buildSensitiveActionAuditRecord,
  recordSensitiveActionAudit,
  sensitiveActionAuditBoundaryContract,
} from '../backend/lib/vertical-sensitive-audit-boundary.js';
import { buildAuditRecord, auditBoundaryContract } from '../app/src/audit/audit-boundary.js';

const session = {
  userId: 'user-audit-1', sessionId: 'session-audit-1', chatId: 'chat-audit-1',
  organizationId: 'org-audit-1', locationId: 'loc-audit-1', deviceId: 'device-audit-1', role: 'owner',
};
const tenant = { chatId: 'chat-audit-1', organizationId: 'org-audit-1' };
const location = { id: 'loc-audit-1', organizationId: 'org-audit-1' };

let pass = 0;
const check = async (name, fn) => { await fn(); pass += 1; console.log(`PASS ${name}`); };

await check('sensitive scope is limited to current mutation-capable manage actions', () => {
  assert.equal(isSensitiveVerticalAction('restaurant', 'table', 'manage'), true);
  assert.equal(isSensitiveVerticalAction('warehouse', 'storage', 'manage'), true);
  assert.equal(isSensitiveVerticalAction('restaurant', 'table', 'view'), false);
  assert.equal(isSensitiveVerticalAction('logistics', 'shipment', 'manage'), true);
});

await check('sensitive audit boundary preserves canonical authorities', () => {
  const contract = sensitiveActionAuditBoundaryContract();
  assert.equal(contract.audit_authority, 'existing backend audit_events / recordAuditEvent()');
  assert.equal(contract.authorization_authority, 'backend/lib/authorization.js');
  assert.equal(contract.registry_authority, 'backend/lib/resource-action-registry.js');
  assert.equal(contract.record_contract, 'app/src/audit/audit-boundary.js');
  assert.deepEqual(contract.sensitive_actions, ['manage']);
  assert.equal(contract.persistence, 'existing audit_events only');
  assert.equal(contract.audit_store, 'none');
  assert.equal(contract.event_store, 'none');
  assert.equal(contract.policy_authority, 'none');
});

await check('successful sensitive action creates canonical audit evidence', () => {
  const record = buildSensitiveActionAuditRecord({
    session, tenant, location,
    packId: 'restaurant', resource: 'table', action: 'manage',
    decision: AUTHZ.ALLOW, result: 'success', entityId: 'table-1',
    reason: 'table state changed', correlationId: 'corr-1', causationId: 'cause-1',
  });
  assert.equal(record.organization_id, 'org-audit-1');
  assert.equal(record.chat_id, 'chat-audit-1');
  assert.equal(record.location_id, 'loc-audit-1');
  assert.equal(record.actor_id, 'user-audit-1');
  assert.equal(record.action, 'vertical.restaurant.table.manage');
  assert.equal(record.entity_type, 'restaurant.table');
  assert.equal(record.entity_id, 'table-1');
  assert.equal(record.result, 'success');
  assert.equal(record.metadata.authorizationDecision, AUTHZ.ALLOW);
  assert.equal(record.correlation_id, 'corr-1');
});

await check('denied sensitive action can be represented as audit evidence', () => {
  const record = buildSensitiveActionAuditRecord({
    session, tenant, location,
    packId: 'warehouse', resource: 'stock_adjustment', action: 'manage',
    decision: AUTHZ.DENY, result: 'denied', reason: 'authorization denied',
  });
  assert.equal(record.result, 'denied');
  assert.equal(record.metadata.authorizationDecision, AUTHZ.DENY);
});

await check('rejected outcome can be represented without becoming authorization', () => {
  const record = buildSensitiveActionAuditRecord({
    session, tenant, location,
    packId: 'restaurant', resource: 'kitchen', action: 'manage',
    decision: AUTHZ.REQUIRES_APPROVAL, result: 'rejected', reason: 'approval rejected',
  });
  assert.equal(record.result, 'rejected');
  assert.equal(record.metadata.authorizationDecision, AUTHZ.REQUIRES_APPROVAL);
});

await check('existing audit persistence function is the only write path', () => {
  const record = buildSensitiveActionAuditRecord({
    session, tenant, location,
    packId: 'restaurant', resource: 'table', action: 'manage',
    decision: AUTHZ.ALLOW, result: 'success', entityId: 'table-2',
  });
  let persisted = null;
  const result = recordSensitiveActionAudit(record, (payload) => { persisted = payload; return 'audit-id-1'; });
  assert.equal(result, 'audit-id-1');
  assert.equal(persisted.organizationId, 'org-audit-1');
  assert.equal(persisted.action, 'vertical.restaurant.table.manage');
});

await check('non-sensitive view action does not produce a mutation audit record', () => {
  const record = buildSensitiveActionAuditRecord({
    session, tenant, location,
    packId: 'restaurant', resource: 'table', action: 'view',
    decision: AUTHZ.ALLOW, result: 'success',
  });
  assert.equal(record, null);
});

await check('unknown capability fails closed', () => {
  assert.throws(() => buildSensitiveActionAuditRecord({
    session, tenant, location,
    packId: 'restaurant', resource: 'unknown', action: 'manage',
    decision: AUTHZ.ALLOW, result: 'success',
  }), /Unknown vertical capability/);
});

await check('invalid decision fails closed', () => {
  assert.throws(() => buildSensitiveActionAuditRecord({
    session, tenant, location,
    packId: 'restaurant', resource: 'table', action: 'manage',
    decision: 'MAYBE', result: 'success',
  }), /decision is invalid/);
});

await check('invalid audit result fails closed', () => {
  assert.throws(() => buildSensitiveActionAuditRecord({
    session, tenant, location,
    packId: 'restaurant', resource: 'table', action: 'manage',
    decision: AUTHZ.ALLOW, result: 'unknown',
  }), /Audit result is invalid/);
});

await check('canonical audit boundary remains the persistence contract', () => {
  const contract = auditBoundaryContract();
  assert.equal(contract.audit_authority, 'existing backend audit_events / recordAuditEvent()');
  assert.equal(contract.persistence, 'existing audit_events only');
  assert.equal(contract.duplicate_audit_store, false);
});

await check('no second audit/authorization/event/configuration authority introduced', () => {
  const source = fs.readFileSync(path.resolve('backend/lib/vertical-sensitive-audit-boundary.js'), 'utf8');
  assert.doesNotMatch(source, /CREATE TABLE|INSERT INTO|UPDATE .*audit|DELETE FROM|ROLE_PERMISSIONS|RolePermissionStore|approvalStore|publishEvent|outbox|configStore/i);
  assert.match(source, /recordAudit\(record, persist\)/);
});

console.log('Phase 13.12.10 Sensitive-Action Audit Gate Regression: PASS');
console.log(`Golden assertions: ${pass} PASS / 0 FAIL`);
console.log('Sensitive mutation outcomes produce canonical audit evidence: PASS');
console.log('Denied / rejected outcomes remain auditable: PASS');
console.log('Existing audit_events / recordAuditEvent authority preserved: PASS');
console.log('No duplicate audit / authorization / event / configuration authority: BLOCKED');
