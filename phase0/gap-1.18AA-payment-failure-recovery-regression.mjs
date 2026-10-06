import assert from 'node:assert/strict';
import test from 'node:test';
import { PaymentCore } from '../backend/lib/payments/payment-core.js';

function store() {
  const actions=[];
  const payment={id:'pay-aa',organizationId:'org-aa',state:'EXPIRED',providerId:'test-provider',paymentIntentId:'intent-aa',paymentAccountId:'acct-aa',amountMinor:1000,currency:'ETB'};
  return {
    async getPayment(){return {...payment};},
    async getPaymentIntent(){return {id:'intent-aa',amountMinor:1000,currency:'ETB'};},
    async listPaymentAccounts(){return [{id:'acct-aa',providerId:'test-provider',accountIdentifier:'acct-ref',status:'active'}];},
    async createPaymentOperationalAction(c,input){const key=input.idempotencyKey||null;const old=actions.find(a=>a.idempotencyKey===key);if(old)return {action:old,duplicate:true};const a={id:'op-'+(actions.length+1),paymentId:payment.id,actionType:String(input.actionType).toUpperCase(),operation:String(input.operation).toUpperCase(),status:'REQUESTED',idempotencyKey:key};actions.push(a);return {action:a,duplicate:false};},
    async updatePaymentOperationalAction(c,id,patch){const a=actions.find(x=>x.id===id);assert.ok(a);Object.assign(a,patch);return a;},
    async insertPaymentEvidence(){return {evidence:{id:'evidence-aa'},duplicate:false};},
    async insertPaymentVerification(){return {verification:{id:'verification-aa'},duplicate:false};},
    async insertPaymentDecision(){return {decision:{id:'decision-aa',targetState:null}};},
    async recordPaymentReconciliation(){return {reconciliation:{id:'recon-aa'}};},
    async commitPaymentDecision(){throw new Error('financial mutation during recovery');}
  };
}
function core(s){return new PaymentCore({store:s,authorization:()=>true,providerRegistry:{getPaymentProvider(){return {id:'test-provider',capabilities:{getStatus:true,reconcile:true},async getStatus(){return {status:'PENDING',amountMinor:1000,currency:'ETB',reference:'ref-aa'};},async reconcile(){return {status:'MATCHED',amountMinor:1000,currency:'ETB',reference:'ref-aa'};}};}}});}

test('GAP-1.18AA blocks financial retries',async()=>{const c=core(store());const r=await c.retryOperationalAction({chatId:'c',paymentId:'pay-aa',actionType:'REFUND',idempotencyKey:'r',actor:{userId:'u'}});assert.equal(r.status,'BLOCKED');assert.deepEqual(r.reasonCodes,['MANUAL_REVIEW_REQUIRED']);});
test('GAP-1.18AA permits only non-mutating recovery retries',async()=>{const c=core(store());const r=await c.retryOperationalAction({chatId:'c',paymentId:'pay-aa',actionType:'STATUS_QUERY',idempotencyKey:'s',actor:{userId:'u'}});assert.equal(r.status,'SUCCEEDED');assert.equal(r.result.payment.state,'EXPIRED');});
test('GAP-1.18AA recovery retry is idempotent',async()=>{const c=core(store());const x={chatId:'c',paymentId:'pay-aa',actionType:'RECONCILIATION',idempotencyKey:'q',actor:{userId:'u'}};await c.retryOperationalAction(x);const r=await c.retryOperationalAction(x);assert.equal(r.duplicate,true);});
test('GAP-1.18AA late success requires explicit confirmation',async()=>{const c=core(store());await assert.rejects(()=>c.transitionLifecycle({chatId:'c',paymentId:'pay-aa',targetState:'RECEIVED',reason:'late callback',actor:{userId:'u'}}),e=>e.code==='LATE_SUCCESS_CONFIRMATION_REQUIRED');});
console.log('GAP-1.18AA failure/recovery regression passed');
