import assert from 'node:assert/strict';
import {
  normalizeLogisticsTrackingEvidence,
  projectLogisticsTrackingEvidence,
  isLogisticsTrackingEvidence,
  logisticsTrackingEvidenceContract,
} from '../app/src/verticals/logistics/tracking-evidence-contract.js';

const normalized = normalizeLogisticsTrackingEvidence({
  shipment_id: 'SHIP-20-1',
  tracking_reference: 'TRK-20-1',
  kind: 'LOCATION',
  status: 'IN_PROGRESS',
  occurred_at: '2026-10-02T10:00:00Z',
  source: 'carrier',
  source_reference: 'carrier-event-1',
  location: { latitude: 9.03, longitude: 38.74 },
});
assert.equal(normalized.kind, 'location');
assert.equal(normalized.status, 'in_progress');
assert.equal(normalized.source, 'carrier');
assert.equal(normalized.external_authority, undefined);
assert.equal(normalized.persistence, 'none');
assert.equal(normalized.tracking_ledger, false);
assert.equal(normalized.gps_authority, false);

const projected = projectLogisticsTrackingEvidence({
  shipment: {
    shipment_id: 'SHIP-20-1',
    tracking_reference: 'TRK-20-1',
    authority: 'commerce_order',
  },
  event: {
    kind: 'status',
    status: 'out_for_delivery',
    occurred_at: '2026-10-02T10:01:00Z',
    source: 'provider',
    source_reference: 'provider-event-2',
  },
});
assert.equal(projected.canonical_authority, 'commerce_order');
assert.equal(projected.external_authority, 'provider');
assert.equal(projected.execution_boundary, 'existing_domain_transaction_and_outbox');
assert.equal(isLogisticsTrackingEvidence(projected), true);

const proof = normalizeLogisticsTrackingEvidence({
  tracking_reference: 'TRK-20-1',
  kind: 'proof',
  occurred_at: '2026-10-02T11:00:00Z',
  source: 'sellify',
  source_reference: 'proof-photo-1',
  evidence: { type: 'photo', ref: 'proof-photo-1' },
});
assert.equal(proof.kind, 'proof');
assert.equal(proof.evidence.ref, 'proof-photo-1');

assert.throws(() => normalizeLogisticsTrackingEvidence({
  kind: 'status',
  status: 'delivered',
  occurred_at: '2026-10-02T10:00:00Z',
  source: 'provider',
  source_reference: 'event-1',
}), /requires shipment_id or tracking_reference/);

assert.throws(() => normalizeLogisticsTrackingEvidence({
  shipment_id: 'SHIP-20-1',
  kind: 'location',
  occurred_at: '2026-10-02T10:00:00Z',
  source: 'provider',
  source_reference: 'event-2',
}), /requires location data/);

assert.throws(() => normalizeLogisticsTrackingEvidence({
  shipment_id: 'SHIP-20-1',
  kind: 'status',
  status: 'success',
  occurred_at: '2026-10-02T10:00:00Z',
  source: 'provider',
  source_reference: 'event-3',
}), /Unsupported tracking status/);

const contract = logisticsTrackingEvidenceContract();
assert.equal(contract.persistence, 'none');
assert.equal(contract.tracking_ledger, false);
assert.equal(contract.gps_authority, false);
assert.equal(contract.evidence_store, false);
assert.equal(contract.unknown_state_policy, 'do_not_infer_success_from_missing_evidence');

console.log('Phase 13.10.20 Logistics Tracking / Evidence Projection Regression: PASS');
