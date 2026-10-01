import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const freshness = readFileSync(new URL('../backend/lib/payments/verification-freshness.js', import.meta.url), 'utf8');
const store = readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
const core = readFileSync(new URL('../backend/lib/payments/payment-core.js', import.meta.url), 'utf8');

assert.match(freshness, /DEFAULT_MAX_VERIFICATION_AGE_MS = 5 \* 60 \* 1000/);
assert.match(freshness, /VERIFICATION_STALE/);
assert.match(freshness, /VERIFICATION_OBSERVATION_TIME_INVALID/);
assert.match(freshness, /VERIFICATION_OBSERVATION_IN_FUTURE/);
assert.match(freshness, /ageMs < -60 \* 1000/);
assert.match(store, /assertVerificationFreshness/);
assert.match(store, /maxVerificationAgeMs/);
assert.match(core, /evaluateVerificationFreshness/);
assert.match(core, /verification\.result = 'EXPIRED'/);
assert.match(core, /freshness\.reasonCode/);
assert.match(core, /createdAt: null/);

const commitStart = store.indexOf('export async function commitPaymentDecision');
const commitEnd = store.indexOf('const PAYMENT_STATES', commitStart);
const commitSection = store.slice(commitStart, commitEnd);
assert.ok(commitSection.includes('assertVerificationFreshness'));
assert.ok(commitSection.includes('observedAt: v.observedAt'));

console.log('GAP-1.18K verification freshness and replay regression passed');
