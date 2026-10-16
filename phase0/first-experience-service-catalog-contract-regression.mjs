import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-service-catalog-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const chatId = 'service-catalog-' + Date.now();
  await store.getOrCreateTenant(chatId);
  const saved = await store.saveCatalog(chatId, [
    { id: 'consultation', name: 'Consultation', price: 25000, item_type: 'service' },
    { id: 'soap', name: 'Soap', price: 5000, stock: 12 },
  ]);
  assert.equal(saved.find(item => item.id === 'consultation').item_type, 'service');
  assert.equal(saved.find(item => item.id === 'soap').item_type, 'product', 'legacy catalog entries default to physical products');
  assert.equal(saved.find(item => item.id === 'consultation').stock, undefined, 'service creation does not invent stock');
  const roundTrip = (await store.getCatalog(chatId)).products;
  assert.equal(roundTrip.find(item => item.id === 'consultation').item_type, 'service');
  assert.equal(roundTrip.find(item => item.id === 'soap').item_type, 'product');

  const storeSource = await readFile(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
  const fulfillmentStart = storeSource.indexOf('function applyCoreFulfillmentInventoryConsequence');
  const fulfillmentEnd = storeSource.indexOf('\nexport async function selectDeliveryCourier', fulfillmentStart);
  assert(fulfillmentStart >= 0 && fulfillmentEnd > fulfillmentStart, 'fulfillment inventory consequence source must exist');
  const fulfillmentSource = storeSource.slice(fulfillmentStart, fulfillmentEnd);
  assert.match(fulfillmentSource, /parseJSON\(product\.product_json, \{\}\)\.item_type === 'service'\) continue/);
  assert(fulfillmentSource.indexOf("item_type === 'service') continue") < fulfillmentSource.indexOf("if (!locationId) throw"), 'service fulfillment must bypass physical inventory-location requirements');

  const inventorySource = await readFile(new URL('../app/src/warehouse/inventory.js', import.meta.url), 'utf8');
  assert.match(inventorySource, /if \(p\?\.item_type === 'service'\) return false/);
  const catalogSource = await readFile(new URL('../app/src/products/catalog.js', import.meta.url), 'utf8');
  assert.match(catalogSource, /const item_type = typeSel && typeSel\.value === 'service' \? 'service' : 'product'/);
  const appHtml = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
  assert.match(appHtml, /<label for="newProdType" data-i18n="catalogItemType">/);
  assert.match(appHtml, /<option value="service" data-i18n="service">Service<\/option>/);
  const renderSource = await readFile(new URL('../app/src/products/render.js', import.meta.url), 'utf8');
  assert.match(renderSource, /function serviceBadgeMarkup\(p\)/);
  assert.match(renderSource, /serviceBadgeMarkup\(p\)/);
  const englishLocale = await readFile(new URL('../app/src/i18n/locales/en.js', import.meta.url), 'utf8');
  assert.match(englishLocale, /catalogItemType: "Item type"/);
  assert.match(englishLocale, /service: "Service"/);

  // Exercise the real canonical order -> fulfillment -> inventory path, not
  // only source guards. The service line must not produce a physical stock sale.
  const integrationChatId = 'service-fulfillment-' + Date.now();
  const integrationTenant = await store.getOrCreateTenant(integrationChatId);
  await store.saveCatalog(integrationChatId, [
    { id: 'consultation-e2e', name: 'Consultation', price: 25000, item_type: 'service' },
    { id: 'soap-e2e', name: 'Soap', price: 5000, stock: 5, item_type: 'product' },
  ]);
  await store.appendInventoryMovement(integrationChatId, {
    productId: 'soap-e2e', quantity: 5, movementType: 'PURCHASE',
    eventId: 'service-fulfillment-opening-stock',
  });
  const actor = { userId: 'service-catalog-test-user', deviceId: 'service-catalog-test-device', locationId: null };

  const serviceOrder = await store.saveQueuedOrders(integrationChatId, [{
    id: 'local-service-only-order',
    items: [{ item_id: 'consultation-e2e', name: 'Consultation', qty: 1, price: 25000, item_type: 'product' }],
    fulfillment_type: 'delivery',
    delivery_address: 'Test destination',
  }]);
  assert.equal(serviceOrder[0].status, 'synced');
  const serviceOrderId = serviceOrder[0].order_id;
  const beforeService = (await store.getInventoryBalances(integrationChatId))
    .find(row => row.productId === 'soap-e2e')?.quantity;
  await store.transitionOrderFulfillment(integrationChatId, serviceOrderId, 'out_for_delivery', actor, {
    idempotencyKey: 'service-only-start',
  });
  const completedService = await store.transitionOrderFulfillment(integrationChatId, serviceOrderId, 'delivered', actor, {
    idempotencyKey: 'service-only-delivered',
  });
  assert.equal(completedService.status, 'delivered');
  const afterService = (await store.getInventoryBalances(integrationChatId))
    .find(row => row.productId === 'soap-e2e')?.quantity;
  assert.equal(afterService, beforeService, 'service-only fulfillment must not move unrelated physical stock');

  const mixedOrder = await store.saveQueuedOrders(integrationChatId, [{
    id: 'local-mixed-service-product-order',
    items: [
      { item_id: 'consultation-e2e', name: 'Consultation', qty: 1, price: 25000, item_type: 'product' },
      { item_id: 'soap-e2e', name: 'Soap', qty: 2, price: 5000, item_type: 'service' },
    ],
    fulfillment_type: 'delivery',
    delivery_address: 'Test destination',
  }]);
  assert.equal(mixedOrder[0].status, 'synced');
  const mixedOrderId = mixedOrder[0].order_id;
  const beforeMixed = (await store.getInventoryBalances(integrationChatId))
    .find(row => row.productId === 'soap-e2e')?.quantity;
  await store.transitionOrderFulfillment(integrationChatId, mixedOrderId, 'out_for_delivery', actor, {
    idempotencyKey: 'mixed-order-start',
  });
  const completedMixed = await store.transitionOrderFulfillment(integrationChatId, mixedOrderId, 'delivered', actor, {
    idempotencyKey: 'mixed-order-delivered',
  });
  assert.equal(completedMixed.status, 'delivered');
  const afterMixed = (await store.getInventoryBalances(integrationChatId))
    .find(row => row.productId === 'soap-e2e')?.quantity;
  assert.equal(beforeMixed - afterMixed, 2, 'server catalog type, not client line metadata, determines stock deduction');
  await store.transitionOrderFulfillment(integrationChatId, mixedOrderId, 'delivered', actor, {
    idempotencyKey: 'mixed-order-delivered',
  });
  const afterMixedRetry = (await store.getInventoryBalances(integrationChatId))
    .find(row => row.productId === 'soap-e2e')?.quantity;
  assert.equal(afterMixedRetry, afterMixed, 'exact fulfillment retry must not duplicate inventory deduction');

  console.log('First-experience service catalog contract regression: PASS');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
