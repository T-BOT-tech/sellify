import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = await mkdtemp(join(tmpdir(), 'sellify-order-idempotency-'));
process.env.SELLIFY_DATA_DIR = dir;

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const user = await store.getOrCreateUserByTelegram('order-idempotency-user', 'Order Idempotency');
  const tenant = await store.createTenantForUser({
    userId: user.id,
    sellerName: 'Order Idempotency Test',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });

  const original = {
    id: 'local-order-100',
    currency: 'ETB',
    customer_name: 'Test Buyer',
    customer_phone: '+251900000000',
    items: [
      { id: 'coffee', name: 'Coffee', price: 100, qty: 2, currency: 'ETB' },
    ],
  };

  const first = await store.saveQueuedOrders(tenant.chatId, [original]);
  assert.equal(first.length, 1);
  assert.equal(first[0].status, 'synced');
  assert.ok(first[0].order_id);
  assert.ok(first[0].payment_id);

  // Restaurant checkout compatibility: caller-reported tender and attached
  // proof must survive order sync without selecting canonical payment state.
  // The canonical payment shell remains UNPAID until Payment Core decides otherwise.
  const restaurantPaymentCases = [
    {
      id: 'restaurant-cash-full',
      cash_tendered: 200,
      payment_method_id: 'cash',
      payment_method_name: 'Cash',
    },
    {
      id: 'restaurant-cash-partial',
      cash_tendered: 100,
      payment_method_id: 'cash',
      payment_method_name: 'Cash',
    },
    {
      id: 'restaurant-proof-attached',
      payment_method_id: 'telebirr',
      payment_method_name: 'Telebirr',
      payment_proof: {
        path: 'opfs://payment_proofs/restaurant-proof.webp',
        fileName: 'restaurant-proof.webp',
        sizeBytes: 128,
      },
    },
  ];
  const paymentsBeforeRestaurantCases = (await store.listPayments(tenant.chatId)).length;
  for (const restaurantCase of restaurantPaymentCases) {
    const restaurantOrder = {
      ...structuredClone(original),
      ...restaurantCase,
      items: [{ id: 'coffee', name: 'Coffee', price: 100, qty: 2, currency: 'ETB' }],
    };
    const [synced] = await store.saveQueuedOrders(tenant.chatId, [restaurantOrder]);
    assert.equal(synced.status, 'synced', restaurantCase.id + ' should sync');
    assert.equal(synced.payment_state, 'UNPAID', restaurantCase.id + ' must not claim payment');
    assert.ok(synced.payment_id, restaurantCase.id + ' should link canonical payment');
    const canonicalPayment = await store.getPayment(tenant.chatId, synced.payment_id);
    const storedRestaurantOrder = (await store.getOrders(tenant.chatId)).find(order => order.id === restaurantCase.id);
    assert.ok(storedRestaurantOrder, restaurantCase.id + ' should remain retrievable after sync');
    if (Object.hasOwn(restaurantCase, 'cash_tendered')) {
      assert.equal(storedRestaurantOrder.cash_tendered, restaurantCase.cash_tendered,
        restaurantCase.id + ' should preserve reported tender as order data');
    }
    if (Object.hasOwn(restaurantCase, 'payment_proof')) {
      assert.deepEqual(storedRestaurantOrder.payment_proof, restaurantCase.payment_proof,
        restaurantCase.id + ' should preserve proof evidence without treating it as confirmation');
    }
    assert.equal(canonicalPayment.state, 'UNPAID', restaurantCase.id + ' must leave canonical state unpaid');
    assert.equal(canonicalPayment.metadata.financialStateAuthority, 'PAYMENT_CORE');
    assert.equal(
      canonicalPayment.metadata.paymentProofAttached,
      Boolean(restaurantOrder.payment_proof),
      restaurantCase.id + ' should preserve proof presence as metadata only',
    );

    const [retried] = await store.saveQueuedOrders(tenant.chatId, [structuredClone(restaurantOrder)]);
    assert.equal(retried.status, 'synced', restaurantCase.id + ' exact retry should remain idempotent');
    assert.equal(retried.order_id, synced.order_id, restaurantCase.id + ' retry must reuse order identity');
    assert.equal(retried.payment_id, synced.payment_id, restaurantCase.id + ' retry must reuse payment identity');
    assert.equal(retried.payment_state, 'UNPAID');
  }
  assert.equal(
    (await store.listPayments(tenant.chatId)).length,
    paymentsBeforeRestaurantCases + restaurantPaymentCases.length,
    'restaurant cash/proof sync and retries must create exactly one canonical payment per order',
  );


  const paymentsAfterFirst = await store.listPayments(tenant.chatId);
  const ordersAfterFirst = await store.getOrders(tenant.chatId);
  assert.equal(ordersAfterFirst.filter(order => order.id === original.id).length, 1);

  const exactRetry = await store.saveQueuedOrders(tenant.chatId, [structuredClone(original)]);
  assert.equal(exactRetry[0].status, 'synced');
  assert.equal(exactRetry[0].order_id, first[0].order_id);
  assert.equal(exactRetry[0].payment_id, first[0].payment_id);

  const changedItems = {
    ...structuredClone(original),
    items: [{ id: 'tea', name: 'Tea', price: 125, qty: 2, currency: 'ETB' }],
  };
  const itemConflict = await store.saveQueuedOrders(tenant.chatId, [changedItems]);
  assert.equal(itemConflict[0].status, 'rejected');
  assert.equal(itemConflict[0].code, 'ORDER_IDEMPOTENCY_CONFLICT');

  const changedQuantity = {
    ...structuredClone(original),
    items: [{ id: 'coffee', name: 'Coffee', price: 100, qty: 3, currency: 'ETB' }],
  };
  const quantityConflict = await store.saveQueuedOrders(tenant.chatId, [changedQuantity]);
  assert.equal(quantityConflict[0].status, 'rejected');
  assert.equal(quantityConflict[0].code, 'ORDER_IDEMPOTENCY_CONFLICT');

  const changedCurrency = { ...structuredClone(original), currency: 'USD' };
  const currencyConflict = await store.saveQueuedOrders(tenant.chatId, [changedCurrency]);
  assert.equal(currencyConflict[0].status, 'rejected');
  assert.equal(currencyConflict[0].code, 'ORDER_IDEMPOTENCY_CONFLICT');

  // Customer association is part of the canonical order identity, even when
  // line items and the display name/phone are unchanged.
  await store.upsertCustomer(tenant.chatId, { id: 'customer-a', name: 'Customer A' });
  await store.upsertCustomer(tenant.chatId, { id: 'customer-b', name: 'Customer B' });
  const customerBoundOrder = { ...structuredClone(original), id: 'local-order-customer-bound', customer_id: 'customer-a' };
  const customerBoundFirst = await store.saveQueuedOrders(tenant.chatId, [customerBoundOrder]);
  assert.equal(customerBoundFirst[0].status, 'synced');
  const changedCustomer = { ...structuredClone(customerBoundOrder), customer_id: 'customer-b' };
  const customerConflict = await store.saveQueuedOrders(tenant.chatId, [changedCustomer]);
  assert.equal(customerConflict[0].status, 'rejected');
  assert.equal(customerConflict[0].code, 'ORDER_IDEMPOTENCY_CONFLICT');

  // A reused local ID must not silently accept changed fulfillment instructions
  // merely because its line items and total still match.
  const changedNotes = { ...structuredClone(original), notes: 'Leave at reception' };
  const notesConflict = await store.saveQueuedOrders(tenant.chatId, [changedNotes]);
  assert.equal(notesConflict[0].status, 'rejected');
  assert.equal(notesConflict[0].code, 'ORDER_IDEMPOTENCY_CONFLICT');

  const changedDeliveryLocation = { ...structuredClone(original), delivery_location_id: 'location-other' };
  const deliveryLocationConflict = await store.saveQueuedOrders(tenant.chatId, [changedDeliveryLocation]);
  assert.equal(deliveryLocationConflict[0].status, 'rejected');
  assert.equal(deliveryLocationConflict[0].code, 'ORDER_IDEMPOTENCY_CONFLICT');

  const ordersAfterRetries = await store.getOrders(tenant.chatId);
  const paymentsAfterRetries = await store.listPayments(tenant.chatId);
  assert.equal(ordersAfterRetries.filter(order => order.id === original.id).length, 1);
  assert.equal(ordersAfterRetries.find(order => order.id === original.id).server_order_id, first[0].order_id);
  // The separate customer-binding case above creates one additional order/payment;
  // changed-payload retries must not create any further financial records.
  assert.equal(paymentsAfterRetries.length, paymentsAfterFirst.length + 1);
  assert.equal(paymentsAfterRetries.some(payment => payment.id === first[0].payment_id), true);

  // Simulate a committed server write whose response never reached the client.
  // The retry must recover the same canonical order/payment identity.
  const lostResponseOrder = { ...structuredClone(original), id: 'local-order-lost-response' };
  await store.saveQueuedOrders(tenant.chatId, [lostResponseOrder]); // response intentionally ignored
  const recoveredAfterLostResponse = await store.saveQueuedOrders(tenant.chatId, [structuredClone(lostResponseOrder)]);
  assert.equal(recoveredAfterLostResponse[0].status, 'synced');
  assert.ok(recoveredAfterLostResponse[0].order_id);
  assert.ok(recoveredAfterLostResponse[0].payment_id);
  assert.equal((await store.getOrders(tenant.chatId)).filter(order => order.id === lostResponseOrder.id).length, 1);

  // Concurrent exact retries must converge on one canonical order and payment.
  const concurrentSame = { ...structuredClone(original), id: 'local-order-concurrent-same' };
  const paymentsBeforeConcurrentCases = (await store.listPayments(tenant.chatId)).length;
  const [sameA, sameB] = await Promise.all([
    store.saveQueuedOrders(tenant.chatId, [structuredClone(concurrentSame)]),
    store.saveQueuedOrders(tenant.chatId, [structuredClone(concurrentSame)]),
  ]);
  assert.equal(sameA[0].status, 'synced');
  assert.equal(sameB[0].status, 'synced');
  assert.equal(sameA[0].order_id, sameB[0].order_id);
  assert.equal(sameA[0].payment_id, sameB[0].payment_id);
  assert.equal((await store.getOrders(tenant.chatId)).filter(order => order.id === concurrentSame.id).length, 1);

  // If different payloads race for the same local ID, exactly one identity may
  // win; the other must be rejected rather than acknowledged as a retry.
  const concurrentConflictBase = { ...structuredClone(original), id: 'local-order-concurrent-conflict' };
  const concurrentConflictChanged = {
    ...structuredClone(concurrentConflictBase),
    items: [{ id: 'tea', name: 'Tea', price: 125, qty: 2, currency: 'ETB' }],
  };
  const concurrentResults = await Promise.all([
    store.saveQueuedOrders(tenant.chatId, [concurrentConflictBase]),
    store.saveQueuedOrders(tenant.chatId, [concurrentConflictChanged]),
  ]);
  const concurrentFlat = concurrentResults.map(result => result[0]);
  assert.equal(concurrentFlat.filter(result => result.status === 'synced').length, 1);
  assert.equal(concurrentFlat.filter(result => result.status === 'rejected' && result.code === 'ORDER_IDEMPOTENCY_CONFLICT').length, 1);
  assert.equal((await store.getOrders(tenant.chatId)).filter(order => order.id === concurrentConflictBase.id).length, 1);
  assert.equal((await store.listPayments(tenant.chatId)).length, paymentsBeforeConcurrentCases + 2);

  assert.equal(recoveredAfterLostResponse[0].order_id,
    (await store.saveQueuedOrders(tenant.chatId, [structuredClone(lostResponseOrder)]))[0].order_id);
  assert.equal(recoveredAfterLostResponse[0].payment_id,
    (await store.saveQueuedOrders(tenant.chatId, [structuredClone(lostResponseOrder)]))[0].payment_id);

  // A reused local ID must conflict when checkout/fulfillment inputs change,
  // even if item totals and customer identity remain identical.
  const identityCases = [
    {
      name: 'item-type',
      initial: { items: [{ id: 'coffee', name: 'Coffee', price: 100, qty: 2, item_type: 'product' }] },
      changed: { items: [{ id: 'coffee', name: 'Coffee', price: 100, qty: 2, item_type: 'service' }] },
    },
    {
      name: 'line-modifiers',
      initial: { items: [{ id: 'coffee', name: 'Coffee', price: 100, qty: 2, modifiers: ['oat milk'] }] },
      changed: { items: [{ id: 'coffee', name: 'Coffee', price: 100, qty: 2, modifiers: ['soy milk'] }] },
    },
    { name: 'table-id', initial: { table_id: 'table-1' }, changed: { table_id: 'table-2' } },
    { name: 'table-number', initial: { table_number: 'A1' }, changed: { table_number: 'A2' } },
    { name: 'course', initial: { course: 'starter' }, changed: { course: 'main' } },
    { name: 'priority', initial: { priority: 'normal' }, changed: { priority: 'urgent' } },
    { name: 'b2b-account', initial: { b2b_account_id: 'account-1' }, changed: { b2b_account_id: 'account-2' } },
    { name: 'pricing-tier', initial: { pricing_tier_id: 'tier-1' }, changed: { pricing_tier_id: 'tier-2' } },
    { name: 'delivery-address', initial: { delivery_address: 'Address 1' }, changed: { delivery_address: 'Address 2' } },
    { name: 'pickup-location', initial: { pickup_location: 'Counter 1' }, changed: { pickup_location: 'Counter 2' } },
    { name: 'scheduled-time', initial: { scheduled_time: '2026-12-01T10:00:00+03:00' }, changed: { scheduled_time: '2026-12-01T11:00:00+03:00' } },
    {
      name: 'service-delivery-request',
      initial: { service_delivery_request: { destination_details: 'CMC', pickup_details: 'Bole' } },
      changed: { service_delivery_request: { destination_details: 'Kazanchis', pickup_details: 'Bole' } },
    },
    { name: 'cash-tendered', initial: { cash_tendered: 200 }, changed: { cash_tendered: 250 } },
    { name: 'change-due', initial: { cash_tendered: 200, change_due: 0 }, changed: { cash_tendered: 200, change_due: 25 } },
    {
      name: 'payment-proof',
      initial: { payment_proof: { path: 'opfs://proof/one.webp', fileName: 'one.webp', sizeBytes: 100 } },
      changed: { payment_proof: { path: 'opfs://proof/two.webp', fileName: 'two.webp', sizeBytes: 100 } },
    },
  ];
  for (const identityCase of identityCases) {
    const baseOrder = {
      ...structuredClone(original),
      id: 'local-order-identity-' + identityCase.name,
      ...structuredClone(identityCase.initial),
    };
    const [created] = await store.saveQueuedOrders(tenant.chatId, [baseOrder]);
    assert.equal(created.status, 'synced', identityCase.name + ' baseline order should sync');
    const changedOrder = { ...structuredClone(baseOrder), ...structuredClone(identityCase.changed) };
    const [conflict] = await store.saveQueuedOrders(tenant.chatId, [changedOrder]);
    assert.equal(conflict.status, 'rejected', identityCase.name + ' change must not be acknowledged as retry');
    assert.equal(conflict.code, 'ORDER_IDEMPOTENCY_CONFLICT', identityCase.name + ' change must return idempotency conflict');
  }

  // Object key ordering inside a structured service request is not a business
  // change and must not turn an otherwise exact retry into a conflict.
  const nestedIdentityOrder = {
    ...structuredClone(original),
    id: 'local-order-stable-nested-identity',
    payment_proof: {
      path: 'opfs://proof/stable.webp',
      metadata: { fileName: 'stable.webp', sizeBytes: 100 },
    },
  };
  const [nestedFirst] = await store.saveQueuedOrders(tenant.chatId, [nestedIdentityOrder]);
  const nestedRetry = {
    ...structuredClone(nestedIdentityOrder),
    payment_proof: {
      metadata: { sizeBytes: 100, fileName: 'stable.webp' },
      path: 'opfs://proof/stable.webp',
    },
  };
  const [nestedRetried] = await store.saveQueuedOrders(tenant.chatId, [nestedRetry]);
  assert.equal(nestedRetried.status, 'synced');
  assert.equal(nestedRetried.order_id, nestedFirst.order_id);
  assert.equal(nestedRetried.payment_id, nestedFirst.payment_id);

  // Service assessment/assignment is a later server-owned lifecycle projection.
  // It must not rewrite the original customer's service-delivery command identity.
  const serviceRequestOrder = {
    ...structuredClone(original),
    id: 'local-order-service-request-projection',
    service_delivery_request: {
      pickup_details: 'Bole, Addis Ababa',
      destination_details: 'CMC, Addis Ababa',
      customer_note: 'Call on arrival',
    },
  };
  const [serviceRequestFirst] = await store.saveQueuedOrders(tenant.chatId, [serviceRequestOrder]);
  assert.equal(serviceRequestFirst.status, 'synced');
  const db = store.getDatabaseForTests();
  const serviceRequestRow = db.prepare(
    'SELECT order_json FROM orders WHERE chat_id = ? AND local_id = ?'
  ).get(tenant.chatId, serviceRequestOrder.id);
  const serviceRequestStored = JSON.parse(serviceRequestRow.order_json);
  serviceRequestStored.service_delivery_request = {
    ...serviceRequestStored.service_delivery_request,
    assessment_status: 'READY_FOR_FULFILLMENT',
    assignment_status: 'ASSIGNED',
    assessment: {
      outcome: 'ELIGIBLE',
      assessed_at: '2026-11-27T12:00:00.000Z',
      command_key: 'service-assessment-projection',
    },
  };
  db.prepare('UPDATE orders SET order_json = ? WHERE chat_id = ? AND local_id = ?')
    .run(JSON.stringify(serviceRequestStored), tenant.chatId, serviceRequestOrder.id);
  const [serviceRequestRetry] = await store.saveQueuedOrders(tenant.chatId, [structuredClone(serviceRequestOrder)]);
  assert.equal(serviceRequestRetry.status, 'synced',
    'server-owned assessment/assignment projections must not conflict with the original sync retry');
  assert.equal(serviceRequestRetry.order_id, serviceRequestFirst.order_id);
  assert.equal(serviceRequestRetry.payment_id, serviceRequestFirst.payment_id);

  console.log('Order sync idempotency regression: PASS');
} finally {
  await rm(dir, { recursive: true, force: true });
}
