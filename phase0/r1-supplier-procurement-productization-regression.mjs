import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('.', import.meta.url).pathname, '..');
const server = fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'app/src/procurement/ui.js'), 'utf8');
const tabs = fs.readFileSync(path.join(root, 'app/src/ui/tabs.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');

for (const route of [
  '/supplier-relationships', '/rfqs$', '/rfqs\\/([^/]+)\\/responses', '/procurement\\/comparisons',
]) assert.ok(server.includes(route), `missing route marker: ${route}`);
assert.match(server, /createProcurementRfq/);
assert.match(server, /transitionProcurementRfq/);
assert.match(server, /createProcurementRfqResponse/);
assert.match(server, /listProcurementSupplierRelationships/);
assert.match(server, /createProcurementSupplierRelationship/);

for (const id of ['sourcingWorkspace','sourcingDiscoveryResults','sourcingDemandList','sourcingRfqList','sourcingRelationshipList']) assert.match(html, new RegExp(`id=["']${id}["']`));
assert.match(html, /id=["']sourcingIntelligenceSummary["']/);
assert.match(ui, /renderSupplyIntelligence/);
assert.match(tabs, /renderSourcing/);
assert.match(tabs, /'sourcing'/);
assert.match(ui, /\/api\/discovery\?chatId=/);
assert.match(ui, /providers=supplier-network/);
assert.match(ui, /data.candidates/);
assert.match(ui, /procurement\/demands/);
assert.match(ui, /procurement\/supplier-relationships/);
assert.match(ui, /procurement\/rfqs/);
assert.match(ui, /procurement\/comparisons/);
assert.match(ui, /idempotencyKey/);
assert.match(ui, /existing backend supplier\/procurement domains/);

// Productization must route into the existing domains; it must not introduce
// a local supplier/procurement transaction store or a second ledger.
assert.doesNotMatch(ui, /localStorage|indexedDB|sqlite|ledger/i);
console.log('R1 Supplier Network + Procurement Productization Regression: PASS');
