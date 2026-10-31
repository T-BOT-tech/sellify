import fs from 'node:fs';
import assert from 'node:assert/strict';

const client = fs.readFileSync('app/src/payments/client.js', 'utf8');
const proof = fs.readFileSync('app/src/orders/payment-proof.js', 'utf8');
const checkout = fs.readFileSync('app/src/orders/checkout.js', 'utf8');
const queue = fs.readFileSync('app/src/orders/queue.js', 'utf8');
const server = fs.readFileSync('backend/server.js', 'utf8');

assert.match(client, /requiredIdempotencyKey/);
assert.match(client, /Idempotency-Key/);
assert.match(client, /createPayment/);
assert.match(client, /submitPaymentEvidence\(body = \{\}\)/);
assert.match(server, /handlePaymentEvidenceSubmission/);
assert.match(server, /payments.*evidence/);
assert.match(server, /paymentCore\.submitEvidence/);
assert.ok(client.includes('listPaymentEvidence(paymentId)'));
assert.ok(server.includes('handlePaymentEvidenceList'));
assert.ok(server.includes('paymentCore.listEvidence'));
assert.ok(server.includes('Payment evidence view permission required'));
assert.match(queue, /openPaymentEvidencePanel\(localOrderId\)/);
assert.match(queue, /listPaymentEvidence\(payment\.id\)/);
assert.match(queue, /submitPaymentEvidence\(/);
assert.match(queue, /paymentIntentId: intentId/);
assert.match(queue, /Evidence only — not payment verification/);
assert.match(queue, /payment state was not changed/);
assert.match(queue, /hasPermission\(currentStaff \? currentStaff\.role : 'owner', 'payments:accept'\)/);
assert.match(client, /resolvePaymentRouting/);
assert.match(client, /queryPaymentStatus\(paymentId, body = \{\}, \{ idempotencyKey \}/);
assert.match(client, /transitionPaymentLifecycle/);
assert.match(server, /paymentCore\.transitionLifecycle/);
assert.match(server, /Idempotency-Key is required/);
assert.match(server, /paymentCore\.queryStatus/);
assert.match(server, /paymentCore\.resolveRouting/);
assert.match(server, /idempotencyKey,\n    chatId/);
assert.ok(server.includes('\\/payments\\/routing\\/resolve'), 'payment routing resolve endpoint must exist');
assert.match(client, /requiredIdempotencyKey\(idempotencyKey\)/g);
assert.match(proof, /payment_proof/);
assert.match(checkout, /payment_method_id/);
assert.doesNotMatch(checkout, /payments\/ledger|payment_ledger_entries/);
assert.doesNotMatch(checkout, /createPayment\(/);

console.log('PASS PF-1 payment frontend mutation/idempotency integration boundary');

// Runtime-check the actual frontend client, not only its source text. This
// proves the status command carries the authenticated tenant and stable key.
const originalFetch=globalThis.fetch;
const originalWindow=globalThis.window;
const originalLocalStorage=globalThis.localStorage;
const originalDocument=globalThis.document;
const originalGetComputedStyle=globalThis.getComputedStyle;
const captured=[];
try {
  globalThis.window={location:{origin:'http://sellify.test'},addEventListener(){},matchMedia(){return {addEventListener(){}};}};
  globalThis.localStorage={getItem(){return null;},setItem(){},removeItem(){}};
  globalThis.document={
    documentElement:{style:{setProperty(){},removeProperty(){}},setAttribute(){}},
    querySelector(){return null;},
    createElement(){return {setAttribute(){}};},
    head:{appendChild(){}},
    getElementById(){return null;},
    querySelectorAll(){return [];},
    addEventListener(){},
  };
  globalThis.getComputedStyle=()=>({getPropertyValue(){return '';}});
  const {setConfig}=await import('../app/src/state.js');
  setConfig({chatId:'tenant-runtime',syncUrl:'http://sellify.test',sessionToken:'session-runtime'});
  globalThis.fetch=async (url,options={})=>{
    captured.push({url:String(url),options});
    const data=String(url).endsWith('/payments/evidence')
      ? {status:'RECEIVED',accepted:true,verificationStatus:'NOT_PERFORMED',paymentStateMutated:false}
      : {status:'MATCH',payment:{id:'payment-runtime',state:'VERIFIED'}};
    return {ok:true,status:200,json:async()=>data};
  };
  const frontend=await import('../app/src/payments/client.js');
  await assert.rejects(
    ()=>frontend.queryPaymentStatus('payment-runtime',{},{}),
    error=>error.code==='IDEMPOTENCY_KEY_REQUIRED',
  );
  assert.equal(captured.length,0,'missing idempotency key must fail before network access');
  const response=await frontend.queryPaymentStatus(
    'payment/runtime',{reason:'retry after lost response'},{idempotencyKey:'stable-status-key'},
  );
  assert.equal(captured.length,1);
  assert.equal(captured[0].url,'http://sellify.test/tenants/tenant-runtime/payments/payment%2Fruntime/status');
  assert.equal(captured[0].options.method,'POST');
  assert.equal(captured[0].options.headers.Authorization,'Bearer session-runtime');
  assert.equal(captured[0].options.headers['Idempotency-Key'],'stable-status-key');
  assert.deepEqual(JSON.parse(captured[0].options.body),{reason:'retry after lost response'});

  assert.equal(response.payment.state,'VERIFIED');
  const evidenceResponse=await frontend.submitPaymentEvidence({
    paymentIntentId:'intent-runtime',
    providerId:'telebirr',
    channel:'sms',
    evidenceType:'SMS_TEXT',
    payload:{text:'Paid ETB 1,500 reference SMS-123'},
  });
  assert.equal(captured.length,2);
  assert.equal(captured[1].url,'http://sellify.test/tenants/tenant-runtime/payments/evidence');
  assert.equal(captured[1].options.method,'POST');
  assert.equal(captured[1].options.headers.Authorization,'Bearer session-runtime');
  assert.deepEqual(JSON.parse(captured[1].options.body),{
    paymentIntentId:'intent-runtime',
    providerId:'telebirr',
    channel:'sms',
    evidenceType:'SMS_TEXT',
    payload:{text:'Paid ETB 1,500 reference SMS-123'},
  });
  assert.equal(evidenceResponse.status,'RECEIVED');

} finally {
  globalThis.fetch=originalFetch;
  if(originalWindow===undefined) delete globalThis.window; else globalThis.window=originalWindow;
  if(originalLocalStorage===undefined) delete globalThis.localStorage; else globalThis.localStorage=originalLocalStorage;
  if(originalDocument===undefined) delete globalThis.document; else globalThis.document=originalDocument;
  if(originalGetComputedStyle===undefined) delete globalThis.getComputedStyle; else globalThis.getComputedStyle=originalGetComputedStyle;
}
console.log('PASS PF-1 runtime status-query client authentication/idempotency contract');
