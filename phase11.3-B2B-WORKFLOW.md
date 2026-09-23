# Phase 11.3 — B2B Workflow: Custom Pricing

This increment canonicalizes the first B2B workflow step: customer-specific custom pricing.

## Contract

`Customer (business) + Product -> explicit Money price + currency + status`

The existing local B2B accounts, pricing tiers, volume discounts, and order checkout remain unchanged. The new contract is additive and is not yet the checkout source of truth.

## API

- `GET /tenants/:chatId/b2b/pricing`
- `GET /tenants/:chatId/b2b/pricing/:pricingId`
- `POST /tenants/:chatId/b2b/pricing`
- `PATCH /tenants/:chatId/b2b/pricing/:pricingId`

## Authorization

- `b2b:pricing:view`
- `b2b:pricing:manage`

## Rules

- Pricing rules require a canonical `business` customer.
- Product must belong to the tenant organization.
- Price is an integer minor-unit amount.
- Currency must match the product currency.
- Updates are upserts on `(organization, customer, product)`.
- Changes are audit-recorded.
- Existing B2B behavior is preserved as a compatibility layer.

## Phase 11.3 — PO Approval (implemented)

The next canonical B2B document is an additive Purchase Order contract.
An accepted Quote can be snapshotted into one Purchase Order; the existing
Order system is not rewritten or automatically mutated by PO creation or approval.

### PO state machine

```text
DRAFT
  ↓
SUBMITTED
 ├── APPROVED
 ├── REJECTED
 └── CANCELLED

DRAFT → CANCELLED
```

Approved/rejected/cancelled POs are terminal in this increment. PO line items
become immutable once the PO leaves DRAFT.

### Canonical API

```text
GET   /tenants/:chatId/b2b/purchase-orders
POST  /tenants/:chatId/b2b/purchase-orders
GET   /tenants/:chatId/b2b/purchase-orders/:poId
PATCH /tenants/:chatId/b2b/purchase-orders/:poId
```

### Authorization

```text
b2b:po:view
b2b:po:create
b2b:po:approve
```

Buyer can create/submit POs but cannot approve them. Manager/owner can approve.
This preserves the central authorization layer rather than embedding role checks
in the PO service.

### Compatibility rule

```text
Accepted Quote
      ↓ snapshot
Purchase Order
      ↓ approval
Approved Purchase Order
      ↓ later phase
Existing Order
```

The final PO-to-Order bridge is intentionally deferred so approval does not
change existing order semantics before the later B2B workflow stages are ready.

## Phase 11.3 — Invoice

Migration 19 adds the canonical B2B `invoices` and `invoice_items` document contracts. Invoices are snapshots over an existing Accounts Receivable record and do not create a second receivable or payment ledger. State flow is `DRAFT → ISSUED → VOID` or `DRAFT → CANCELLED`. Existing retail receipt generation remains unchanged.
