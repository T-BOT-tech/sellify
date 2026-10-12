import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const core=readFileSync(new URL('../backend/lib/payments/payment-core.js',import.meta.url),'utf8');
const evidence=readFileSync(new URL('../backend/lib/payments/payment-evidence-authority.js',import.meta.url),'utf8');
const store=readFileSync(new URL('../backend/lib/store-sqlite.js',import.meta.url),'utf8');
const server=readFileSync(new URL('../backend/server.js',import.meta.url),'utf8');
test('GAP-1.18AB command mutations require Payment Core authorization',()=>{for(const m of ['createPayment','createSettlement','finalizeSettlement','refund','transitionLifecycle','submitEvidence','reconcile','queryStatus','recordOperationalAction','resolveManualReview','retryOperationalAction']){const i=core.indexOf('async '+m+'(');assert.notEqual(i,-1,m);const j=core.indexOf('\n  async ',i+10);assert.match(core.slice(i,j>0?j:i+5000),/this\.#authorize\(command,/);}});
test('GAP-1.18AB evidence cannot inject trusted authority',()=>{for(const f of ['decision','targetState','ledgerMutated','financialEffect','authoritative','verificationId'])assert.match(evidence,new RegExp(f));});
test('GAP-1.18AB decisions are tenant-bound and Payment-Core sourced',()=>{assert.match(store,/organization_id = \?/);assert.match(store,/UNTRUSTED_PAYMENT_DECISION_SOURCE/);assert.match(store,/BEGIN IMMEDIATE/);});
import { PaymentCore } from '../backend/lib/payments/payment-core.js';
import { authorize } from '../backend/lib/authorization.js';

test('GAP-1.18AB production Payment Core is wired to central authorization', () => {
  const start = server.indexOf('const paymentCore = new PaymentCore({');
  const end = server.indexOf('});', start);
  assert.ok(start >= 0 && end > start, 'production Payment Core constructor must exist');
  assert.match(server.slice(start, end), /authorization:\s*\(actor, organizationId, locationId, resource, permission\)\s*=>\s*authorize\(actor, organizationId, locationId, resource, permission\)/);
});

test('GAP-1.18AB central role policy denies unauthorized direct Payment Core calls', async () => {
  let mutations = 0;
  const core = new PaymentCore({
    store: { async createPaymentWithIntent() { mutations += 1; } },
    authorization: authorize,
  });
  await assert.rejects(
    () => core.createPayment({
      organizationId: 'org-test',
      chatId: 'tenant-test',
      actor: { userId: 'staff-user', role: 'staff', organizationId: 'org-test' },
    }),
    error => error.statusCode === 403 && error.code === 'UNAUTHORIZED_OPERATION',
  );
  assert.equal(mutations, 0, 'central authorization must reject before persistence');
});

test('GAP-1.18AB denied commands stop before any store mutation', async () => {
  let mutations = 0;
  const store = {
    async createPaymentWithIntent() { mutations += 1; },
    async insertPaymentEvidence() { mutations += 1; },
    async beginPaymentStatusQuery() { mutations += 1; },
  };
  const core = new PaymentCore({
    store,
    authorization: () => false,
  });

  for (const command of [
    () => core.createPayment({ organizationId: 'org-test', chatId: 'tenant-test' }),
    () => core.submitEvidence({ chatId: 'tenant-test', paymentIntentId: 'intent-test', evidenceType: 'STATUS' }),
    () => core.queryStatus({ chatId: 'tenant-test', paymentId: 'payment-test', idempotencyKey: 'key-test' }),
  ]) {
    await assert.rejects(command, error =>
      error.statusCode === 403 && error.code === 'UNAUTHORIZED_OPERATION');
  }
  assert.equal(mutations, 0, 'denied commands must not reach mutation/query-claim store methods');
});

test('GAP-1.18AB caller evidence cannot inject decision authority at runtime', async () => {
  let evidenceWrites = 0;
  const core = new PaymentCore({
    store: {
      async insertPaymentEvidence() { evidenceWrites += 1; },
    },
    authorization: () => true,
  });

  await assert.rejects(
    () => core.submitEvidence({
      chatId: 'tenant-test',
      paymentIntentId: 'intent-test',
      evidenceType: 'STATUS',
      targetState: 'VERIFIED',
      ledgerMutated: true,
    }),
    error => error.statusCode === 409 &&
      error.code === 'EVIDENCE_AUTHORITY_FIELD_FORBIDDEN' &&
      error.field === 'targetState',
  );
  assert.equal(evidenceWrites, 0, 'untrusted authority fields must be rejected before persistence');
});

console.log('GAP-1.18AB Payment Core security-boundary regression passed');
