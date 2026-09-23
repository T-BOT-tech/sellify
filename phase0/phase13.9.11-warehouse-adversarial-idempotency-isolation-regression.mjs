import assert from 'node:assert/strict';
import { buildWarehouseReceivingBridge, buildWarehouseStockAdjustmentBridge } from '../app/src/verticals/warehouse/inventory-bridge.js';
import { getWarehouseLocationContext } from '../app/src/verticals/warehouse/location-bridge.js';
import { buildWarehouseReceivingContract } from '../app/src/verticals/warehouse/receiving-contract.js';
import { buildWarehouseStockAdjustmentContract } from '../app/src/verticals/warehouse/stock-adjustment-contract.js';
import { assertWarehouseOrganizationIsolation, assertWarehouseEventIdentity, warehouseAdversarialContract } from '../app/src/verticals/warehouse/adversarial-contract.js';

const orgA = 'org-a';
const orgB = 'org-b';
const productA = { id: 'p-1', organization_id: orgA, name: 'Rice' };
const productB = { id: 'p-2', organization_id: orgB, name: 'Oil' };
const locationA = { id: 'loc-a', organization_id: orgA, code: 'WH-A', name: 'Warehouse A', type: 'WAREHOUSE', status: 'active' };
const locationB = { id: 'loc-b', organization_id: orgB, code: 'WH-B', name: 'Warehouse B', type: 'WAREHOUSE', status: 'active' };
const inactiveA = { id: 'loc-x', organization_id: orgA, code: 'WH-X', name: 'Inactive', type: 'WAREHOUSE', status: 'inactive' };

const receiving = { id: 'recv-1', organization_id: orgA, product_id: productA.id, quantity: 5, event_id: 'evt-recv-1' };
const adjustment = { id: 'adj-1', organization_id: orgA, product_id: productA.id, delta: -2, event_id: 'evt-adj-1' };

assert.doesNotThrow(() => assertWarehouseOrganizationIsolation({ organizationId: orgA, records: [productA, locationA] }));
assert.throws(() => assertWarehouseOrganizationIsolation({ organizationId: orgA, records: [productB, locationA] }), /cross-organization/);
assert.throws(() => buildWarehouseReceivingBridge({ receiving, product: productB, location: locationA }), /different organization/);
assert.throws(() => buildWarehouseStockAdjustmentBridge({ adjustment, product: productA, location: locationB }), /different organization/);

assert.doesNotThrow(() => buildWarehouseReceivingBridge({ receiving, product: productA, location: locationA }));
assert.doesNotThrow(() => buildWarehouseStockAdjustmentBridge({ adjustment, product: productA, location: locationA }));
assert.equal(buildWarehouseReceivingBridge({ receiving, product: productA, location: locationA }).event_id, receiving.event_id);
assert.equal(buildWarehouseReceivingBridge({ receiving, product: productA, location: locationA }).event_id, buildWarehouseReceivingBridge({ receiving, product: productA, location: locationA }).event_id);
assert.equal(buildWarehouseStockAdjustmentBridge({ adjustment, product: productA, location: locationA }).event_id, adjustment.event_id);
assert.doesNotThrow(() => assertWarehouseEventIdentity(receiving.event_id, receiving.event_id));
assert.throws(() => assertWarehouseEventIdentity(receiving.event_id, 'evt-other'), /identity mismatch/);

assert.throws(() => getWarehouseLocationContext({ organizationId: orgA, locationId: locationB.id, organizationLocations: [locationB] }), /different organization/);
assert.throws(() => getWarehouseLocationContext({ organizationId: orgA, locationId: inactiveA.id, organizationLocations: [inactiveA] }), /not an active Core location/);

const receivingContract = buildWarehouseReceivingContract({ receiving, product: productA, location: locationA });
const adjustmentContract = buildWarehouseStockAdjustmentContract({ adjustment, product: productA, location: locationA });
assert.equal(receivingContract.event_id, 'evt-recv-1');
assert.equal(adjustmentContract.event_id, 'evt-adj-1');
assert.equal(receivingContract.organization_id, orgA);
assert.equal(adjustmentContract.organization_id, orgA);
assert.equal(warehouseAdversarialContract().execution_idempotency, 'delegated_to_existing_core_authority');
assert.equal(warehouseAdversarialContract().duplicate_authority, false);

// Explicitly prove that the boundary contract is not itself a stock writer.
// Execution is delegated through the existing authority and preserves the
// exact event identity supplied by the Warehouse operation.
let calls = [];
const fakeApplyStockChange = (...args) => { calls.push(args); return { id: 'tx-1' }; };
const { executeWarehouseInventoryBridge } = await import('../app/src/verticals/warehouse/inventory-bridge.js');
const bridge = buildWarehouseReceivingBridge({ receiving, product: productA, location: locationA });
executeWarehouseInventoryBridge(bridge, { applyStockChange: fakeApplyStockChange });
executeWarehouseInventoryBridge(bridge, { applyStockChange: fakeApplyStockChange });
assert.equal(calls.length, 2);
assert.equal(calls[0][3].eventId, calls[1][3].eventId);
assert.equal(calls[0][3].eventId, 'evt-recv-1');

console.log('Phase 13.9.11 Warehouse Adversarial / Idempotency / Isolation Regression: PASS');
console.log('Cross-organization references: rejected');
console.log('Inactive canonical locations: rejected');
console.log('Repeated operations: preserve the same event_id');
console.log('Execution idempotency: delegated to existing Core authority; no duplicate Warehouse authority introduced');
