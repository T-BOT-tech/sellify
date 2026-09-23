import assert from 'node:assert/strict';
import {PROCUREMENT_RECEIVING_CONTRACT,PROCUREMENT_RECEIVING_CONTRACT_VERSION} from '../app/src/procurement/receiving-contract.js';
assert.equal(PROCUREMENT_RECEIVING_CONTRACT_VERSION,'1.0');
assert.equal(PROCUREMENT_RECEIVING_CONTRACT.operation,'createProcurementReceipt');
assert.equal(PROCUREMENT_RECEIVING_CONTRACT.inventoryMovementType,'PURCHASE');
assert.equal(PROCUREMENT_RECEIVING_CONTRACT.createsNewInventoryAuthority,false);
assert.equal(PROCUREMENT_RECEIVING_CONTRACT.supportsPartialReceipts,true);
assert.ok(PROCUREMENT_RECEIVING_CONTRACT.prerequisites.includes('no_over_receipt'));
console.log('Phase 17.7 Receiving Contract Regression: PASS');
