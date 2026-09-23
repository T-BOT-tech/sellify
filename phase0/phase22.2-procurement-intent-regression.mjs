import assert from 'node:assert/strict';
import {
  defineProcurementIntent,
  assertProcurementIntentBoundary,
  phase22ProcurementIntentContract,
} from '../app/src/phase22-procurement-intent.js';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}: ${error.message}`); process.exitCode = 1; }
};

const base = {
  organizationId: 'org-22',
  mode: 'source',
  commodityReference: { id: 'commodity-sesame', authority: 'agriculture' },
  quantity: 500,
  unit: 'ton',
  currency: 'ETB',
  destination: { id: 'location-kenya', authority: 'locations' },
};

test('normalizes a valid procurement intent', () => {
  const intent = defineProcurementIntent(base);
  assert.equal(intent.version, '1.0');
  assert.equal(intent.mode, 'SOURCE');
  assert.equal(intent.quantity, 500);
  assert.equal(intent.destination.authority, 'locations');
  assert.equal(intent.persistence, 'none');
});

test('supports product-based procurement when commodity is absent', () => {
  const intent = defineProcurementIntent({ ...base, commodityReference: undefined, productReference: { id: 'product-1', authority: 'product_catalog' } });
  assert.equal(intent.productReference.entity, 'Product');
  assert.equal(intent.commodityReference, null);
});

test('rejects an intent without commodity or product reference', () => {
  assert.throws(() => defineProcurementIntent({ ...base, commodityReference: undefined }), /commodityReference or productReference is required/);
});

test('rejects unknown fields instead of silently accepting them', () => {
  assert.throws(() => defineProcurementIntent({ ...base, supplierRanking: [] }), /forbidden field: supplierRanking/);
});

test('rejects direct execution and authorization fields', () => {
  assert.throws(() => defineProcurementIntent({ ...base, directExecution: true }), /forbidden field: directExecution/);
  assert.throws(() => defineProcurementIntent({ ...base, authorizationGrant: true }), /forbidden field: authorizationGrant/);
});

test('rejects database and credential fields', () => {
  assert.throws(() => defineProcurementIntent({ ...base, database: 'x' }), /forbidden field: database/);
  assert.throws(() => defineProcurementIntent({ ...base, credentials: 'x' }), /forbidden field: credentials/);
});

test('rejects supplier ranking and selection instructions', () => {
  assert.throws(() => defineProcurementIntent({ ...base, rankedSuppliers: ['s1'] }), /forbidden field: rankedSuppliers/);
  assert.throws(() => defineProcurementIntent({ ...base, selectedSupplier: 's1' }), /forbidden field: selectedSupplier/);
});

test('rejects feasibility and compliance decisions', () => {
  assert.throws(() => defineProcurementIntent({ ...base, feasibilityDecision: 'FEASIBLE' }), /forbidden field: feasibilityDecision/);
  assert.throws(() => defineProcurementIntent({ ...base, complianceDecision: 'PASS' }), /forbidden field: complianceDecision/);
});

test('accepts user-stated preferred supplier references without selecting a supplier', () => {
  const intent = defineProcurementIntent({ ...base, preferredSupplierReferences: [{ id: 'supplier-1', authority: 'supplier_network' }] });
  assert.equal(intent.preferredSupplierReferences[0].id, 'supplier-1');
  assert.equal(intent.supplierSelection, false);
});

test('normalizes ISO required date and freezes nested data', () => {
  const intent = defineProcurementIntent({ ...base, requiredDate: '2026-10-15T12:00:00Z', commercialRequirements: { incoterm: 'DAP' } });
  assert.equal(intent.requiredDate, '2026-10-15T12:00:00.000Z');
  assert.equal(Object.isFrozen(intent), true);
  assert.equal(Object.isFrozen(intent.commercialRequirements), true);
});

test('rejects invalid quantity, mode, and date', () => {
  assert.throws(() => defineProcurementIntent({ ...base, quantity: 0 }), /quantity must be a positive number/);
  assert.throws(() => defineProcurementIntent({ ...base, mode: 'NEGOTIATE' }), /mode must be one of/);
  assert.throws(() => defineProcurementIntent({ ...base, requiredDate: 'not-a-date' }), /requiredDate must be a valid ISO-8601 date\/time/);
});

test('boundary assertion remains non-authoritative', () => {
  assert.equal(assertProcurementIntentBoundary(base), true);
  const contract = phase22ProcurementIntentContract();
  assert.equal(contract.persistence, 'none');
  assert.equal(contract.authorization, false);
  assert.equal(contract.transactionExecution, false);
  assert.equal(contract.procurementDemandAuthority, 'existing procurement authority');
  assert.equal(contract.purchaseOrderAuthority, 'existing procurement authority');
});

test('does not expose a transaction or persistence capability', () => {
  const intent = defineProcurementIntent(base);
  for (const key of ['transaction', 'database', 'credentials', 'ledger', 'eventStore', 'rawCommand']) {
    assert.equal(Object.hasOwn(intent, key), false);
  }
});

console.log(`\nPhase 22.2 Procurement Intent Regression: ${passed} PASS / ${process.exitCode ? 'FAIL' : '0 FAIL'}`);
