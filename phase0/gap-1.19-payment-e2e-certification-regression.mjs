import assert from 'node:assert/strict';
import { PaymentCore } from '../backend/lib/payments/payment-core.js';

const payments = new Map();
const intents = new Map();
const evidence = [];
const verifications = [];
const decisions = [];
const ledger = [];
const audits = [];
let sequence = 0;

const store = {
  async createPaymentWithIntent(chatId, input, actor) {
    const paymentId = 'pay-e2e-' + (++sequence);
    const intentId = 'intent-e2e-' + sequence;
    const payment = {
      id: paymentId, organizationId: input.organizationId, chatId,
      paymentIntentId: intentId, providerId: input.providerId,
      paymentAccountId: 'acct-e2e', amountMinor: input.amountMinor,
      currency: input.currency, state: 'UNPAID',
    };
    const intent = { id: intentId, paymentId, amountMinor: input.amountMinor, currency: input.currency };
    payments.set(paymentId, payment); intents.set(intentId, intent);
    ledger.push({ paymentId, type: 'CREATED', amountMinor: 0 });
    return { payment, paymentIntent: intent, duplicate: false };
  },
  async getPayment(chatId, id) { return payments.get(id) || null; },
  async getPaymentIntent(chatId, id) { return intents.get(id) || null; },
  async listPaymentAccounts() { return [{ id: 'acct-e2e', providerId: 'test-provider', status: 'ACTIVE' }]; },
  async insertPaymentEvidence(chatId, input) {
    const row={id:'evidence-e2e-'+(evidence.length+1),...input}; evidence.push(row); return { evidence:row, duplicate:false };
  },
  async insertPaymentVerification(chatId, input) {
    const row={id:'verification-e2e-'+(verifications.length+1),...input}; verifications.push(row); return { verification:row, duplicate:false };
  },
  async insertPaymentDecision(chatId, input) {
    const row={id:'decision-e2e-'+(decisions.length+1),...input}; decisions.push(row); return { decision:row, duplicate:false };
  },
  async commitPaymentDecision(chatId, input) {
    const payment=payments.get(input.paymentId); assert.ok(payment);
    assert.equal(payment.state,input.expectedState);
    payment.state=input.nextState;
    if(input.financialEffect) ledger.push({ paymentId:payment.id, type:input.nextState, amountMinor:input.amountMinor || 0 });
    return { payment, decision: input };
  },
  async audit(...args) { audits.push(args); },
};

const provider = {
  id: 'test-provider',
  capabilities: { initiate:true, getStatus:true, verify:true, reconcile:true, refund:true },
  async initiate({ payment, paymentIntent }) {
    return { status:'SUCCESS', externalReference:'ext-e2e-1', providerTransactionId:'txn-e2e-1', observedAt:new Date().toISOString(), amountMinor:paymentIntent.amountMinor, currency:paymentIntent.currency };
  },
};

const core = new PaymentCore({
  store,
  providerRegistry: { getPaymentProvider: () => provider },
});

const actor = { userId:'e2e-certifier', role:'owner', permissions:['payments:accept','payments:view','payments:manage'] };

const created = await core.createPayment({
  chatId:'chat-e2e', organizationId:'org-e2e', providerId:'test-provider',
  paymentAccountId:'acct-e2e', amountMinor:10000, currency:'ETB',
  idempotencyKey:'e2e-create-1', actor,
});

assert.equal(created.payment.state,'UNPAID');
assert.equal(ledger.filter(x=>x.type==='CREATED').length,1);

const initiation = await provider.initiate({
  payment:created.payment, paymentIntent:created.paymentIntent,
});
assert.equal(initiation.status,'SUCCESS');
assert.equal(initiation.externalReference,'ext-e2e-1');

const evidenceResult = await store.insertPaymentEvidence('chat-e2e',{
  paymentId:created.payment.id, paymentIntentId:created.paymentIntent.id,
  providerId:'test-provider', channel:'api', evidenceType:'PROVIDER_CONFIRMATION',
  externalReference:initiation.externalReference, providerTransactionId:initiation.providerTransactionId,
  observedAt:initiation.observedAt, rawPayload:initiation, source:'provider.initiate',
});
assert.equal(evidenceResult.evidence.providerTransactionId,'txn-e2e-1');

await store.insertPaymentVerification('chat-e2e',{
  paymentId:created.payment.id, providerId:'test-provider', result:'MATCH',
  amountMinor:10000, currency:'ETB', evidenceId:evidenceResult.evidence.id,
});
await store.insertPaymentDecision('chat-e2e',{
  paymentId:created.payment.id, previousState:'UNPAID', nextState:'VERIFIED',
  reason:'E2E provider evidence verified', evidenceId:evidenceResult.evidence.id,
});
await store.commitPaymentDecision('chat-e2e',{
  paymentId:created.payment.id, expectedState:'UNPAID', nextState:'VERIFIED',
  financialEffect:true, amountMinor:10000,
});

assert.equal(payments.get(created.payment.id).state,'VERIFIED');
assert.equal(ledger.filter(x=>x.type==='VERIFIED').length,1);
assert.equal(evidence.length,1);
assert.equal(verifications.length,1);
assert.equal(decisions.length,1);

console.log('GAP-1.19 payment E2E certification regression passed');
