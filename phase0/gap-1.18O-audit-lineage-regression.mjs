import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const source = readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');

assert.match(source, /GAP-1\.18O add tamper-evident audit chain|if \(!applied\.includes\(57\)\)/);
assert.match(source, /ALTER TABLE audit_events ADD COLUMN previous_hash/);
assert.match(source, /ALTER TABLE audit_events ADD COLUMN event_hash/);
assert.match(source, /ALTER TABLE audit_events ADD COLUMN lineage_type/);
assert.match(source, /ALTER TABLE audit_events ADD COLUMN lineage_id/);
assert.match(source, /crypto\.createHash\('sha256'\)/);
assert.match(source, /SELECT event_hash FROM audit_events WHERE organization_id = \? AND event_hash IS NOT NULL/);
assert.match(source, /previousHash/);
assert.match(source, /eventHash/);
assert.match(source, /lineageType: 'payment_evidence'/);
assert.match(source, /lineageType: 'payment_verification'/);
assert.match(source, /lineageType: 'payment_decision'/);
assert.match(source, /payment\.evidence\.recorded/);
assert.match(source, /payment\.verification\.recorded/);
assert.match(source, /evidenceId: input\.verification/);
assert.match(source, /verificationId: decisionVerificationId/);
assert.match(source, /provenanceSource: persistedVerification\.provenanceSource/);
assert.match(source, /provenanceOperation: persistedVerification\.provenanceOperation/);
assert.doesNotMatch(source, /const verifier = String\(v\.verifier \|\| 'payment-core'\)/);
assert.match(source, /decisionId/);
assert.match(source, /export async function verifyAuditEventChain/);

// Exercise the verifier against the real SQLite store, then deliberately alter
// one persisted audit field to prove the hash check detects tampering.
const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-gap1-18o-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');
try {
  const store = await import('../backend/lib/store-sqlite.js');
  const user = await store.getOrCreateUserByTelegram('gap1-18o-user', 'Audit Chain Test User');
  const tenant = await store.createTenantForUser({
    userId: user.id,
    sellerName: 'Audit Chain Test Store',
    businessType: 'retail',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  await store.recordAuditEvent({
    chatId: tenant.chatId,
    organizationId: tenant.organizationId,
    action: 'gap1-18o.audit-chain.test',
    entityType: 'regression',
    entityId: 'event-1',
    metadata: { sequence: 1 },
  });
  await store.recordAuditEvent({
    chatId: tenant.chatId,
    organizationId: tenant.organizationId,
    action: 'gap1-18o.audit-chain.test',
    entityType: 'regression',
    entityId: 'event-2',
    metadata: { sequence: 2 },
  });

  const intact = await store.verifyAuditEventChain(tenant.chatId);
  assert.equal(intact.valid, true);
  assert.ok(intact.eventsChecked >= 2);

  const directDb = new DatabaseSync(process.env.SELLIFY_DB_PATH);
  try {
    const row = directDb.prepare(
      'SELECT id FROM audit_events WHERE chat_id = ? AND action = ? ORDER BY id DESC LIMIT 1',
    ).get(String(tenant.chatId), 'gap1-18o.audit-chain.test');
    assert.ok(row);
    directDb.prepare('UPDATE audit_events SET metadata_json = ? WHERE id = ?')
      .run(JSON.stringify({ sequence: 'tampered' }), Number(row.id));
    const tampered = await store.verifyAuditEventChain(tenant.chatId);
    assert.equal(tampered.valid, false);
    assert.equal(tampered.invalidEventId, Number(row.id));
    assert.equal(tampered.reasonCode, 'AUDIT_EVENT_HASH_MISMATCH');
  } finally {
    directDb.close();
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log('GAP-1.18O audit lineage and tamper-detection regression passed');
