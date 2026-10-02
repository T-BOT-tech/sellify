import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');

assert.match(source, /GAP-1\.18N — verification provenance hardening/);
assert.match(source, /GAP-1\.18O/);
assert.match(source, /ALTER TABLE audit_events ADD COLUMN previous_hash/);
assert.match(source, /ALTER TABLE audit_events ADD COLUMN event_hash/);
assert.match(source, /crypto\.createHash\('sha256'\)/);
assert.match(source, /lineageType: 'payment_evidence'/);
assert.match(source, /lineageType: 'payment_verification'/);
assert.match(source, /lineageType: 'payment_decision'/);
assert.match(source, /payment\.evidence\.recorded/);
assert.match(source, /payment\.verification\.recorded/);
assert.match(source, /UNTRUSTED_PAYMENT_VERIFIER/);
assert.match(source, /UNTRUSTED_PAYMENT_DECISION_SOURCE/);
assert.doesNotMatch(source, /const verifier = String\(v\.verifier \|\| 'payment-core'\)/);
assert.doesNotMatch(source, /v\.verifier \|\| 'payment-core', v\.verifierVersion/);

console.log('GAP-1.18O immutable payment audit lineage regression passed');
