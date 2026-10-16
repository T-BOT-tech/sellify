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

  console.log('First-experience service catalog contract regression: PASS');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
