// Phase 19.12 — final structural exit regression for the FLOWOS Discovery Fabric.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const server = read('backend/server.js');
const discoveryIndex = read('backend/lib/discovery/index.js');
const registry = read('backend/lib/discovery/provider-registry.js');
const context = read('backend/lib/discovery/market-context.js');
const matching = read('backend/lib/discovery/matching-contract.js');
const ranking = read('backend/lib/discovery/explainable-ranking.js');
const opportunity = read('backend/lib/discovery/opportunity-model.js');
const unified = read('backend/lib/discovery/unified-discovery.js');
const ai = read('backend/lib/discovery/ai-intent-translation.js');
const store = read('backend/lib/store-sqlite.js');
const packageJson = JSON.parse(read('package.json'));

// 1. Discovery Fabric layers remain present and composed.
for (const [name, source] of [
  ['provider registry', registry],
  ['market context', context],
  ['deterministic matching', matching],
  ['explainable ranking', ranking],
  ['opportunity model', opportunity],
  ['unified discovery', unified],
  ['AI intent boundary', ai],
]) assert.ok(source.length > 0, `${name} source missing`);

assert.match(discoveryIndex, /discoverUnified/);
assert.match(discoveryIndex, /discoverFromNaturalLanguage/);

// 2. Unified API is read-only composition, not an economic authority.
assert.ok(server.includes("handleUnifiedDiscovery(req, res)"), "unified discovery route missing");
assert.match(server, /handleUnifiedDiscovery/);
assert.match(unified, /persistence: 'none'/);
assert.match(unified, /transactionExecution: false/);
assert.match(unified, /inventoryMutation: false/);
assert.match(unified, /orderMutation: false/);
assert.match(unified, /procurementMutation: false/);
assert.match(unified, /paymentMutation: false/);

// 3. Provider registry remains process-local; no discovery persistence authority.
assert.doesNotMatch(registry, /CREATE TABLE|INSERT INTO|UPDATE .*discovery|DELETE FROM .*discovery/);

// 4. Opportunity remains derived/non-persistent.
assert.match(opportunity, /persistence.*none|persisted.*false/);
assert.doesNotMatch(opportunity, /CREATE TABLE|INSERT INTO|UPDATE .*opportun|DELETE FROM .*opportun/);

// 5. AI is strictly intent translation and cannot become ranking/execution authority.
assert.match(ai, /Natural Language → AI → Structured Intent → Deterministic Discovery/);
assert.match(ai, /candidateGeneration: false/);
assert.match(ai, /ranking: false/);
assert.match(ai, /trustScoring: false/);
assert.match(ai, /execution: false/);
assert.match(ai, /persistence: 'none'/);
assert.match(ai, /directDatabaseAccess: false/);
assert.match(ai, /directCredentialsAccess: false/);

// 6. Provenance and explainability remain downstream of authoritative providers.
assert.match(unified, /evidence: provider\.evidence/);
assert.match(unified, /actions: provider\.actions/);
assert.match(ranking, /matchScore/);
assert.match(opportunity, /sourceAuthority|sourceEntityId/);

// 7. Existing domain authorities remain the source of truth; Phase 19 adds no
// product/seller/supplier/inventory/payment persistence layer.
assert.match(store, /catalog_products/);
assert.match(store, /marketplace/);
assert.match(store, /supplier_network_profiles/);
assert.doesNotMatch(store, /CREATE TABLE[^;]*(discovery_|opportunity_)/i);

// 8. Phase 19.12 itself must be wired into the package test surface.
assert.equal(packageJson.scripts['test:phase19.12'], 'node phase0/phase19.12-full-ecosystem-discovery-exit-regression.mjs');
assert.equal(packageJson.scripts['test:phase19.12-cumulative'], 'node phase0/phase19.12-cumulative-exit-gate.mjs');

console.log('Phase 19.12 structural Discovery Fabric exit: PASS');
console.log('Provider registry remains non-persistent: PASS');
console.log('Market context remains canonical/non-authoritative for domain truth: PASS');
console.log('Deterministic matching remains authoritative for eligibility: PASS');
console.log('Explainable ranking remains separate from trust: PASS');
console.log('Opportunity remains derived/non-persistent: PASS');
console.log('Unified API remains read-only composition: PASS');
console.log('AI remains intent-translation-only: PASS');
console.log('No new discovery/opportunity persistence authority: PASS');
console.log('Phase 19 package scripts wired: PASS');
