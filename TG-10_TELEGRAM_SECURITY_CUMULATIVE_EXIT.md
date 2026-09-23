# TG-10 — Telegram Security, Adversarial Isolation & Cumulative Exit

Date: 2026-09-18

## Scope

TG-10 closes the Telegram seller-owned storefront implementation sequence with an adversarial/cumulative regression gate. The gate verifies that seller-owned Telegram channels remain distribution/experience boundaries over existing SELLIFY authorities.

## Security invariants

- Public storefront responses never expose credential references or seller administration metadata.
- Seller configuration remains tenant/org scoped.
- Raw Telegram bot tokens are not persisted in the storefront configuration table.
- `secret://` references remain the only persisted credential representation.
- Direct status escalation to `PUBLISHED` without the verification boundary is rejected.
- Unpublished/unknown storefronts fail closed.
- Buyer identity/session verification remains seller-bot scoped and stateless.
- Telegram does not become an order, inventory, payment, fulfillment, return, event, analytics, or identity authority.
- Malformed Telegram checkout input cannot become a privileged execution path.

## Regression result

`phase0/tg10-telegram-security-cumulative-regression.mjs`: PASS

Cumulative Telegram regressions:

- TG-1 PASS
- TG-2 PASS
- TG-4 PASS
- TG-5 PASS
- TG-6 PASS
- TG-7 PASS
- TG-8 PASS
- TG-10 PASS

Golden Regression: **21 PASS / 0 FAIL**.

## Runtime note

Verification was performed under Node v22.16.0. Node >=24 certification remains a pre-existing release blocker and is not silently marked complete by TG-10.

## Architecture exit

```text
Seller
  -> Telegram Storefront Configuration
  -> Secure Credential Reference
  -> Seller Bot / Telegram WebApp
  -> Verified Buyer Context
  -> Existing SELLIFY Canonical APIs
  -> Commerce / Payment / Inventory / Fulfillment / Logistics / Events / Audit
```

No duplicate authority was introduced by TG-10.
