import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

const source = readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');

assert.match(source, /GAP-1\.18O add tamper-evident audit chain|if \(!applied\.includes\(57\)\)/);
assert.match(source, /ALTER TABLE audit_events ADD COLUMN previous_hash/);
assert.match(source, /ALTER TABLE audit_events ADD COLUMN event_hash/);
assert.match(source, /ALTER TABLE audit_events ADD COLUMN lineage_type/);
assert.match(source, /ALTER TABLE audit_events ADD COLUMN lineage_id/);
assert.match(source, /crypto\.createHash\('sha256'\)/);
assert.match(source, /export async function verifyAuditEventChain/);

// Use a fresh, durable SQLite database and exercise the existing payment
// evidence -> verification -> decision path rather than synthetic audit rows.
const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-gap1-18o-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const user = await store.getOrCreateUserByTelegram(
    `gap1-18o-user-${randomUUID()}`,
    'Audit Lineage Test User',
  );
  const tenant = await store.createTenantForUser({
    userId: user.id,
    sellerName: 'Audit Lineage Test Store',
    businessType: 'retail',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  const account = await store.createPaymentAccount(tenant.chatId, {
    providerId: 'manual',
    accountIdentifier: `GAP1.18O-${randomUUID()}`,
  });
  const created = await store.createPaymentWithIntent(tenant.chatId, {
    paymentAccountId: account.id,
    providerId: 'manual',
    channel: 'manual',
    amountMinor: 150000,
    currency: 'ETB',
    externalReference: `GAP1.18O-${randomUUID()}`,
    idempotencyKey: `gap1-18o-create-${randomUUID()}`,
  });
  const payment = created.payment;
  const intent = created.intent;
  const reference = `GAP1.18O-REF-${payment.id}`;
  const transactionId = `GAP1.18O-TX-${payment.id}`;

  const evidenceResult = await store.insertPaymentEvidence(tenant.chatId, {
    paymentId: payment.id,
    paymentIntentId: intent.id,
    providerId: payment.providerId,
    channel: 'manual',
    evidenceType: 'PROVIDER_STATUS',
    externalReference: reference,
    providerTransactionId: transactionId,
    rawPayload: {
      status: 'COMPLETED',
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      receiverAccount: account.accountIdentifier,
      reference,
      transactionId,
    },
    normalizedPayload: {
      result: 'MATCH',
      observedAmountMinor: payment.amountMinor,
      observedCurrency: payment.currency,
      observedReceiverAccount: account.accountIdentifier,
      observedReference: reference,
      observedTransactionId: transactionId,
    },
    source: 'provider.getStatus',
  });
  const evidence = evidenceResult.evidence;

  const verificationResult = await store.insertPaymentVerification(tenant.chatId, {
    paymentId: payment.id,
    paymentIntentId: intent.id,
    evidenceId: evidence.id,
    providerId: payment.providerId,
    result: 'MATCH',
    observedAmountMinor: payment.amountMinor,
    observedCurrency: payment.currency,
    observedReceiverAccount: account.accountIdentifier,
    observedReference: reference,
    observedTransactionId: transactionId,
    observedAt: new Date().toISOString(),
    reasonCodes: [],
    rawResult: { status: 'COMPLETED' },
    verifier: 'payment-core.gap-1.18o-test',
    verifierVersion: '1',
  });
  const verification = verificationResult.verification;

  const decisionResult = await store.commitPaymentDecision(tenant.chatId, {
    paymentId: payment.id,
    expectedState: 'UNPAID',
    targetState: 'VERIFIED',
    idempotencyKey: `gap1-18o-decision-${randomUUID()}`,
    verification: {
      ...verification,
      evidenceId: evidence.id,
      paymentIntentId: intent.id,
      providerId: payment.providerId,
      result: 'MATCH',
    },
    decision: {
      decision: 'ACCEPT',
      targetState: 'VERIFIED',
      reasonCodes: [],
      invariantResults: { passed: true },
      decisionSource: 'PAYMENT_CORE',
      entryType: 'VERIFIED',
    },
  });
  assert.ok(decisionResult);
  assert.equal((await store.getPayment(tenant.chatId, payment.id)).state, 'VERIFIED');

  const directDb = new DatabaseSync(process.env.SELLIFY_DB_PATH);
  try {
    const organizationId = String(payment.organizationId);
    const evidenceRow = directDb.prepare(
      'SELECT id, payment_id, organization_id FROM payment_evidence WHERE id = ? AND organization_id = ?',
    ).get(evidence.id, organizationId);
    const verificationRow = directDb.prepare(
      'SELECT id, payment_id, evidence_id, organization_id FROM payment_verifications WHERE id = ? AND organization_id = ?',
    ).get(verification.id, organizationId);
    const decisionRow = directDb.prepare(
      'SELECT id, payment_id, evidence_id, verification_id, organization_id FROM payment_decisions WHERE payment_id = ? AND organization_id = ? ORDER BY created_at DESC LIMIT 1',
    ).get(payment.id, organizationId);
    const transitionLedger = directDb.prepare(
      "SELECT id, from_state, to_state, decision_id FROM payment_ledger_entries WHERE payment_id = ? AND from_state = 'UNPAID' AND to_state = 'VERIFIED' ORDER BY created_at DESC LIMIT 1",
    ).get(payment.id);

    assert.ok(evidenceRow, 'real payment evidence must be persisted');
    assert.ok(verificationRow, 'real payment verification must be persisted');
    assert.ok(decisionRow, 'real payment decision must be persisted');
    assert.equal(evidenceRow.payment_id, payment.id);
    assert.equal(verificationRow.payment_id, payment.id);
    assert.equal(verificationRow.evidence_id, evidence.id);
    assert.equal(decisionRow.payment_id, payment.id);
    assert.equal(decisionRow.evidence_id, evidence.id);
    assert.equal(decisionRow.verification_id, verification.id);
    assert.ok(transitionLedger, 'canonical state transition must have a ledger entry');
    assert.equal(transitionLedger.from_state, 'UNPAID');
    assert.equal(transitionLedger.to_state, 'VERIFIED');
    assert.equal(transitionLedger.decision_id, decisionRow.id,
      'transition ledger must directly reference the exact persisted decision');

    const lineageEvents = directDb.prepare(
      `SELECT action, entity_type, entity_id, lineage_type, lineage_id, organization_id, chat_id
       FROM audit_events
       WHERE organization_id = ? AND (
         (lineage_type = 'payment_evidence' AND lineage_id = ?) OR
         (lineage_type = 'payment_verification' AND lineage_id = ?) OR
         (lineage_type = 'payment_decision' AND lineage_id = ?)
       ) ORDER BY id ASC`,
    ).all(organizationId, evidence.id, verification.id, decisionRow.id);

    const hasLineage = (type, id) => lineageEvents.some(event =>
      event.lineage_type === type && String(event.lineage_id) === String(id));
    assert.ok(hasLineage('payment_evidence', evidence.id), 'evidence audit event must reference persisted evidence');
    assert.ok(hasLineage('payment_verification', verification.id), 'verification audit event must reference persisted verification');
    assert.ok(hasLineage('payment_decision', decisionRow.id), 'decision audit event must reference persisted decision');
    assert.ok(lineageEvents.every(event => String(event.organization_id) === organizationId));
    assert.ok(lineageEvents.every(event => String(event.chat_id) === String(tenant.chatId)));

    const intact = await store.verifyAuditEventChain(tenant.chatId);
    assert.equal(intact.valid, true);
    assert.ok(intact.eventsChecked >= 3);

    // Simulate privileged database-level tampering that bypasses the normal
    // append-only guard; the verifier must still detect the broken hash.
    const row = directDb.prepare(
      'SELECT id FROM audit_events WHERE chat_id = ? ORDER BY id DESC LIMIT 1',
    ).get(String(tenant.chatId));
    assert.ok(row);
    directDb.exec('DROP TRIGGER IF EXISTS audit_events_no_update');
    directDb.prepare('UPDATE audit_events SET metadata_json = ? WHERE id = ?')
      .run(JSON.stringify({ tampered: true }), Number(row.id));
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

console.log('GAP-1.18O real payment audit lineage and tamper-detection regression passed');
