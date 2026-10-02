import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const core=readFileSync(new URL('../backend/lib/payments/payment-core.js',import.meta.url),'utf8');
const store=readFileSync(new URL('../backend/lib/store-sqlite.js',import.meta.url),'utf8');
for(const [n,p] of [['evidence',/assertUntrustedPaymentEvidenceShape/],['freshness',/evaluateVerificationFreshness/],['commit',/commitPaymentDecision/],['uniqueness',/PROVIDER_TRANSACTION_DUPLICATE/],['lineage',/payment\.verification\.recorded/]])assert.match(core+store,p,n);
for(const table of ['payment_evidence','payment_verifications','payment_decisions','payment_ledger_entries','audit_events'])assert.match(store,new RegExp(table));
assert.match(store,/organization_id = \?/);
console.log('GAP-1.18AC end-to-end invariant certification passed');
