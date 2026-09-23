import assert from 'node:assert/strict';
import { normalizeDeliveryProof, normalizeLogisticsReturn, logisticsProofReturnContract } from '../app/src/verticals/logistics/proof-return-contract.js';

const proof = normalizeDeliveryProof({ type: 'PHOTO', ref: 'photo-1', captured_at: '2026-09-08T10:30:00Z' });
assert.deepEqual(proof, { type: 'photo', ref: 'photo-1', captured_at: '2026-09-08T10:30:00Z' });
const returned = normalizeLogisticsReturn({ order_id: 'ORDER-RETURN', status: 'RECEIVED', reason: 'damaged', proof: { type: 'code', ref: 'R-1' } });
assert.equal(returned.order_id, 'ORDER-RETURN');
assert.equal(returned.status, 'received');
assert.equal(returned.proof.type, 'code');
assert.throws(() => normalizeDeliveryProof({ type: 'gps', ref: 'x' }), /Unsupported proof type/);
assert.throws(() => normalizeLogisticsReturn({ order_id: 'X', status: 'unknown' }), /Unsupported return status/);
const contract = logisticsProofReturnContract();
assert.equal(contract.persistence, 'none');
assert.equal(contract.duplicate_inventory_authority, false);
assert.equal(contract.order_authority, 'commerce');
console.log('Phase 13.10.4 Logistics Proof / Return Regression: PASS');
