import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

const marketplaceListingsSource = await readFile(new URL('../app/src/marketplace/listings.js', import.meta.url), 'utf8');
assert.match(marketplaceListingsSource, /item\.item_type === 'service'[\s\S]*?t\('service'\)/,
  'marketplace listing UI must visibly identify service listings using the localized label');

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

  // Logistics service delivery semantics are persisted only on service catalog
  // entries and survive a read-after-write; they do not create an order or assign a courier.
  const logisticsServices = await store.saveCatalog(chatId, [
    { id: 'consultation', name: 'Consultation', price: 25000, item_type: 'service' },
    { id: 'soap', name: 'Soap', price: 5000, stock: 12 },
    { id: 'parcel-instant', name: 'Parcel Delivery Now', price: 12000, item_type: 'service',
      service_profile: 'B2C_DELIVERY', delivery_model: 'instant' },
    { id: 'parcel-request', name: 'Scheduled Parcel Delivery', price: 10000, item_type: 'service',
      service_profile: 'P2P_DELIVERY', delivery_model: 'request' },
  ]);
  assert.equal(logisticsServices.find(item => item.id === 'parcel-instant').delivery_model, 'instant');
  assert.equal(logisticsServices.find(item => item.id === 'parcel-request').delivery_model, 'request');
  const logisticsRoundTrip = (await store.getCatalog(chatId)).products;
  assert.equal(logisticsRoundTrip.find(item => item.id === 'parcel-instant').service_profile, 'B2C_DELIVERY');
  assert.equal(logisticsRoundTrip.find(item => item.id === 'parcel-instant').delivery_model, 'instant');
  assert.equal(logisticsRoundTrip.find(item => item.id === 'parcel-request').delivery_model, 'request');
  await assert.rejects(
    store.saveCatalog(chatId, [{ id: 'bad-delivery', name: 'Bad', price: 1, item_type: 'product',
      service_profile: 'B2C_DELIVERY', delivery_model: 'instant' }]),
    error => error?.code === 'LOGISTICS_SERVICE_DELIVERY_REQUIRES_SERVICE',
    'delivery models must not be attached to physical products',
  );
  await assert.rejects(
    store.saveCatalog(chatId, [{ id: 'bad-model', name: 'Bad model', price: 1, item_type: 'service',
      service_profile: 'B2C_DELIVERY', delivery_model: 'guaranteed' }]),
    /delivery_model must be one of/,
    'unsupported delivery model must be rejected by catalog authority',
  );
  await assert.rejects(
    store.appendInventoryMovement(chatId, { productId: 'consultation', movementType: 'ADJUSTMENT', quantity: 1 }),
    error => error?.code === 'SERVICE_HAS_NO_INVENTORY' && error?.statusCode === 422,
    'canonical inventory authority must reject physical stock movements for service catalog items',
  );

  // Marketplace services must remain purchasable without physical inventory.
  const marketplaceUser = await store.getOrCreateUserByTelegram('service-marketplace-' + Date.now(), 'Service Marketplace Seller');
  const marketplaceSeller = await store.createTenantForUser({
    userId: marketplaceUser.id,
    sellerName: 'Service Seller',
    businessType: 'services',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  await store.saveCatalog(marketplaceSeller.chatId, [{
    id: 'marketplace-consultation',
    name: 'Marketplace Consultation',
    price: 18000,
    item_type: 'service',
    marketplace_listed: true,
  }]);
  const serviceListing = (await store.searchMarketplaceListings()).find(item =>
    item.seller_id === marketplaceSeller.chatId && item.item_id === 'marketplace-consultation'
  );
  assert.ok(serviceListing, 'marketplace service should remain discoverable without physical stock');
  assert.equal(serviceListing.item_type, 'service', 'marketplace listing contract must expose canonical item type');
  const marketplaceServiceOrder = await store.createMarketplaceOrder({
    buyer_id: 'service-marketplace-buyer',
    customer_name: 'Service Buyer',
    items: [{ seller_id: marketplaceSeller.chatId, item_id: 'marketplace-consultation', qty: 1 }],
    idempotency_key: 'service-marketplace-checkout-' + Date.now(),
  });
  assert.ok(marketplaceServiceOrder.marketplace_order_id, 'marketplace service checkout should create a canonical marketplace order');
  assert.equal(marketplaceServiceOrder.sub_orders?.length, 1, 'marketplace service checkout should create one seller order');
  const sellerOrders = await store.getOrders(marketplaceSeller.chatId);
  const serviceSellerOrder = sellerOrders.find(order => order.is_marketplace && order.items?.some(item => item.item_id === 'marketplace-consultation'));
  assert.ok(serviceSellerOrder, 'canonical seller order should contain the marketplace service line');
  assert.equal(serviceSellerOrder.items.find(item => item.item_id === 'marketplace-consultation').item_type, 'service',
    'seller order line must preserve canonical service type');
  assert.equal((await store.getCatalog(marketplaceSeller.chatId)).products.find(item => item.id === 'marketplace-consultation').stock, undefined,
    'marketplace service checkout must not create or decrement physical stock');

  // Marketplace seller orders are also order history: a service must not be
  // reclassified as a physical product after it has been purchased.
  await assert.rejects(
    store.saveCatalog(marketplaceSeller.chatId, [{
      id: 'marketplace-consultation',
      name: 'Marketplace Consultation',
      price: 18000,
      item_type: 'product',
      stock: 0,
      marketplace_listed: true,
    }]),
    error => error?.code === 'CATALOG_ITEM_TYPE_LOCKED' && error?.statusCode === 409,
    'catalog type change after a marketplace service order must be rejected',
  );
  assert.equal(
    (await store.getCatalog(marketplaceSeller.chatId)).products.find(item => item.id === 'marketplace-consultation').item_type,
    'service',
    'rejected marketplace type change must preserve the canonical service type',
  );
  const serviceMarketplaceDb = new DatabaseSync(path.join(tempDir, 'sellify.sqlite'));
  assert.equal(serviceMarketplaceDb.prepare(
    "SELECT COUNT(*) AS count FROM inventory_movements WHERE product_id = 'marketplace-consultation'"
  ).get().count, 0, 'marketplace service checkout must not append physical inventory movements');
  assert.equal(serviceMarketplaceDb.prepare(
    "SELECT COUNT(*) AS count FROM marketplace_inventory_reservations WHERE product_id = 'marketplace-consultation'"
  ).get().count, 0, 'marketplace service checkout must not create physical inventory reservations');
  serviceMarketplaceDb.close();
  const cancelledServiceOrder = await store.updateMarketplaceOrderStatus(
    marketplaceSeller.chatId, serviceSellerOrder.id, 'cancelled'
  );
  assert.equal(cancelledServiceOrder.status, 'cancelled', 'cancelling a marketplace service order must not attempt a physical stock return');
  const cancellationDb = new DatabaseSync(path.join(tempDir, 'sellify.sqlite'));
  assert.equal(cancellationDb.prepare(
    "SELECT COUNT(*) AS count FROM inventory_movements WHERE product_id = 'marketplace-consultation'"
  ).get().count, 0, 'service order cancellation must not create physical inventory movements');
  cancellationDb.close();

  // A mixed marketplace order must release only the physical product's stock
  // on cancellation; the service must never gain a synthetic RETURN movement
  // or inventory reservation.
  await store.saveCatalog(marketplaceSeller.chatId, [
    {
      id: 'marketplace-consultation',
      name: 'Marketplace Consultation',
      price: 18000,
      item_type: 'service',
      marketplace_listed: true,
    },
    {
      id: 'marketplace-soap',
      name: 'Marketplace Soap',
      price: 5000,
      item_type: 'product',
      stock: 5,
      marketplace_listed: true,
    },
  ]);
  const mixedMarketplaceOrder = await store.createMarketplaceOrder({
    buyer_id: 'service-marketplace-mixed-buyer',
    customer_name: 'Mixed Marketplace Buyer',
    items: [
      { seller_id: marketplaceSeller.chatId, item_id: 'marketplace-consultation', qty: 1 },
      { seller_id: marketplaceSeller.chatId, item_id: 'marketplace-soap', qty: 2 },
    ],
    idempotency_key: 'service-marketplace-mixed-checkout-' + Date.now(),
  });
  assert.ok(mixedMarketplaceOrder.marketplace_order_id);
  const mixedSellerOrders = await store.getOrders(marketplaceSeller.chatId);
  const mixedSellerOrder = mixedSellerOrders.find(order =>
    order.is_marketplace &&
    order.marketplace_order_id === mixedMarketplaceOrder.marketplace_order_id
  );
  assert.ok(mixedSellerOrder, 'mixed marketplace checkout should persist its canonical seller order');
  const beforeMixedCancel = (await store.getInventoryBalances(marketplaceSeller.chatId))
    .find(row => row.productId === 'marketplace-soap')?.quantity;
  assert.equal(beforeMixedCancel, 3, 'checkout should consume two units of physical stock');
  await store.updateMarketplaceOrderStatus(marketplaceSeller.chatId, mixedSellerOrder.id, 'cancelled');
  const afterMixedCancel = (await store.getInventoryBalances(marketplaceSeller.chatId))
    .find(row => row.productId === 'marketplace-soap')?.quantity;
  assert.equal(afterMixedCancel, 5, 'cancellation should restore the physical product quantity exactly');
  const mixedMarketplaceDb = new DatabaseSync(path.join(tempDir, 'sellify.sqlite'));
  assert.equal(mixedMarketplaceDb.prepare(
    "SELECT COUNT(*) AS count FROM inventory_movements WHERE product_id = 'marketplace-consultation'"
  ).get().count, 0, 'mixed-order cancellation must not create physical movements for the service');
  assert.equal(mixedMarketplaceDb.prepare(
    "SELECT COUNT(*) AS count FROM inventory_movements WHERE product_id = 'marketplace-soap' AND movement_type = 'RETURN' AND reference_id = ?"
  ).get(mixedMarketplaceOrder.marketplace_order_id).count, 1,
  'physical stock must be restored with one canonical return movement');
  assert.equal(mixedMarketplaceDb.prepare(
    "SELECT COUNT(*) AS count FROM marketplace_inventory_reservations WHERE marketplace_order_id = ? AND product_id = 'marketplace-consultation'"
  ).get(mixedMarketplaceOrder.marketplace_order_id).count, 0,
  'service lines must not create physical inventory reservations');
  assert.equal(mixedMarketplaceDb.prepare(
    "SELECT COUNT(*) AS count FROM marketplace_inventory_reservations WHERE marketplace_order_id = ? AND product_id = 'marketplace-soap' AND status = 'released'"
  ).get(mixedMarketplaceOrder.marketplace_order_id).count, 1,
  'cancellation must release the physical product reservation');
  mixedMarketplaceDb.close();

  await assert.rejects(
    store.saveCatalog(chatId, [
      { id: 'consultation', name: 'Consultation', price: 25000, item_type: 'service' },
      { id: 'soap', name: 'Soap', price: 5000, item_type: 'service' },
    ]),
    error => error?.code === 'CATALOG_ITEM_TYPE_LOCKED' && error?.statusCode === 409,
    'catalog type must not change after physical inventory history exists',
  );
  assert.equal((await store.getCatalog(chatId)).products.find(item => item.id === 'soap').item_type, 'product', 'rejected type change must preserve the canonical catalog item');

  const storeSource = await readFile(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
  assert.match(storeSource, /if \(isService\) \{\s*throw Object\.assign\(new Error\('Service catalog items do not support physical inventory movements'\)/, 'server-side inventory authority must enforce service stock exclusion');
  assert(storeSource.includes('SELECT product_id, stock, product_json FROM catalog_products WHERE chat_id = ? AND stock IS NOT NULL') && storeSource.includes(".filter(product => parseJSON(product.product_json, {}).item_type !== 'service')"), 'legacy opening-balance migration must not create physical stock movements for services');
  assert(storeSource.includes("if (parseJSON(product.product_json, {}).item_type === 'service') {\n      throw Object.assign(new Error('Service catalog items cannot be received into physical inventory')") && storeSource.includes("code: 'SERVICE_HAS_NO_INVENTORY'"), 'procurement receiving must reject service items before creating receipt records');
  const fulfillmentStart = storeSource.indexOf('function applyCoreFulfillmentInventoryConsequence');
  const fulfillmentEnd = storeSource.indexOf('\nexport async function selectDeliveryCourier', fulfillmentStart);
  assert(fulfillmentStart >= 0 && fulfillmentEnd > fulfillmentStart, 'fulfillment inventory consequence source must exist');
  const fulfillmentSource = storeSource.slice(fulfillmentStart, fulfillmentEnd);
  assert.match(fulfillmentSource, /parseJSON\(product\.product_json, \{\}\)\.item_type === 'service'\) continue/);
  assert(fulfillmentSource.indexOf("item_type === 'service') continue") < fulfillmentSource.indexOf("if (!locationId) throw"), 'service fulfillment must bypass physical inventory-location requirements');

  const warehouseUiSource = await readFile(new URL('../app/src/warehouse/ui.js', import.meta.url), 'utf8');
  assert.match(warehouseUiSource, /const physicalProducts = products\.filter\(p => p\?\.item_type !== 'service'\)/, 'warehouse inventory list and total must count physical products only');
  assert.match(warehouseUiSource, /list\.innerHTML = physicalProducts\.map\(p =>/, 'service items must not render stock adjustment/receiving actions');
  assert.match(warehouseUiSource, /\.filter\(p => p\?\.item_type !== 'service'\)/, 'stock adjust and receive selectors must exclude services');

  const inventorySource = await readFile(new URL('../app/src/warehouse/inventory.js', import.meta.url), 'utf8');
  assert.match(inventorySource, /if \(p\?\.item_type === 'service'\) return false/);
  assert.match(inventorySource, /export function projectedStock\(p, locationId = config\.locationId \|\| ''\) \{\s*if \(p\?\.item_type === 'service'\) return null;/);
  assert.match(inventorySource, /return stock !== null && stock <= 0;/, 'untracked items and services must not be listed as out of stock');
  const catalogSource = await readFile(new URL('../app/src/products/catalog.js', import.meta.url), 'utf8');
  assert.equal(catalogSource.includes('id="editItemType-${p.id}"'), true, 'existing catalog items expose their canonical type in edit mode');
  assert.match(catalogSource, /class="editName" id="editName-\$\{p\.id\}" aria-label="\$\{escapeAttr\(t\('catalogNameLabel'\)/, 'catalog edit name field must have an accessible localized name');
  assert.match(catalogSource, /class="editPrice" id="editPrice-\$\{p\.id\}" aria-label="\$\{escapeAttr\(t\('catalogPriceLabel'\)/, 'catalog edit price field must have an accessible localized name');
  assert.match(catalogSource, /class="editCategory" id="editCategory-\$\{p\.id\}" aria-label="\$\{escapeAttr\(t\('catalogCategoryLabel'\)/, 'catalog edit category field must have an accessible localized name');
  assert.match(catalogSource, /class="editUnit" id="editUnit-\$\{p\.id\}" aria-label="\$\{escapeAttr\(t\('catalogUnitLabel'\)/, 'catalog edit unit field must have an accessible localized name');
  assert.match(catalogSource, /const itemTypeSel = document.getElementById/);
  assert.match(catalogSource, /_priceMinor: true, item_type,/, 'saving an edited catalog item persists its selected type');
  assert.match(catalogSource, /const item_type = typeSel && typeSel\.value === 'service' \? 'service' : 'product'/);
  const appHtml = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
  assert.match(appHtml, /<label for="newProdType" data-i18n="catalogItemType">/);
  assert.match(appHtml, /<option value="service" data-i18n="service">Service<\/option>/);
  const i18nSource = await readFile(new URL('../app/src/ui/i18n.js', import.meta.url), 'utf8');
  assert.match(i18nSource, /document\.documentElement\.dir = lang === 'ar' \? 'rtl' : 'ltr'/, 'Arabic must enable RTL and switching to other languages must restore LTR');
  const renderSource = await readFile(new URL('../app/src/products/render.js', import.meta.url), 'utf8');
  assert.match(renderSource, /function serviceBadgeMarkup\(p\)/);
  assert.match(renderSource, /serviceBadgeMarkup\(p\)/);
  const englishLocale = await readFile(new URL('../app/src/i18n/locales/en.js', import.meta.url), 'utf8');
  assert.match(englishLocale, /catalogItemType: "Item type"/);
  assert.match(englishLocale, /service: "Service"/);
  const localizedServiceLabels = {
    am: ['የንጥል አይነት', 'ምርት', 'አገልግሎት'],
    om: ['Gosa meeshaa', 'Oomisha', 'Tajaajila'],
    so: ['Nooca shayga', 'Badeecad', 'Adeeg'],
    sw: ['Aina ya bidhaa', 'Bidhaa', 'Huduma'],
    es: ['Tipo de artículo', 'Producto', 'Servicio'],
    hi: ['आइटम का प्रकार', 'उत्पाद', 'सेवा'],
  };
  for (const [locale, labels] of Object.entries(localizedServiceLabels)) {
    const source = await readFile(new URL(`../app/src/i18n/locales/${locale}.js`, import.meta.url), 'utf8');
    for (const [key, label] of [['catalogItemType', labels[0]], ['catalogProduct', labels[1]], ['service', labels[2]]]) {
      assert(source.includes(`${key}: ${JSON.stringify(label)}`), `${locale} must translate ${key}`);
    }
  }
  const addedLocales = {
    fr: ['Type d’article', 'Produit', 'Service'],
    ar: ['نوع العنصر', 'منتج', 'خدمة'],
    ha: ['Nau’in abu', 'Kaya', 'Sabis'],
    yo: ['Irú ohun', 'Ọjà', 'Iṣẹ́'],
    ru: ['Тип позиции', 'Товар', 'Услуга'],
    pt: ['Tipo de item', 'Produto', 'Serviço'],
  };
  const translationsRegistry = await readFile(new URL('../app/src/i18n/translations.js', import.meta.url), 'utf8');
  for (const [locale, labels] of Object.entries(addedLocales)) {
    const source = await readFile(new URL(`../app/src/i18n/locales/${locale}.js`, import.meta.url), 'utf8');
    assert(translationsRegistry.includes(`import ${locale} from './locales/${locale}.js';`), `${locale} must be registered`);
    assert(translationsRegistry.includes(` ${locale},`) || translationsRegistry.includes(`, ${locale} }`) || translationsRegistry.includes(`, ${locale},`), `${locale} must be in TRANSLATIONS`);
    for (const [key, label] of [['catalogItemType', labels[0]], ['catalogProduct', labels[1]], ['service', labels[2]]]) {
      assert(source.includes(`${key}: ${JSON.stringify(label)}`), `${locale} must translate ${key}`);
    }
  }
  for (const locale of Object.keys(addedLocales)) {
    assert(appHtml.includes(`<option value="${locale}"`), `${locale} must be available in the language selectors`);
  }

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

  // Prove the service exception against a tenant with no physical locations
  // in the database, not merely an actor whose locationId is null.
  const locationlessChatId = 'service-locationless-' + Date.now();
  await store.getOrCreateTenant(locationlessChatId);
  await store.saveCatalog(locationlessChatId, [
    { id: 'remote-consultation', name: 'Remote consultation', price: 15000, item_type: 'service' },
    { id: 'physical-item-no-location', name: 'Physical item', price: 3000, item_type: 'product' },
  ]);
  const fixtureDb = new DatabaseSync(process.env.SELLIFY_DB_PATH);
  try {
    const tenantRow = fixtureDb.prepare('SELECT organization_id FROM tenants WHERE chat_id = ?').get(locationlessChatId);
    assert(tenantRow?.organization_id, 'locationless fixture tenant must have canonical organization identity');
    assert.equal(
      fixtureDb.prepare('SELECT COUNT(*) AS count FROM inventory_movements WHERE organization_id = ?').get(tenantRow.organization_id).count,
      0,
      'locationless fixture must not have inventory movements referencing its default location'
    );
    fixtureDb.prepare("DELETE FROM locations WHERE organization_id = ?").run(tenantRow.organization_id);
    assert.equal(
      fixtureDb.prepare('SELECT COUNT(*) AS count FROM locations WHERE organization_id = ?').get(tenantRow.organization_id).count,
      0,
      'fixture must have no physical locations'
    );
  } finally {
    fixtureDb.close();
  }

  const locationlessService = await store.saveQueuedOrders(locationlessChatId, [{
    id: 'locationless-service-order',
    items: [{ item_id: 'remote-consultation', name: 'Remote consultation', qty: 1, price: 15000 }],
    fulfillment_type: 'delivery',
    delivery_address: 'Remote',
  }]);
  const locationlessServiceOrderId = locationlessService[0].order_id;
  await store.transitionOrderFulfillment(locationlessChatId, locationlessServiceOrderId, 'out_for_delivery', actor, {
    idempotencyKey: 'locationless-service-start',
  });
  const locationlessCompleted = await store.transitionOrderFulfillment(locationlessChatId, locationlessServiceOrderId, 'delivered', actor, {
    idempotencyKey: 'locationless-service-delivered',
  });
  assert.equal(locationlessCompleted.status, 'delivered', 'service fulfillment must complete with zero physical locations');

  await assert.rejects(
    store.saveCatalog(locationlessChatId, [
      { id: 'remote-consultation', name: 'Remote consultation', price: 15000, item_type: 'product' },
      { id: 'physical-item-no-location', name: 'Physical item', price: 3000, item_type: 'product' },
    ]),
    error => error?.code === 'CATALOG_ITEM_TYPE_LOCKED' && error?.statusCode === 409,
    'catalog type must remain stable after an order references the item, even when it has no inventory movements',
  );

  const locationlessPhysical = await store.saveQueuedOrders(locationlessChatId, [{
    id: 'locationless-physical-order',
    items: [{ item_id: 'physical-item-no-location', name: 'Physical item', qty: 1, price: 3000 }],
    fulfillment_type: 'delivery',
    delivery_address: 'Remote',
  }]);
  const locationlessPhysicalOrderId = locationlessPhysical[0].order_id;
  await store.transitionOrderFulfillment(locationlessChatId, locationlessPhysicalOrderId, 'out_for_delivery', actor, {
    idempotencyKey: 'locationless-physical-start',
  });
  await assert.rejects(
    store.transitionOrderFulfillment(locationlessChatId, locationlessPhysicalOrderId, 'delivered', actor, {
      idempotencyKey: 'locationless-physical-delivered',
    }),
    error => error?.code === 'FULFILLMENT_INVENTORY_LOCATION_REQUIRED',
    'physical-item fulfillment must still require a physical inventory location'
  );

  console.log('First-experience service catalog contract regression: PASS');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
