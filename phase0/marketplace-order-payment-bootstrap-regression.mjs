import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-marketplace-payment-bootstrap-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');
process.env.SELLIFY_BACKUP_DIR = path.join(tempDir, 'backups');
process.env.NODE_ENV = 'test';

let child;
let output = '';
const localValues = new Map();
globalThis.localStorage = {
  getItem(key) { return localValues.has(key) ? localValues.get(key) : null; },
  setItem(key, value) { localValues.set(key, String(value)); },
  removeItem(key) { localValues.delete(key); },
  clear() { localValues.clear(); },
};

function makeElement() {
  return {
    style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    children: [], className: '', innerHTML: '', textContent: '', value: '',
    appendChild(node) { this.children.push(node); return node; },
    insertBefore(node) { this.children.push(node); return node; },
    remove() {}, setAttribute() {}, getAttribute() { return null; },
    addEventListener() {}, removeEventListener() {}, querySelector() { return null; },
    querySelectorAll() { return []; }, replaceChildren() { this.children = []; },
    focus() {},
  };
}
const essentialElements = new Map(['brandName', 'statusPill', 'statusText', 'queueBadge', 'catalogList'].map(id => [id, makeElement()]));
globalThis.document = {
  documentElement: makeElement(),
  body: makeElement(),
  title: 'Sellify test',
  getElementById(id) { return essentialElements.get(id) || null; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  addEventListener() {},
  removeEventListener() {},
  createElement() { return makeElement(); },
};
globalThis.window = {
  document: globalThis.document,
  localStorage: globalThis.localStorage,
  location: { origin: 'http://127.0.0.1' },
  addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
};

async function freePort() {
  const server = createNetServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function waitForHealth(baseUrl) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error('Backend exited before payment bootstrap regression: ' + output);
    }
    try {
      const response = await fetch(baseUrl + '/health');
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Backend did not become healthy: ' + output);
}

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const user = await store.getOrCreateUserByTelegram(
    'marketplace-payment-bootstrap-' + Date.now(),
    'Marketplace Payment Bootstrap Regression',
  );
  const tenant = await store.createTenantForUser({
    userId: user.id,
    sellerName: 'Marketplace Payment Bootstrap Store',
    businessType: 'retail',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  const session = await store.createSession({
    userId: user.id,
    chatId: tenant.chatId,
    deviceName: 'Marketplace payment bootstrap regression',
  });
  await store.saveCatalog(tenant.chatId, [{
    id: 'bootstrap-service',
    name: 'Bootstrap Service',
    price: 2500,
    item_type: 'service',
    marketplace_listed: true,
  }]);
  const account = await store.createPaymentAccount(tenant.chatId, {
    providerId: 'manual',
    accountIdentifier: 'BOOTSTRAP-' + Date.now(),
  }, { userId: user.id, deviceId: session.deviceId });
  await store.upsertPaymentRoutingPolicy(tenant.chatId, {
    channel: 'manual',
    providerId: 'manual',
    priority: 10,
    status: 'ACTIVE',
    currencies: ['ETB'],
    requiredCapabilities: [],
    reason: 'First merchant marketplace payment bootstrap regression',
  }, { userId: user.id, deviceId: session.deviceId });

  const port = await freePort();
  const baseUrl = 'http://127.0.0.1:' + port;
  window.location.origin = baseUrl;
  child = spawn(process.execPath, ['backend/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      CORS_ALLOWED_ORIGINS: baseUrl,
      RATE_LIMIT_MAX_WRITES: '500',
      RATE_LIMIT_MAX_READS: '1000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
  await waitForHealth(baseUrl);

  const checkout = await store.createMarketplaceOrder({
    buyer_id: 'marketplace-payment-bootstrap-buyer',
    buyer_identity: 'marketplace-payment-bootstrap-buyer',
    customer_name: 'Marketplace Bootstrap Buyer',
    items: [{ seller_id: tenant.chatId, item_id: 'bootstrap-service', qty: 1 }],
    idempotency_key: 'marketplace-payment-bootstrap-checkout',
  });
  const canonicalOrder = (await store.getOrders(tenant.chatId)).find(order =>
    order.marketplace_order_id === checkout.marketplace_order_id);
  assert.ok(canonicalOrder?.server_order_id, 'marketplace checkout must create the canonical seller order');

  const state = await import('../app/src/state.js');
  state.setConfig({
    ...state.config,
    chatId: tenant.chatId,
    tenantId: tenant.chatId,
    sessionToken: session.token,
    sessionExpiresAt: session.expiresAt,
    syncUrl: baseUrl,
    currencyCode: 'ETB',
    sellerName: tenant.sellerName,
  });
  state.setOrders([]);

  const { syncOrders } = await import('../app/src/sync/orders.js');
  const {
    submitPaymentEvidence,
    listPaymentEvidence,
    submitManualPaymentEvidenceReview,
    getOrderPaymentSummary,
  } = await import('../app/src/payments/client.js');
  await syncOrders();

  const db = store.getDatabaseForTests();
  const firstPayments = db.prepare(
    'SELECT id, state, amount_minor, currency, order_id FROM payments WHERE organization_id = ? AND order_id = ?'
  ).all(String(session.organizationId), String(canonicalOrder.server_order_id));
  assert.equal(firstPayments.length, 1,
    'pulling a marketplace seller order must create one canonical Payment Core payment when a route is eligible');
  assert.equal(firstPayments[0].state, 'UNPAID',
    'payment bootstrap must not infer buyer payment or verification from marketplace checkout');
  assert.equal(Number(firstPayments[0].amount_minor), 2500);
  assert.equal(firstPayments[0].currency, 'ETB');

  const initialSummary = await getOrderPaymentSummary(canonicalOrder.server_order_id);
  assert.equal(initialSummary.summary.status, 'UNPAID');
  assert.equal(Number(initialSummary.summary.outstandingMinor), 2500,
    'canonical order payment summary must report the full obligation outstanding before verification');

  const payment = await store.getPayment(tenant.chatId, firstPayments[0].id);
  const unpaidRefundResponse = await fetch(
    baseUrl + '/tenants/' + encodeURIComponent(tenant.chatId) + '/payments/' + encodeURIComponent(payment.id) + '/refund',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + session.token,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'marketplace-unpaid-refund-guard',
      },
      body: JSON.stringify({
        idempotencyKey: 'marketplace-unpaid-refund-guard',
        amountMinor: 100,
        currency: 'ETB',
        reason: 'Regression: an unpaid payment must not be refunded.',
      }),
    },
  );
  assert.equal(unpaidRefundResponse.status, 409,
    'refund command against an unpaid payment must fail closed through Payment Core');
  assert.equal((await unpaidRefundResponse.json()).error?.code, 'PAYMENT_NOT_REFUNDABLE');

  const allocation = db.prepare(
    'SELECT payment_id, status, amount_minor FROM marketplace_payment_allocations WHERE marketplace_order_id = ?'
  ).get(String(checkout.marketplace_order_id));
  assert.equal(allocation.payment_id, firstPayments[0].id,
    'new Payment Core payment must link to the existing marketplace allocation');
  assert.equal(Number(allocation.amount_minor), 2500);
  const settlement = db.prepare(
    'SELECT status FROM marketplace_settlements WHERE marketplace_order_id = ?'
  ).get(String(checkout.marketplace_order_id));
  assert.equal(settlement.status, 'PENDING',
    'payment creation alone must not make marketplace settlement ready');

  assert.equal(payment.state, 'UNPAID');
  assert.ok(payment.paymentIntentId, 'Payment Core bootstrap must expose its canonical intent');
  const evidenceReference = 'MARKETPLACE-RECEIPT-' + Date.now();
  const submitted = await submitPaymentEvidence({
    paymentId: payment.id,
    paymentIntentId: payment.paymentIntentId,
    providerId: payment.providerId,
    channel: 'sms',
    evidenceType: 'SMS_TEXT',
    externalReference: evidenceReference,
    payload: { text: 'Payment received ETB 25.00. Reference ' + evidenceReference },
  });
  assert.equal(submitted.status, 'RECEIVED');
  assert.equal(submitted.verificationStatus, 'NOT_PERFORMED');
  assert.equal(submitted.paymentStateMutated, false);
  const evidenceRows = await listPaymentEvidence(payment.id);
  const evidence = evidenceRows.find(row => row.id === submitted.evidence?.id);
  assert.ok(evidence, 'merchant evidence list must expose the submitted evidence on the canonical payment');
  assert.equal(evidence.status, 'RECEIVED');
  assert.equal((await store.getPayment(tenant.chatId, payment.id)).state, 'UNPAID',
    'SMS evidence intake alone must not mutate canonical payment state');

  const reviewInput = {
    outcome: 'CONFIRM',
    reason: 'Independently matched the receiving account and transaction reference.',
    attestation: true,
    observedAmountMinor: 2500,
    observedCurrency: 'ETB',
    observedReceiverAccount: account.accountIdentifier,
    observedReference: evidenceReference,
    observedAt: new Date().toISOString(),
  };
  const review = await submitManualPaymentEvidenceReview(
    payment.id,
    evidence.id,
    reviewInput,
    { idempotencyKey: 'marketplace-order-manual-review-1' },
  );
  assert.equal(review.finalized, true,
    'authorized manual review must finalize through the canonical Payment Core decision path: '
      + JSON.stringify({
        status: review.status,
        reasonCodes: review.invariants?.reasonCodes,
        invariants: review.invariants,
        decision: review.decision,
        verification: review.verification,
      }));
  assert.equal(review.payment?.state, 'VERIFIED');
  assert.equal((await store.getPayment(tenant.chatId, payment.id)).state, 'VERIFIED');

  const verifiedAllocation = db.prepare(
    'SELECT payment_id, status FROM marketplace_payment_allocations WHERE marketplace_order_id = ?'
  ).get(String(checkout.marketplace_order_id));
  assert.equal(verifiedAllocation.payment_id, payment.id);
  assert.equal(verifiedAllocation.status, 'ALLOCATED',
    'only the canonical verified payment may allocate marketplace proceeds');
  assert.equal(db.prepare(
    'SELECT status FROM marketplace_settlements WHERE marketplace_order_id = ?'
  ).get(String(checkout.marketplace_order_id)).status, 'READY',
  'verified payment may make settlement ready, but does not claim it has settled');

  const verifiedSummary = await getOrderPaymentSummary(canonicalOrder.server_order_id);
  assert.equal(verifiedSummary.summary.status, 'PAID');
  assert.equal(Number(verifiedSummary.summary.verifiedMinor), 2500);
  assert.equal(Number(verifiedSummary.summary.outstandingMinor), 0,
    'canonical order summary must reflect the Payment Core decision, not local UI inference');

  const refundPath = baseUrl + '/tenants/' + encodeURIComponent(tenant.chatId)
    + '/payments/' + encodeURIComponent(payment.id) + '/refund';
  const refundResponse = await fetch(refundPath, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + session.token,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'marketplace-unsupported-refund-1',
    },
    body: JSON.stringify({
      idempotencyKey: 'marketplace-unsupported-refund-1',
      amountMinor: 100,
      currency: 'ETB',
      reason: 'Regression: manual provider does not execute automated refunds.',
    }),
  });
  assert.equal(refundResponse.status, 200, 'unsupported provider refund must be recorded as an unknown outcome, not a financial success');
  const refundBody = await refundResponse.json();
  assert.equal(refundBody.supported, false);
  assert.equal(refundBody.status, 'UNKNOWN');
  assert.equal(refundBody.refund?.status, 'UNKNOWN');

  const refundHistoryResponse = await fetch(refundPath, {
    headers: { Authorization: 'Bearer ' + session.token },
  });
  assert.equal(refundHistoryResponse.status, 200, 'canonical refund history must be readable');
  const refundHistory = await refundHistoryResponse.json();
  assert.equal(refundHistory.refunds?.length, 1);
  assert.equal(refundHistory.refunds[0].status, 'UNKNOWN');

  const replayReview = await submitManualPaymentEvidenceReview(
    payment.id,
    evidence.id,
    reviewInput,
    { idempotencyKey: 'marketplace-order-manual-review-1' },
  );
  assert.equal(replayReview.finalized, true);
  assert.equal(db.prepare(
    'SELECT COUNT(*) AS count FROM payment_verifications WHERE payment_id = ?'
  ).get(payment.id).count, 1,
  'replaying manual review must not duplicate canonical payment verification');

  // A repeated server-order pull must reuse the existing canonical payment,
  // not create another payment or allocation.
  await syncOrders();
  assert.equal(db.prepare(
    'SELECT COUNT(*) AS count FROM payments WHERE organization_id = ? AND order_id = ?'
  ).get(String(session.organizationId), String(canonicalOrder.server_order_id)).count, 1);
  assert.equal(db.prepare(
    'SELECT COUNT(*) AS count FROM marketplace_payment_allocations WHERE marketplace_order_id = ? AND payment_id IS NOT NULL'
  ).get(String(checkout.marketplace_order_id)).count, 1);

  console.log('Marketplace order → Payment Core bootstrap regression: PASS');
  console.log('Canonical order pull creates one UNPAID Payment Core payment and links marketplace allocation: PASS');
  console.log('SMS evidence remains unverified until authorized manual review; Payment Core verification, allocation, settlement readiness, and review idempotency: PASS');
} catch (error) {
  console.error(error);
  if (output) console.error('Backend output:\n' + output);
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 3000)),
    ]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  await rm(tempDir, { recursive: true, force: true });
}
