import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-gap1-11-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

const store = await import('../backend/lib/store-sqlite.js');
const { registerPaymentProvider, getPaymentProvider } = await import('../backend/lib/payments/provider-registry.js');
const { PaymentCore } = await import('../backend/lib/payments/payment-core.js');
const { InvariantGate } = await import('../backend/lib/payments/invariant-gate.js');
const { PaymentDecisionEngine } = await import('../backend/lib/payments/decision-engine.js');

let calls = 0;
registerPaymentProvider({
  id: 'telebirr',
  name: 'GAP-1.11 test Telebirr',
  capabilities: { getStatus: true },
  getStatus: async ({ payment }) => {
    calls += 1;
    await new Promise(resolve => setTimeout(resolve, 30));
    return {
      status: payment.metadata?.status || 'COMPLETED',
      transactionId: payment.metadata?.transactionId || `TX-${payment.id}`,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      receiverAccount: '251900123456',
      reference: payment.externalReference || `REF-${payment.id}`,
      observedAt: new Date().toISOString(),
    };
  },
}, { replace: true });

function core(storeOverrides = {}) {
  return new PaymentCore({
    store: {
      getPayment: store.getPayment,
      getPaymentIntent: store.getPaymentIntent,
      listPaymentAccounts: store.listPaymentAccounts,
      insertPaymentEvidence: store.insertPaymentEvidence,
      insertPaymentVerification: store.insertPaymentVerification,
      insertPaymentDecision: store.insertPaymentDecision,
      commitPaymentDecision: store.commitPaymentDecision,
      beginPaymentStatusQuery: store.beginPaymentStatusQuery,
      completePaymentStatusQuery: store.completePaymentStatusQuery,
      getPaymentIdempotency: store.getPaymentIdempotency,
      listPaymentEvidence: store.listPaymentEvidence,
      listPaymentVerifications: store.listPaymentVerifications,
      listPaymentDecisions: store.listPaymentDecisions,
      ...storeOverrides,
    },
    providerRegistry: { getPaymentProvider },
    invariantGate: new InvariantGate(),
    decisionEngine: new PaymentDecisionEngine(),
  });
}

async function setup(status = 'COMPLETED') {
  const user = await store.getOrCreateUserByTelegram(
    `gap1-11-user-${crypto.randomUUID()}`,
    'GAP1.11 Test User',
  );
  const tenant = await store.createTenantForUser({
    userId: user.id,
    sellerName: 'GAP1.11 Test Store',
    businessType: 'retail',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  const account = await store.createPaymentAccount(tenant.chatId, {
    providerId: 'telebirr',
    accountIdentifier: '251900123456',
    phone: '251900123456',
  });
  const result = await store.createPaymentWithIntent(tenant.chatId, {
    paymentAccountId: account.id,
    providerId: 'telebirr',
    channel: 'api',
    amountMinor: 150000,
    currency: 'ETB',
    externalReference: `REF-${crypto.randomUUID()}`,
    metadata: { status },
    idempotencyKey: `gap1-11-${crypto.randomUUID()}`,
  });
  return { chatId: tenant.chatId, payment: result.payment };
}

test('GAP-1.11 provider getStatus MATCH flows through evidence, invariants, decision and canonical ledger', async () => {
  const base = await setup('COMPLETED');
  const result = await core().queryStatus({
    chatId: base.chatId,
    paymentId: base.payment.id,
    actor: null,
    idempotencyKey: 'gap1-11-status-match-1',
  });

  assert.equal(result.supported, true);
  assert.equal(result.status, 'MATCH');
  assert.equal(result.payment.state, 'VERIFIED');
  assert.equal((await store.getPayment(base.chatId, base.payment.id)).state, 'VERIFIED');
  assert.equal(result.invariants.passed, true);
  assert.equal(result.decision.targetState, 'VERIFIED');
  assert.equal(result.evidence.evidenceType, 'PROVIDER_STATUS');

  const ledger = await store.listPaymentLedger(base.chatId, base.payment.id);
  assert.equal(ledger.length, 2);
  assert.deepEqual(ledger.map(entry => entry.entryType), ['CREATED', 'VERIFIED']);
  assert.equal(calls, 1);
});

test('GAP-1.24 direct Payment Core status queries require durable idempotency', async () => {
  const base = await setup('COMPLETED');
  const callsBefore = calls;
  const paymentCore = core();

  await assert.rejects(
    () => paymentCore.queryStatus({ chatId: base.chatId, paymentId: base.payment.id }),
    error => error.code === 'IDEMPOTENCY_KEY_REQUIRED',
  );
  assert.equal(calls, callsBefore, 'missing idempotency key must be rejected before provider access');

  const unwiredCore = core({
    beginPaymentStatusQuery: undefined,
    completePaymentStatusQuery: undefined,
  });
  await assert.rejects(
    () => unwiredCore.queryStatus({
      chatId: base.chatId,
      paymentId: base.payment.id,
      idempotencyKey: 'gap1-24-missing-durable-store-' + crypto.randomUUID(),
    }),
    error => error.code === 'PAYMENT_STATUS_QUERY_IDEMPOTENCY_UNAVAILABLE',
  );
  assert.equal(calls, callsBefore, 'a store without durable command tracking must fail closed');
});

test('GAP-1.24 exact status-query retry replays persisted result without another provider call', async () => {
  const base = await setup('COMPLETED');
  const command = {
    chatId: base.chatId,
    paymentId: base.payment.id,
    actor: null,
    idempotencyKey: 'gap1-24-status-replay-' + crypto.randomUUID(),
  };
  const paymentCore = core();
  const concurrent = await Promise.allSettled([
    paymentCore.queryStatus(command),
    paymentCore.queryStatus({ ...command }),
  ]);
  assert.equal(concurrent.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(concurrent.filter(item => item.status === 'rejected' && item.reason?.code === 'PAYMENT_STATUS_QUERY_IN_PROGRESS').length, 1);
  const first = concurrent.find(item => item.status === 'fulfilled').value;
  const callsAfterFirst = calls;
  const evidenceAfterFirst = await store.listPaymentEvidence(base.chatId, base.payment.id);
  const verificationsAfterFirst = await store.listPaymentVerifications(base.chatId, base.payment.id);
  const ledgerAfterFirst = await store.listPaymentLedger(base.chatId, base.payment.id);

  const replay = await paymentCore.queryStatus({ ...command });
  assert.equal(calls, callsAfterFirst, 'an exact retry must not call the provider again');
  assert.equal(replay.payment.id, first.payment.id);
  assert.equal(replay.payment.state, first.payment.state);
  assert.equal((await store.listPaymentEvidence(base.chatId, base.payment.id)).length, evidenceAfterFirst.length);
  assert.equal((await store.listPaymentVerifications(base.chatId, base.payment.id)).length, verificationsAfterFirst.length);
  assert.equal((await store.listPaymentLedger(base.chatId, base.payment.id)).length, ledgerAfterFirst.length);

  await assert.rejects(
    () => paymentCore.queryStatus({ ...command, query: { deliberatelyDifferent: true } }),
    error => error.code === 'IDEMPOTENCY_KEY_REUSE',
  );
  assert.equal(calls, callsAfterFirst, 'reusing the key with different input must be rejected before provider access');
});

test('GAP-1.24 recovers committed financial result when query-result persistence fails', async () => {
  const base = await setup('COMPLETED');
  let failCompletion = true;
  const paymentCore = core({
    completePaymentStatusQuery: async (...args) => {
      if (failCompletion) {
        failCompletion = false;
        throw new Error('simulated crash before status-query result persistence');
      }
      return store.completePaymentStatusQuery(...args);
    },
  });
  const command = {
    chatId: base.chatId,
    paymentId: base.payment.id,
    actor: null,
    idempotencyKey: 'gap1-24-crash-after-commit-' + crypto.randomUUID(),
  };
  const callsBefore = calls;

  await assert.rejects(() => paymentCore.queryStatus(command), /simulated crash/);
  assert.equal(calls - callsBefore, 1, 'the initial query must contact the provider exactly once');
  const ledgerAfterCrash = await store.listPaymentLedger(base.chatId, base.payment.id);
  assert.equal(ledgerAfterCrash.length, 2, 'the financial transition should already be committed');
  assert.equal(ledgerAfterCrash[1].entryType, 'VERIFIED');

  failCompletion = false;
  const recovered = await paymentCore.queryStatus({ ...command });
  assert.equal(recovered.payment.id, base.payment.id);
  assert.equal(recovered.payment.state, 'VERIFIED');
  assert.equal(recovered.status, 'MATCH');
  assert.ok(recovered.evidence?.id);
  assert.ok(recovered.verification?.id);
  assert.equal(recovered.decision.targetState, 'VERIFIED');
  assert.equal(calls - callsBefore, 1, 'recovery must not contact the provider again');
  assert.equal((await store.listPaymentLedger(base.chatId, base.payment.id)).length, 2,
    'recovery must not repeat the financial transition');

  const evidenceCount = (await store.listPaymentEvidence(base.chatId, base.payment.id)).length;
  const verificationCount = (await store.listPaymentVerifications(base.chatId, base.payment.id)).length;
  const replay = await paymentCore.queryStatus({ ...command });
  assert.equal(replay.payment.state, 'VERIFIED');
  assert.equal(calls - callsBefore, 1, 'completed recovery must replay the persisted result');
  assert.equal((await store.listPaymentEvidence(base.chatId, base.payment.id)).length, evidenceCount);
  assert.equal((await store.listPaymentVerifications(base.chatId, base.payment.id)).length, verificationCount);
  assert.equal((await store.listPaymentLedger(base.chatId, base.payment.id)).length, 2);
});

test('GAP-1.24 fresh status observations do not duplicate an unchanged financial ledger transition', async () => {
  const base = await setup('COMPLETED');
  const paymentCore = core();
  const first = await paymentCore.queryStatus({
    chatId: base.chatId,
    paymentId: base.payment.id,
    actor: null,
    idempotencyKey: 'gap1-24-first-observation-' + crypto.randomUUID(),
  });
  assert.equal(first.payment.state, 'VERIFIED');
  const ledgerAfterFirst = await store.listPaymentLedger(base.chatId, base.payment.id);
  assert.equal(ledgerAfterFirst.length, 2);
  assert.equal(ledgerAfterFirst[1].fromState, 'UNPAID');
  assert.equal(ledgerAfterFirst[1].toState, 'VERIFIED');

  const second = await paymentCore.queryStatus({
    chatId: base.chatId,
    paymentId: base.payment.id,
    actor: null,
    idempotencyKey: 'gap1-24-second-observation-' + crypto.randomUUID(),
  });
  assert.equal(second.payment.state, 'VERIFIED');
  const ledgerAfterSecond = await store.listPaymentLedger(base.chatId, base.payment.id);
  assert.equal(ledgerAfterSecond.length, 2,
    'a new provider observation that reaffirms VERIFIED must not create another financial transition');
  assert.equal(ledgerAfterSecond[1].fromState, 'UNPAID');
  assert.equal(ledgerAfterSecond[1].toState, 'VERIFIED');
});

test('GAP-1.24 recovers committed expiry decision when query-result persistence fails', async () => {
  const base = await setup('EXPIRED');
  let failCompletion = true;
  const paymentCore = core({
    completePaymentStatusQuery: async (...args) => {
      if (failCompletion) {
        failCompletion = false;
        throw new Error('simulated crash after expiry decision commit');
      }
      return store.completePaymentStatusQuery(...args);
    },
  });
  const command = {
    chatId: base.chatId,
    paymentId: base.payment.id,
    actor: null,
    idempotencyKey: 'gap1-24-expiry-recovery-' + crypto.randomUUID(),
  };
  const callsBefore = calls;

  await assert.rejects(() => paymentCore.queryStatus(command), /simulated crash after expiry decision commit/);
  assert.equal((await store.getPayment(base.chatId, base.payment.id)).state, 'EXPIRED');
  const ledgerAfterCommit = await store.listPaymentLedger(base.chatId, base.payment.id);
  assert.equal(ledgerAfterCommit.length, 2);
  assert.equal(ledgerAfterCommit[1].entryType, 'EXPIRED');

  failCompletion = false;
  const recovered = await paymentCore.queryStatus({ ...command });
  assert.equal(recovered.payment.state, 'EXPIRED');
  assert.equal(recovered.status, 'EXPIRED');
  assert.equal(recovered.decision.targetState, 'EXPIRED');
  assert.equal(calls - callsBefore, 1, 'recovery must not query the provider again');
  assert.equal((await store.listPaymentLedger(base.chatId, base.payment.id)).length, 2,
    'recovery must not duplicate the expiry transition');
});

test('GAP-1.24 leaves pre-commit crash unresolved instead of replaying blindly', async () => {
  const base = await setup('COMPLETED');
  const callsBefore = calls;
  const paymentCore = core({
    commitPaymentDecision: async () => {
      throw new Error('simulated process crash before financial decision commit');
    },
    completePaymentStatusQuery: async () => {
      throw new Error('simulated process crash prevents command completion persistence');
    },
  });
  const command = {
    chatId: base.chatId,
    paymentId: base.payment.id,
    actor: null,
    idempotencyKey: 'gap1-24-crash-before-commit-' + crypto.randomUUID(),
  };

  await assert.rejects(
    () => paymentCore.queryStatus(command),
    /simulated process crash before financial decision commit/,
  );
  assert.equal(calls - callsBefore, 1);
  assert.equal((await store.getPayment(base.chatId, base.payment.id)).state, 'UNPAID');
  assert.equal((await store.listPaymentLedger(base.chatId, base.payment.id)).length, 1);
  assert.equal((await store.listPaymentVerifications(base.chatId, base.payment.id)).length, 0);
  assert.equal((await store.listPaymentDecisions(base.chatId, base.payment.id)).length, 0);

  await assert.rejects(
    () => paymentCore.queryStatus({ ...command }),
    error => error.code === 'PAYMENT_STATUS_QUERY_IN_PROGRESS',
  );
  assert.equal(calls - callsBefore, 1, 'uncertain recovery must not re-query the provider automatically');
  assert.equal((await store.getPayment(base.chatId, base.payment.id)).state, 'UNPAID');
  assert.equal((await store.listPaymentLedger(base.chatId, base.payment.id)).length, 1);
});

test('GAP-1.24A persisted evidence, verification, and decision records are append-only', async () => {
  const base = await setup('COMPLETED');
  const result = await core().queryStatus({
    chatId: base.chatId,
    paymentId: base.payment.id,
    actor: null,
    idempotencyKey: 'gap1-24a-append-only-' + crypto.randomUUID(),
  });
  assert.equal(result.payment.state, 'VERIFIED');

  const evidenceRows = await store.listPaymentEvidence(base.chatId, base.payment.id);
  const verificationRows = await store.listPaymentVerifications(base.chatId, base.payment.id);
  const decisionRows = await store.listPaymentDecisions(base.chatId, base.payment.id);
  assert.ok(evidenceRows.length > 0);
  assert.ok(verificationRows.length > 0);
  assert.ok(decisionRows.length > 0);

  const directDb = new DatabaseSync(process.env.SELLIFY_DB_PATH);
  try {
    directDb.exec('PRAGMA foreign_keys = ON');
    assert.throws(
      () => directDb.prepare('UPDATE payment_evidence SET raw_payload_json = raw_payload_json WHERE id = ?').run(evidenceRows[0].id),
      /payment_evidence is append-only/,
    );
    assert.throws(
      () => directDb.prepare('UPDATE payment_verifications SET result = result WHERE id = ?').run(verificationRows[0].id),
      /payment_verifications are append-only/,
    );
    assert.throws(
      () => directDb.prepare('UPDATE payment_decisions SET decision = decision WHERE id = ?').run(decisionRows[0].id),
      /payment_decisions are append-only/,
    );

    // GAP-1.24B: append-only means direct deletion must be blocked as well.
    assert.throws(
      () => directDb.prepare('DELETE FROM payment_evidence WHERE id = ?').run(evidenceRows[0].id),
      /payment_evidence is append-only/,
    );
    assert.throws(
      () => directDb.prepare('DELETE FROM payment_verifications WHERE id = ?').run(verificationRows[0].id),
      /payment_verifications are append-only/,
    );
    assert.throws(
      () => directDb.prepare('DELETE FROM payment_decisions WHERE id = ?').run(decisionRows[0].id),
      /payment_decisions are append-only/,
    );

    // Parent deletion must not bypass child append-only triggers through FK cascades.
    assert.throws(
      () => directDb.prepare('DELETE FROM payments WHERE id = ?').run(base.payment.id),
      /append-only/,
    );
    assert.ok(
      directDb.prepare('SELECT id FROM payments WHERE id = ?').get(base.payment.id),
      'a payment with immutable evidence lineage must not be deleted by cascade',
    );
  } finally {
    directDb.close();
  }
});

test('GAP-1.11 unknown/pending provider status never becomes payment success', async () => {
  const base = await setup('PENDING');
  const result = await core().queryStatus({
    chatId: base.chatId,
    paymentId: base.payment.id,
    actor: null,
    idempotencyKey: 'gap1-11-status-pending-1',
  });

  assert.equal(result.supported, true);
  assert.equal(result.status, 'UNKNOWN');
  assert.equal(result.decision.decision, 'RETRY_VERIFICATION');
  assert.equal(result.decision.targetState, null);
  assert.equal(result.payment.state, 'UNPAID');

  const ledger = await store.listPaymentLedger(base.chatId, base.payment.id);
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].entryType, 'CREATED');

  const verifications = await store.listPaymentVerifications(base.chatId, base.payment.id);
  assert.equal(verifications.length, 1);
  assert.equal(verifications[0].result, 'PENDING');
});

test('GAP-1.24 concurrent recovery after committed transition returns one canonical result', async () => {
  const base = await setup('COMPLETED');
  let failCompletion = true;
  let recoveryBarrierEnabled = false;
  let recoveryArrivals = 0;
  let releaseRecovery;
  const recoveryGate = new Promise(resolve => { releaseRecovery = resolve; });
  const paymentCore = core({
    completePaymentStatusQuery: async (...args) => {
      if (failCompletion) {
        failCompletion = false;
        throw new Error('simulated crash after financial commit');
      }
      return store.completePaymentStatusQuery(...args);
    },
    getPaymentIdempotency: async (...args) => {
      if (recoveryBarrierEnabled) {
        recoveryArrivals += 1;
        if (recoveryArrivals === 2) releaseRecovery();
        await recoveryGate;
      }
      return store.getPaymentIdempotency(...args);
    },
  });
  const command = {
    chatId: base.chatId,
    paymentId: base.payment.id,
    actor: null,
    idempotencyKey: 'gap1-24-concurrent-recovery-' + crypto.randomUUID(),
  };
  const callsBefore = calls;

  await assert.rejects(() => paymentCore.queryStatus(command), /simulated crash after financial commit/);
  assert.equal((await store.getPayment(base.chatId, base.payment.id)).state, 'VERIFIED');
  assert.equal((await store.listPaymentLedger(base.chatId, base.payment.id)).length, 2);

  recoveryBarrierEnabled = true;
  const recovered = await Promise.all([
    paymentCore.queryStatus({ ...command }),
    paymentCore.queryStatus({ ...command }),
  ]);
  recoveryBarrierEnabled = false;

  assert.equal(recoveryArrivals, 2, 'both retries should exercise the committed-recovery path');
  assert.equal(recovered.length, 2);
  assert.ok(recovered.every(result => result.payment.state === 'VERIFIED'));
  assert.ok(recovered.every(result => result.decision.targetState === 'VERIFIED'));
  assert.equal(calls - callsBefore, 1, 'concurrent recovery must not query the provider again');
  assert.equal((await store.listPaymentLedger(base.chatId, base.payment.id)).length, 2,
    'concurrent recovery must not duplicate the committed financial transition');
  const commandRow = await store.beginPaymentStatusQuery(base.chatId, {
    paymentId: base.payment.id,
    idempotencyKey: command.idempotencyKey,
    requestHash: 'not-the-real-hash',
  }).catch(error => error);
  assert.equal(commandRow?.code, 'IDEMPOTENCY_KEY_REUSE',
    'recovery must leave one completed command bound to its original request fingerprint');
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});
