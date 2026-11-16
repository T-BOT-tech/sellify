import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyTelegramBuyerInitDataWithSecret } from '../app/src/platform/telegram-buyer-identity-contract.js';
import { setTimeout as sleep } from 'node:timers/promises';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dataDir = await mkdtemp(path.join(tmpdir(), 'sellify-tg11-'));
const port = 21400 + Math.floor(Math.random() * 200);
const botToken = '111111:TG11_TEST_SECRET';
const helper = pathToFileURL(path.join(root,'phase0/helpers/telegram-test-credential-provider.mjs')).href;
const env = {
  ...process.env, PORT:String(port), NODE_ENV:'test',
  CORS_ALLOWED_ORIGINS:'http://localhost:3000',
  SELLIFY_DATA_DIR:dataDir, SELLIFY_DB_PATH:path.join(dataDir,'sellify.sqlite'),
  SELLIFY_BACKUP_DIR:path.join(dataDir,'backups'),
  SELLIFY_TEST_TELEGRAM_BOT_TOKEN:botToken,
  NODE_OPTIONS:[process.env.NODE_OPTIONS, '--import='+helper].filter(Boolean).join(' '),
};
process.env.SELLIFY_DATA_DIR=dataDir;
process.env.SELLIFY_DB_PATH=path.join(dataDir,'sellify.sqlite');
process.env.SELLIFY_BACKUP_DIR=path.join(dataDir,'backups');
const child = spawn(process.execPath,[path.join(root,'backend/server.js')],{cwd:root,env,stdio:['ignore','ignore','pipe']});
let serverStderr = '';
child.stderr.setEncoding('utf8');
child.stderr.on('data', chunk => { serverStderr += chunk; });
const request = async (url,options={}) => {
  const response=await fetch(`http://127.0.0.1:${port}${url}`,options);
  return {response,body:await response.json().catch(()=>({}))};
};
function telegramInitData(userId) {
  const params=new URLSearchParams({
    auth_date:String(Math.floor(Date.now()/1000)),
    query_id:'AA_TG11_'+String(userId),
    user:JSON.stringify({id:Number(userId),first_name:'TG11 Buyer',username:'tg11buyer'}),
  });
  const check=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>key+'='+value).join('\n');
  const secret=crypto.createHmac('sha256','WebAppData').update(botToken).digest();
  params.set('hash',crypto.createHmac('sha256',secret).update(check).digest('hex'));
  return params.toString();
}
try {
  let ready=false;
  for(let i=0;i<120;i++){try{if((await fetch(`http://127.0.0.1:${port}/health`)).ok){ready=true;break}}catch{} await sleep(50)}
  assert.equal(ready,true,'backend must start with the isolated test credential adapter');
  const store=await import('../backend/lib/store-sqlite.js');
  const suffix=Date.now().toString(36);
  const seller=await store.getOrCreateUserByTelegram('tg11-seller-'+suffix,'TG11 Seller');
  const tenant=await store.createTenantForUser({
    userId:seller.id,sellerName:'TG11 Service Seller',businessType:'services',
    country:'ET',currency:'ETB',timezone:'Africa/Addis_Ababa',
  });
  const db=store.getDatabaseForTests();
  const organizationId=db.prepare('SELECT organization_id FROM tenants WHERE chat_id=?').get(tenant.chatId).organization_id;
  const owner={userId:seller.id,role:'owner',organizationId,chatId:tenant.chatId};
  await store.saveCatalog(tenant.chatId,[
    {id:'tg11-consultation',name:'TG11 Consultation',price:25000,item_type:'service',marketplace_listed:true},
    {id:'tg11-chair',name:'Chair',price:10000,item_type:'product',marketplace_listed:true},
  ]);
  await store.upsertTelegramStorefrontConfig(tenant.chatId,{
    botId:'111111',botUsername:'tg11_test_bot',credentialRef:'secret://tg11/test',
    status:'CONFIGURED',webappUrl:'https://example.invalid/tg11',
    enabledCapabilities:['browse','checkout','order_status','service_appointments'],
  },owner);
  db.prepare("UPDATE telegram_storefront_configs SET status='PUBLISHED' WHERE organization_id=?").run(organizationId);

  const buyerId='987654321';
  const marketplaceOrderId='tg11-marketplace-order-'+suffix;
  const sellerOrderId='SO-TG11-'+suffix;
  const serverOrderId='tg11-server-order-'+suffix;
  const now=new Date().toISOString();
  db.prepare(`INSERT INTO marketplace_orders
    (id,buyer_identity,customer_name,customer_phone,currency,total_minor,status,tracking_token_hash,idempotency_key,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      marketplaceOrderId,buyerId,'TG11 Buyer','','ETB',35000,'confirmed','tg11-tracking-hash',null,now,now,
    );
  db.prepare(`INSERT INTO marketplace_seller_orders
    (id,marketplace_order_id,seller_id,seller_order_id,organization_id,currency,subtotal_minor,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      'tg11-seller-order-row-'+suffix,marketplaceOrderId,tenant.chatId,sellerOrderId,organizationId,'ETB',35000,'confirmed',now,now,
    );
  db.prepare(`INSERT INTO orders
    (chat_id,local_id,server_order_id,order_json,total_minor,created_at,status,delivered_to_device,marketplace_order_id,is_marketplace)
    VALUES (?,?,?,?,?,?,?,?,?,1)`).run(
      tenant.chatId,sellerOrderId,serverOrderId,JSON.stringify({
        id:sellerOrderId,marketplace_order_id:marketplaceOrderId,is_marketplace:true,status:'confirmed',
        total:35000,currency:'ETB',created_at:Date.now(),
        items:[
          {item_id:'tg11-consultation',item_type:'service',name:'TG11 Consultation',qty:1,price:25000},
          {item_id:'tg11-chair',item_type:'product',name:'Chair',qty:1,price:10000},
        ],
      }),35000,Date.now(),'confirmed',1,marketplaceOrderId,
    );

  const resourceResult=await store.createServiceResource(tenant.chatId,{
    name:'TG11 Consultation Room',resource_type:'FACILITY',service_item_id:'tg11-consultation',
    idempotency_key:'tg11-resource-'+suffix,
  },owner);
  const resource=resourceResult.resource;
  await store.setServiceResourceAvailability(tenant.chatId,resource.id,{
    expected_version:0,idempotency_key:'tg11-hours-'+suffix,
    working_hours:[0,1,2,3,4,5,6].map(weekday=>({weekday,start_time:'08:00',end_time:'18:00'})),
    exceptions:[],
  },owner);

  const initData=telegramInitData(buyerId);
  assert.equal(verifyTelegramBuyerInitDataWithSecret(initData,botToken).telegramUserId,buyerId,'test initData signature must be valid');
  const baseUrl=`/api/telegram-storefront/${encodeURIComponent(tenant.chatId)}/orders/${encodeURIComponent(marketplaceOrderId)}/service-appointments`;
  const windowBody={
    seller_order_id:sellerOrderId,service_item_id:'tg11-consultation',
    requested_start:'2026-11-20T09:00:00+03:00',requested_end:'2026-11-20T10:00:00+03:00',
  };
  const authHeaders={'Content-Type':'application/json','X-Telegram-Init-Data':initData};

  const history=await request(`/api/telegram-storefront/${encodeURIComponent(tenant.chatId)}/orders`,{headers:authHeaders});
  assert.equal(history.response.status,200,JSON.stringify({response:history.body.error||history.body,serverStderr:serverStderr.slice(-8000)}));
  assert.equal(history.body.orders[0].sellers[0].service_items[0].id,'tg11-consultation');

  const assessment=await request(baseUrl+'/assessment',{
    method:'POST',headers:authHeaders,body:JSON.stringify(windowBody),
  });
  assert.equal(assessment.response.status,200);
  assert.equal(assessment.body.assessment.state,'FEASIBLE');
  assert.equal(assessment.body.assessment.availability_confirmed,false);
  assert.equal(assessment.body.assessment.commitment_created,false);
  assert.equal(assessment.body.assessment.resource_id,undefined,'feasibility response must not reveal candidate resources');

  const createHeaders={...authHeaders,'Idempotency-Key':'tg11-create-'+suffix};
  const created=await request(baseUrl,{method:'POST',headers:createHeaders,body:JSON.stringify({
    ...windowBody,appointment_mode:'REMOTE',customer_note:'Please call on arrival.',
  })});
  assert.equal(created.response.status,201);
  assert.equal(created.body.booking.status,'REQUESTED');
  assert.equal(created.body.booking.resource_id,undefined,'buyer request response must not expose internal resource identifiers');
  const replay=await request(baseUrl,{method:'POST',headers:createHeaders,body:JSON.stringify({
    ...windowBody,appointment_mode:'REMOTE',customer_note:'Please call on arrival.',
  })});
  assert.equal(replay.response.status,200);
  assert.equal(replay.body.replayed,true);
  assert.equal(replay.body.booking.id,created.body.booking.id);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM service_resource_commitments WHERE booking_id=?').get(created.body.booking.id).count,0,
    'a customer request is not a resource commitment');

  const buyerOrders=await store.listTelegramBuyerOrders(tenant.chatId,buyerId,20);
  assert.equal(buyerOrders[0].sellers[0].service_appointments[0].status,'REQUESTED');
  assert.equal(buyerOrders[0].sellers[0].time_zone,'Africa/Addis_Ababa');

  const wrongBuyer=await request(baseUrl,{method:'POST',headers:{...authHeaders,'X-Telegram-Init-Data':telegramInitData('987654322'),'Idempotency-Key':'tg11-wrong-buyer-'+suffix},body:JSON.stringify(windowBody)});
  assert.equal(wrongBuyer.response.status,404);
  assert.equal(wrongBuyer.body.error?.code,'MARKETPLACE_BUYER_ORDER_NOT_FOUND');
  const wrongLine=await request(baseUrl,{method:'POST',headers:{...authHeaders,'Idempotency-Key':'tg11-wrong-line-'+suffix},body:JSON.stringify({...windowBody,service_item_id:'tg11-chair'})});
  assert.equal(wrongLine.response.status,409);
  assert.equal(wrongLine.body.error?.code,'SERVICE_BOOKING_ORDER_LINE_INVALID');

  const bookingId=created.body.booking.id;
  await store.transitionServiceBooking(tenant.chatId,serverOrderId,bookingId,{
    status:'ACCEPTED',expected_version:1,idempotency_key:'tg11-manager-accept-'+suffix,
  },owner);
  const legacyBookingId='tg11-legacy-confirmed-'+suffix;
  db.prepare(`INSERT INTO service_bookings
    (id,organization_id,chat_id,server_order_id,service_item_id,requested_start,requested_end,appointment_mode,customer_note,status,version,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,'REMOTE',NULL,'CONFIRMED',2,?,?)`).run(
      legacyBookingId,organizationId,tenant.chatId,serverOrderId,'tg11-consultation',
      '2026-11-20T06:00:00.000Z','2026-11-20T07:00:00.000Z',now,now,
    );
  const legacyAssessment=await request(baseUrl+'/assessment',{
    method:'POST',headers:authHeaders,body:JSON.stringify(windowBody),
  });
  assert.equal(legacyAssessment.body.assessment.state,'UNKNOWN',
    'legacy confirmed bookings without a resource binding must not be treated as free capacity');
  await assert.rejects(
    () => store.transitionServiceBooking(tenant.chatId,serverOrderId,bookingId,{
      status:'CONFIRMED',resource_id:resource.id,expected_version:2,idempotency_key:'tg11-manager-confirm-legacy-'+suffix,
    },owner),
    error => error.code==='SERVICE_BOOKING_LEGACY_RESOURCE_UNKNOWN',
  );
  db.prepare('DELETE FROM service_bookings WHERE id=?').run(legacyBookingId);
  const clearAssessment=await request(baseUrl+'/assessment',{
    method:'POST',headers:authHeaders,body:JSON.stringify(windowBody),
  });
  assert.equal(clearAssessment.body.assessment.state,'FEASIBLE');
  const confirmed=await store.transitionServiceBooking(tenant.chatId,serverOrderId,bookingId,{
    status:'CONFIRMED',resource_id:resource.id,expected_version:2,idempotency_key:'tg11-manager-confirm-'+suffix,
  },owner);
  assert.equal(confirmed.booking.status,'CONFIRMED');
  const buyerHistoryAfterConfirm=await request(`/api/telegram-storefront/${encodeURIComponent(tenant.chatId)}/orders`,{headers:authHeaders});
  const publicAppointment=buyerHistoryAfterConfirm.body.orders[0].sellers[0].service_appointments[0];
  assert.equal(publicAppointment.status,'CONFIRMED');
  assert.equal(publicAppointment.resource_id,undefined,'buyer order history must not expose the committed resource ID');
  const afterConfirm=await request(baseUrl+'/assessment',{
    method:'POST',headers:authHeaders,body:JSON.stringify(windowBody),
  });
  assert.equal(afterConfirm.body.assessment.resource_id,undefined,'feasibility response must not reveal committed resource IDs');
  assert.equal(afterConfirm.body.assessment.state,'UNAVAILABLE',
    'a confirmed commitment must be visible to the buyer feasibility projection');

  const cancelHeaders={...authHeaders,'Idempotency-Key':'tg11-cancel-'+suffix};
  const cancelled=await request(baseUrl+'/'+encodeURIComponent(bookingId),{
    method:'PATCH',headers:cancelHeaders,body:JSON.stringify({
      seller_order_id:sellerOrderId,expected_version:3,reason:'Changed my plans',
    }),
  });
  assert.equal(cancelled.response.status,200);
  assert.equal(cancelled.body.booking.status,'CANCELLED');
  assert.equal(cancelled.body.booking.resource_id,undefined,'buyer cancellation response must not expose internal resource identifiers');
  assert.equal(db.prepare('SELECT status FROM service_resource_commitments WHERE booking_id=?').get(bookingId).status,'RELEASED');
  const cancelReplay=await request(baseUrl+'/'+encodeURIComponent(bookingId),{
    method:'PATCH',headers:cancelHeaders,body:JSON.stringify({
      seller_order_id:sellerOrderId,expected_version:3,reason:'Changed my plans',
    }),
  });
  assert.equal(cancelReplay.response.status,200);
  assert.equal(cancelReplay.body.replayed,true);

  const afterCancel=await request(baseUrl+'/assessment',{
    method:'POST',headers:authHeaders,body:JSON.stringify(windowBody),
  });
  assert.equal(afterCancel.body.assessment.state,'FEASIBLE',
    'customer cancellation must release the Service Resource commitment');

  const audit=db.prepare(`SELECT metadata_json FROM audit_events
    WHERE entity_type='service_booking' AND entity_id=? AND action='services.booking.requested' ORDER BY id DESC LIMIT 1`).get(bookingId);
  const metadata=JSON.parse(audit.metadata_json);
  assert.ok(metadata.buyer_identity_hash);
  assert.equal(JSON.stringify(metadata).includes(buyerId),false,'raw Telegram buyer identity must not be stored in appointment audit metadata');

  const orderAfter=db.prepare('SELECT order_json,total_minor FROM orders WHERE chat_id=? AND server_order_id=?').get(tenant.chatId,serverOrderId);
  assert.equal(orderAfter.total_minor,35000);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM fulfillments WHERE server_order_id=?').get(serverOrderId).count,0,
    'customer appointment actions must not create Logistics fulfillment');
  const secondCreated=await request(baseUrl,{method:'POST',headers:{...authHeaders,'Idempotency-Key':'tg11-create-second-'+suffix},body:JSON.stringify({
    ...windowBody,appointment_mode:'REMOTE',
  })});
  assert.equal(secondCreated.response.status,201);
  db.prepare('UPDATE telegram_storefront_configs SET enabled_capabilities_json=? WHERE organization_id=?')
    .run(JSON.stringify(['browse','order_status']),organizationId);
  const disabled=store.getTelegramStorefrontConfig(tenant.chatId);
  assert.equal(disabled.enabledCapabilities.includes('service_appointments'),false);
  const disabledResponse=await request(baseUrl,{method:'POST',headers:{...authHeaders,'Idempotency-Key':'tg11-disabled-'+suffix},body:JSON.stringify({
    ...windowBody,appointment_mode:'REMOTE',
  })});
  assert.equal(disabledResponse.response.status,403);
  assert.equal(disabledResponse.body.error?.code,'TELEGRAM_SERVICE_APPOINTMENTS_DISABLED');
  const cancelWhileDisabled=await request(baseUrl+'/'+encodeURIComponent(secondCreated.body.booking.id),{
    method:'PATCH',headers:{...authHeaders,'Idempotency-Key':'tg11-cancel-disabled-'+suffix},
    body:JSON.stringify({seller_order_id:sellerOrderId,expected_version:1,reason:'Cancel after seller disabled new requests'}),
  });
  assert.equal(cancelWhileDisabled.response.status,200);
  assert.equal(cancelWhileDisabled.body.booking.status,'CANCELLED',
    'buyers must retain cancellation access to existing appointments when new requests are disabled');
  const historyWhenDisabled=await request(`/api/telegram-storefront/${encodeURIComponent(tenant.chatId)}/orders`,{headers:authHeaders});
  assert.equal(historyWhenDisabled.response.status,200);
  assert.equal(historyWhenDisabled.body.orders[0].sellers[0].service_items.length,0);
  assert.ok(historyWhenDisabled.body.orders[0].sellers[0].service_appointments.some(item=>item.id===secondCreated.body.booking.id));

  const buyerUi=await readFile(path.join(root,'app/store.js'),'utf8');
  assert.match(buyerUi,/service-appointment-request-dialog/);
  assert.match(buyerUi,/serviceLocalDateTimeToIso/);
  assert.match(buyerUi,/assessedWindowKey!==windowKey\(appointmentWindow\)/);
  assert.match(buyerUi,/data-cancel-appointment/);
  assert.match(buyerUi,/Offline — request not sent/);
  assert.match(buyerUi,/Potentially feasible:.*not a reservation or confirmation/);
  assert.match(buyerUi,/sessionStorage\.setItem\(storageKey,activeCreateKey\)/);
  assert.doesNotMatch(buyerUi,/offlineQueueServiceAppointment|queueServiceAppointmentOffline/);
  console.log('TG-11 Telegram buyer Service appointment self-service regression: PASS');
} finally {
  child.kill('SIGTERM');
}
