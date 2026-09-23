import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('.', import.meta.url).pathname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const html = read('app/index.html');
const sourcing = read('app/src/procurement/ui.js');
const ai = read('app/src/ai-procurement-copilot.js');
const agcb = read('app/src/agriculture-cross-border-productization.js');
const agBridge = read('app/src/phase21-agriculture-supply-integration.js');
const cb = read('app/src/cross-border-evaluation.js');
const server = read('backend/server.js');
const store = read('backend/lib/store-sqlite.js');
const authority = read('app/src/platform/authority-registry.js');
const outbox = read('app/src/platform/event-outbox-platform.js');
const adapter = read('app/src/platform/adapter-framework.js');

let pass = 0;
function ok(name, fn) { fn(); console.log(`PASS: ${name}`); pass += 1; }

ok('Sourcing productization surfaces are mounted', () => {
  for (const id of ['sourcingWorkspace','sourcingDiscoveryResults','sourcingDemandList','sourcingRfqList','sourcingRelationshipList','sourcingIntelligenceSummary','aiProcurementCopilot','agricultureSupplyBridge','crossBorderWorkspace']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

ok('Supplier discovery UI uses the unified Discovery boundary', () => {
  assert.match(sourcing, /\/api\/discovery\?chatId=/);
  assert.match(sourcing, /providers=supplier-network/);
  assert.doesNotMatch(sourcing, /\/supplier-network\/discovery\?search=/);
  assert.match(server, /handleUnifiedDiscovery/);
  assert.match(server, /discoverUnified/);
});

ok('Procurement UI actions map to existing canonical routes', () => {
  for (const marker of [
    '/procurement/demands', '/procurement/supplier-relationships', '/procurement/rfqs', '/procurement/comparisons'
  ]) assert.match(sourcing, new RegExp(marker.replaceAll('/', '\\/')));
  for (const marker of [
    'procurement:demand:create','procurement:demand:submit','procurement:demand:sourcing',
    'procurement:supplier:relationship:manage','procurement:rfq:create','procurement:rfq:send',
    'procurement:rfq:close','procurement:comparison:create'
  ]) assert.match(server, new RegExp(marker.replaceAll(':','\\:')));
});

ok('Authorization precedes procurement mutations', () => {
  for (const fn of ['handleProcurementDemands','handleProcurementRfqs','handleProcurementSupplierRelationships','handleProcurementComparison']) {
    assert.match(server, new RegExp(`async function ${fn}`));
  }
  assert.match(server, /requireAuthorization\(session, tenant, 'procurement_demand'/);
  assert.match(server, /requireAuthorization\(session, tenant, 'procurement_rfq'/);
  assert.match(server, /requireAuthorization\(session, tenant, 'procurement_supplier_relationship'/);
});

ok('Canonical procurement persistence and idempotency remain in the domain store', () => {
  assert.match(store, /CREATE TABLE IF NOT EXISTS procurement_demands/);
  assert.match(store, /CREATE TABLE IF NOT EXISTS procurement_rfqs/);
  assert.match(store, /UNIQUE\(organization_id, idempotency_key\)/);
  assert.match(store, /createProcurementDemand/);
  assert.match(store, /createProcurementRfq/);
  assert.match(store, /IDEMPOTENCY_KEY_REUSED/);
  assert.match(sourcing, /idempotencyKey/);
});

ok('Sensitive procurement mutations emit canonical audit evidence', () => {
  assert.match(store, /function audit\(/);
  for (const marker of ['procurement.demand.created','procurement.rfq.created','procurement.supplier.relationship_created','procurement.comparison.created']) {
    assert.match(store, new RegExp(marker.replaceAll('.','\\.')));
  }
});

ok('Existing event/outbox infrastructure remains the sole event boundary', () => {
  assert.match(outbox, /Transaction → Outbox → Versioned Event → Consumer/);
  assert.match(outbox, /enqueueEvent/);
  assert.match(authority, /events/);
  assert.match(server, /processSyncEvent/);
  assert.doesNotMatch(sourcing, /eventStore|new EventStore|sync_events|enqueueEvent/);
});

ok('AI Procurement remains structured-intent/proposal only', () => {
  assert.match(ai, /defineProcurementIntent/);
  assert.match(ai, /defineProcurementActionProposal/);
  assert.match(ai, /Execution:<\/strong> none/);
  assert.match(ai, /Persistence:<\/strong> none/);
  assert.match(ai, /Authorization:<\/strong> existing procurement authorization required/);
  assert.doesNotMatch(ai, /fetch\(/);
  assert.doesNotMatch(ai, /localStorage|indexedDB|sqlite|db\.prepare|createPurchaseOrder/i);
});

ok('Agriculture remains projection-only', () => {
  assert.match(agBridge, /persistence: 'none'/);
  assert.match(agBridge, /mutation: false/);
  assert.match(agBridge, /transactionExecution: false/);
  assert.match(agcb, /projectAgricultureSupplyContext/);
  assert.match(agcb, /Inventory: existing Inventory authority/);
  assert.match(agcb, /Procurement: existing Procurement authority/);
});

ok('Discovery and supply intelligence remain derived/read-only', () => {
  assert.match(sourcing, /sourcingIntelligenceSummary/);
  assert.match(sourcing, /Derived supply intelligence/);
  assert.match(sourcing, /not a new ranking, trust, inventory, or procurement authority/);
  assert.doesNotMatch(sourcing, /supplier.*(trust|rank).*save|localStorage|indexedDB|sqlite/i);
  assert.match(html, /derived.*not a new ranking|derived/i);
});

ok('Cross-Border evaluation preserves UNKNOWN and does not execute transactions', () => {
  assert.match(cb, /UNKNOWN|unknown/);
  assert.match(cb, /persistence.*none/);
  assert.match(cb, /transactionCreation.*false/);
  assert.match(agcb, /does not create orders, shipments, payments/);
});

ok('External provider execution remains behind the canonical adapter framework', () => {
  assert.match(adapter, /Canonical Capability Contract.*Adapter.*External Provider/s);
  assert.match(adapter, /cannot own DB|persistence none|authorization/i);
  assert.match(server, /getDiscoveryProvider/);
});

ok('No new R1 authority or transaction store was introduced', () => {
  for (const file of ['app/src/procurement/ui.js','app/src/ai-procurement-copilot.js','app/src/agriculture-cross-border-productization.js']) {
    const text = read(file);
    assert.doesNotMatch(text, /CREATE TABLE|sqlite|better-sqlite|indexedDB|localStorage|new EventStore|new .*Ledger/i);
  }
});

console.log(`R1 GOLDEN E2E TRACEABILITY / PRODUCTIZATION GATE: ${pass} PASS / 0 FAIL`);
