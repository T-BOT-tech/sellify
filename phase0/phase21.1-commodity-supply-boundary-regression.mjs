import assert from 'node:assert/strict';
import {
  defineCommoditySupplyReference,
  evaluateCommoditySupplyBoundary,
  phase21CommoditySupplyBoundaryContract,
} from '../app/src/commodity-supply-boundary.js';

let pass = 0;
function test(name, fn) {
  fn();
  pass += 1;
  console.log(`PASS ${name}`);
}

test('contract is composition-only', () => {
  const c = phase21CommoditySupplyBoundaryContract();
  assert.equal(c.persistence, 'none');
  assert.equal(c.mutation, false);
  assert.equal(c.transactionExecution, false);
  assert.equal(c.providerExecution, false);
});

test('commodity authority remains agriculture', () => {
  const ref = defineCommoditySupplyReference({
    commodityId: 'commodity-1',
    supplierOrganizationId: 'org-1',
  });
  assert.equal(ref.commodityReference.authority, 'agriculture');
  assert.equal(ref.commodityReference.entity, 'Commodity');
});

test('supplier authority remains supplier network', () => {
  const ref = defineCommoditySupplyReference({
    commodityId: 'commodity-1',
    supplierOrganizationId: 'org-1',
    capabilityId: 'cap-1',
  });
  assert.equal(ref.supplierReference.authority, 'supplier_network');
  assert.equal(ref.capabilityReference.authority, 'supplier_network');
});

test('product remains external catalog reference', () => {
  const ref = defineCommoditySupplyReference({
    commodityId: 'commodity-1',
    supplierOrganizationId: 'org-1',
    productId: 'product-1',
  });
  assert.equal(ref.productReference.authority, 'product_catalog');
});

test('supported composition is derived', () => {
  const result = evaluateCommoditySupplyBoundary({
    commodity: { id: 'commodity-1' },
    supplierCapability: {
      authority: 'supplier_network',
      supplierOrganizationId: 'org-1',
    },
  });
  assert.equal(result.status, 'SUPPORTED');
  assert.equal(result.persistence, 'none');
  assert.equal(result.mutation, false);
});

test('missing commodity fails closed', () => {
  const result = evaluateCommoditySupplyBoundary({
    supplierCapability: {
      authority: 'supplier_network',
      supplierOrganizationId: 'org-1',
    },
  });
  assert.equal(result.status, 'UNRESOLVED');
});

test('missing supplier fails closed', () => {
  const result = evaluateCommoditySupplyBoundary({
    commodity: { id: 'commodity-1' },
  });
  assert.equal(result.status, 'UNRESOLVED');
});

test('foreign supplier authority is rejected', () => {
  const result = evaluateCommoditySupplyBoundary({
    commodity: { id: 'commodity-1' },
    supplierCapability: {
      authority: 'other_supplier_system',
      supplierOrganizationId: 'org-1',
    },
  });
  assert.equal(result.status, 'CONFLICTING');
});

test('catalog authority is also constrained to supplier network', () => {
  const result = evaluateCommoditySupplyBoundary({
    commodity: { id: 'commodity-1' },
    supplierCapability: { supplierOrganizationId: 'org-1' },
    supplierCatalog: {
      authority: 'other_catalog',
      supplierOrganizationId: 'org-1',
    },
  });
  assert.equal(result.status, 'CONFLICTING');
});

test('references are immutable', () => {
  const ref = defineCommoditySupplyReference({
    commodityId: 'commodity-1',
    supplierOrganizationId: 'org-1',
  });
  assert.throws(() => { ref.commodityReference.id = 'changed'; }, TypeError);
});

test('does not invent inventory authority', () => {
  const result = evaluateCommoditySupplyBoundary({
    commodity: { id: 'commodity-1' },
    supplierCapability: {
      authority: 'supplier_network',
      supplierOrganizationId: 'org-1',
    },
  });
  assert.equal(result.inventoryAuthority, 'existing inventory authority');
});

test('does not invent procurement authority', () => {
  const result = evaluateCommoditySupplyBoundary({
    commodity: { id: 'commodity-1' },
    supplierCapability: {
      authority: 'supplier_network',
      supplierOrganizationId: 'org-1',
    },
  });
  assert.equal(result.procurementAuthority, 'existing procurement authority');
});

test('rejects invalid reference input', () => {
  assert.throws(() => defineCommoditySupplyReference(null), /input must be an object/);
});

test('rejects empty commodity id', () => {
  assert.throws(
    () => defineCommoditySupplyReference({
      commodityId: '',
      supplierOrganizationId: 'org-1',
    }),
    /commodityId must be a non-empty string/,
  );
});

test('rejects empty supplier id', () => {
  assert.throws(
    () => defineCommoditySupplyReference({
      commodityId: 'commodity-1',
      supplierOrganizationId: '',
    }),
    /supplierOrganizationId must be a non-empty string/,
  );
});

test('capability reference is optional', () => {
  const ref = defineCommoditySupplyReference({
    commodityId: 'commodity-1',
    supplierOrganizationId: 'org-1',
  });
  assert.equal(ref.capabilityReference, null);
});

test('product reference is optional', () => {
  const ref = defineCommoditySupplyReference({
    commodityId: 'commodity-1',
    supplierOrganizationId: 'org-1',
  });
  assert.equal(ref.productReference, null);
});

console.log(`PHASE21.1 COMMODITY/SUPPLY BOUNDARY: ${pass} PASS / 0 FAIL`);
