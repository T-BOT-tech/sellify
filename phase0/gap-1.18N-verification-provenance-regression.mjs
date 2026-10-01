import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');

assert.match(source, /GAP-1\.18N — verification provenance hardening/);
assert.match(source, /ALTER TABLE payment_verifications ADD COLUMN provenance_source/);
assert.match(source, /ALTER TABLE payment_verifications ADD COLUMN provenance_operation/);
assert.match(source, /const verifier = String\(input\.verifier \|\| ''\)\.trim\(\)/);
assert.match(source, /code: 'UNTRUSTED_PAYMENT_VERIFIER'/);
assert.match(source, /code: 'INVALID_VERIFIER_VERSION'/);
assert.match(source, /const provenanceSource = 'PAYMENT_CORE'/);
assert.match(source, /provenanceOperation/);
assert.match(source, /provenance_source, provenance_operation/);
assert.match(source, /code: 'UNTRUSTED_PAYMENT_DECISION_SOURCE'/);
assert.match(source, /decisionSource, actor\?\.userId \|\| null, now/);

console.log('GAP-1.18N verification provenance regression passed');
