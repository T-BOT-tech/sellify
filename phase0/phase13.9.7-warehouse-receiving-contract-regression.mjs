import assert from 'node:assert/strict';
import {
  buildWarehouseReceivingContract,
  isWarehouseReceivingContract,
  warehouseReceivingContract,
} from '../app/src/verticals/warehouse/receiving-contract.js';

const product = { id: 'p-1', name: 'Coffee', organization_id: 'org-1' };
const location = { id: 'loc-1', code: 'WH-A', name: 'Main Warehouse', type: 'WAREHOUSE', organization_id: 'org-1' };
const receiving = {
  id: 'recv-1', organization_id: 'org-1', product_id: 'p-1', quantity: 12,
  batch_number: 'B-01', expiry_date: '2027-01-31', bin_location: 'BIN-A1',
  reference: 'PO-100', notes: 'Morning delivery',
};

const contract = buildWarehouseReceivingContract({ receiving, product, location });
assert.equal(contract.receiving_id, 'recv-1');
assert.equal(contract.organization_id, 'org-1');
assert.equal(contract.product_id, 'p-1');
assert.equal(contract.location_id, 'loc-1');
assert.equal(contract.quantity, 12);
assert.equal(contract.batch_number, 'B-01');
assert.equal(contract.expiry_date, '2027-01-31');
assert.equal(contract.storage_bin, 'BIN-A1');
assert.equal(contract.reference, 'PO-100');
assert.equal(contract.notes, 'Morning delivery');
assert.equal(contract.movement_type, 'received');
assert.equal(contract.reference_type, 'warehouse_receiving');
assert.equal(contract.reference_id, 'recv-1');
assert.equal(contract.event_id, 'warehouse:receiving:recv-1:received');
assert.equal(contract.persistence, 'delegated_to_existing_inventory_authority');
assert.equal(isWarehouseReceivingContract(contract), true);
assert.equal(Object.isFrozen(contract), true);

assert.throws(() => buildWarehouseReceivingContract({ receiving, product, location: { ...location, organization_id: 'org-2' } }), /different organization/);
assert.throws(() => buildWarehouseReceivingContract({ receiving: { ...receiving, quantity: 0 }, product, location }), /greater than zero/);
assert.throws(() => buildWarehouseReceivingContract({ receiving: { ...receiving, product_id: 'p-2' }, product, location }), /reference the supplied Product/);
assert.throws(() => buildWarehouseReceivingContract({ receiving: { ...receiving, organization_id: 'org-2' }, product, location }), /different organization/);
assert.throws(() => buildWarehouseReceivingContract({ receiving: { ...receiving, id: '' }, product, location }), /receiving_id/);

const metadata = warehouseReceivingContract();
assert.equal(metadata.receiving_authority, 'warehouse');
assert.equal(metadata.product_authority, 'commerce');
assert.equal(metadata.inventory_authority, 'inventory');
assert.equal(metadata.location_authority, 'locations');
assert.equal(metadata.mutation_authority, 'app/src/warehouse/inventory.js#applyStockChange');
assert.equal(metadata.ledger_authority, 'app/src/warehouse/ledger.js#recordInventoryMovement');
assert.equal(metadata.idempotency_key, 'event_id');
assert.equal(metadata.duplicate_receiving_authority, false);
assert.equal(metadata.duplicate_inventory_authority, false);
assert.deepEqual(metadata.optional_metadata, ['batch_number', 'expiry_date', 'storage_bin', 'reference', 'notes']);

const minimal = buildWarehouseReceivingContract({
  receiving: { id: 'recv-2', organization_id: 'org-1', product_id: 'p-1', quantity: 2 },
  product,
  location,
});
assert.equal(minimal.batch_number, null);
assert.equal(minimal.expiry_date, null);
assert.equal(minimal.storage_bin, null);
assert.equal(minimal.reference, null);
assert.equal(minimal.notes, null);

console.log('Phase 13.9.7 Warehouse Receiving Contract Regression: PASS');
