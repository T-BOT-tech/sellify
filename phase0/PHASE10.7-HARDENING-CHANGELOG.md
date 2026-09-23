# Phase 10.7 Compliance / Audit Hardening — Incremental Changelog

## Scope

This increment hardens the already-implemented Phase 10.7 compliance boundary. It does not rewrite the system or replace existing audit, authorization, sync, or outbox behavior.

## Changes

1. Compliance request subjects are validated against the current organization.
2. Customer requests require a real customer belonging to the organization.
3. Organization requests cannot target another organization.
4. Compliance request state transitions are explicit and terminal states are immutable.
5. Organization exports include bounded audit history, retention policy, and compliance-request history.
6. Customer exports include bounded customer audit history.
7. Golden regression coverage was updated for the controlled lifecycle.

## Compatibility

- Existing `audit_events` table retained.
- Audit rows remain database-enforced append-only.
- Existing central authorization retained.
- Existing Phase 10.7 outbox/event channel retained.
- Existing order/catalog sync retained.
- SQLite migration chain remains forward-only; no historical migration changed.

## Validation

- Phase 0 Golden Regression: 20 PASS / 0 FAIL
- Phase 10.7 Compliance/Audit Regression: PASS
- Phase 10.7 Outbox/Event Regression: PASS
- Phase 10.6 Multi-Location Regression: PASS
- Phase 10.5 Inventory Ledger Regression: PASS
- Phase 10.3 Authorization Regression: PASS
- JavaScript syntax checks: PASS

## Runtime note

The inspection environment reports Node 22.16.0. Sellify continues to declare Node >=24; the runtime requirement was not changed.


## Phase 11.1 — Money Contract continuation

The next foundation-to-commerce increment was implemented additively from this hardened source.

- Added migration `12` with explicit `currency` columns on `catalog_products` and `orders`.
- Preserved integer `price_minor` / `total_minor` semantics.
- Legacy monetary rows inherit the canonical organization/tenant currency.
- Catalog records now carry explicit currency.
- Synced orders derive and persist the organization currency; mismatched currencies are rejected.
- Marketplace seller orders carry explicit currency and mixed-currency checkout is rejected rather than silently converted.
- Organization currency changes are blocked after monetary records exist (`CURRENCY_LOCKED`) to prevent historical monetary ambiguity.
- Fixed a duplicate audit actor filter in `listAuditEvents`.
- Added `phase11.1-money-regression.mjs`.

Validation:

- Phase 11.1 Money Contract Regression: PASS
- Phase 0 Golden Regression: PASS
- Phase 10.3 Authorization Regression: PASS
- Phase 10.5 Inventory Ledger Regression: PASS
- Phase 10.6 Multi-Location Regression: PASS
- Phase 10.7 Outbox/Event Regression: PASS
- Phase 10.7 Compliance/Audit Regression: PASS
- JavaScript syntax checks: PASS


## Phase 11.2 — Payment Core continuation

Implemented additively from the Phase 11.1 Money Contract source.

- Added migration `13` with canonical `payment_accounts`, `payments`, `payment_ledger_entries`, and `payment_reconciliations` tables.
- Preserved existing order payment fields (`payment_method_*`, `cash_tendered`, `change_due`, `payment_proof`) as compatibility behavior.
- Added a compatibility payment projection for newly synchronized legacy orders; the legacy order record remains unchanged.
- Added explicit payment states: `UNPAID`, `CLAIMED`, `RECEIVED`, `VERIFIED`, `RECONCILED` plus the roadmap failure states.
- Added guarded payment state transitions and append-only payment ledger history.
- Added organization-scoped payment accounts and manual/SMS/API channel metadata. Provider execution adapters are intentionally deferred; this increment establishes the stable core contract first.
- Added payment reconciliation records with amount/currency matching and state advancement only from `VERIFIED`.
- Added authenticated payment APIs with central authorization.
- Added Phase 11.2 regression coverage.

Compatibility rule: no existing checkout/payment-proof UI was rewritten, and no provider integration was invented ahead of the provider contract.

- Phase 11.3: added canonical customer-specific B2B custom pricing as migration 14, with API authorization and regression coverage.

- Phase 11.3 Quotes: added canonical B2B quote/quote-item contracts as migration 15, quote state transitions, authorization, audit events, and regression coverage. Existing order/B2B checkout behavior remains unchanged.

- Phase 11.3 PO Approval: added canonical `purchase_orders` / `purchase_order_items` as migration 16, accepted-quote snapshotting, PO approval state machine, central authorization, immutable submitted PO items, audit events, and regression coverage. Existing Order behavior remains unchanged.
- Phase 11.3 Credit Terms: added canonical `customer_credit_terms` as migration 17, Business Customer enforcement, currency-scoped credit limits, bounded payment-due days, approval/suspension state transitions, centralized authorization, audit events, B2B UI controls, and regression coverage. Existing Order, Payment, Quote, and Purchase Order behavior remains unchanged.


## Phase 11.3 — Accounts Receivable

- Added migration 18 for canonical B2B receivables, append-only AR ledger entries, and payment allocations.
- Added credit-limit and approved-credit-terms enforcement.
- Added verified/reconciled payment allocation with over-allocation protection.
- Added centralized AR permissions, API routes, UI section, and regression coverage.
- Invoice generation remains deferred to the next B2B increment.
