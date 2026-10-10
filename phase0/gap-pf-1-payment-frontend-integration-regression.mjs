import fs from 'node:fs';
import assert from 'node:assert/strict';

const client = fs.readFileSync('app/src/payments/client.js', 'utf8');
const proof = fs.readFileSync('app/src/orders/payment-proof.js', 'utf8');
const checkout = fs.readFileSync('app/src/orders/checkout.js', 'utf8');
const server = fs.readFileSync('backend/server.js', 'utf8');

assert.match(client, /requiredIdempotencyKey/);
assert.match(client, /Idempotency-Key/);
assert.match(client, /createPayment/);
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
const captured=[];
try {
  globalThis.window={location:{origin:'http://sellify.test'}};
  globalThis.localStorage={getItem(){return null;},setItem(){},removeItem(){}};
  const {setConfig}=await import('../app/src/state.js');
  setConfig({chatId:'tenant-runtime',syncUrl:'http://sellify.test',sessionToken:'session-runtime'});
  globalThis.fetch=async (url,options={})=>{
    captured.push({url:String(url),options});
    return {ok:true,status:200,json:async()=>({status:'MATCH',payment:{id:'payment-runtime',state:'VERIFIED'}})};
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
} finally {
  globalThis.fetch=originalFetch;
  if(originalWindow===undefined) delete globalThis.window; else globalThis.window=originalWindow;
  if(originalLocalStorage===undefined) delete globalThis.localStorage; else globalThis.localStorage=originalLocalStorage;
}
console.log('PASS PF-1 runtime status-query client authentication/idempotency contract');
