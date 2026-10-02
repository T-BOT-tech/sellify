import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');

assert.match(source, /GAP-1\.18O add tamper-evident audit chain|if \(!applied\.includes\(57\)\)/);
assert.match(source, /ALTER TABLE audit_events ADD COLUMN previous_hash/);
assert.match(source, /ALTER TABLE audit_events ADD COLUMN event_hash/);
assert.match(source, /ALTER TABLE audit_events ADD COLUMN lineage_type/);
assert.match(source, /ALTER TABLE audit_events ADD COLUMN lineage_id/);
assert.match(source, /crypto\.createHash\('sha256'\)/);
assert.match(source, /SELECT event_hash FROM audit_events WHERE organization_id = \? AND event_hash IS NOT NULL/);
assert.match(source, /previousHash/);
assert.match(source, /eventHash/);
assert.match(source, /lineageType: 'payment_evidence'/);
assert.match(source, /lineageType: 'payment_verification'/);
assert.match(source, /lineageType: 'payment_decision'/);
assert.match(source, /payment\.evidence\.recorded/);
assert.match(source, /payment\.verification\.recorded/);
assert.match(source, /evidenceId: input\.verification/);
assert.match(source, /verificationId: decisionVerificationId/);
assert.match(source, /provenanceSource: persistedVerification\.provenanceSource/);
assert.match(source, /provenanceOperation: persistedVerification\.provenanceOperation/);
assert.doesNotMatch(source, /const verifier = String\(v\.verifier \|\| 'payment-core'\)/);
assert.match(source, /decisionId/);

console.log('GAP-1.18O audit lineage regression passed');
