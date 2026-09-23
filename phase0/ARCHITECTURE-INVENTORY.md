# Sellify Phase 6 — Architecture Inventory

## 1. System boundary

```text
                    SELLIFY PHASE 6
                         │
        ┌────────────────┴────────────────┐
        │                                 │
     Browser PWA                       Node Backend
        │                                 │
   IndexedDB/localStorage              SQLite
        │                                 │
        └────────────── Sync ─────────────┘
                         │
                    Marketplace
                         │
                 Seller-order operations
```

## 2. Module inventory

| Area | Current implementation | Phase 0 disposition |
|---|---|---|
| PWA shell | `app/` static ES modules | KEEP |
| Shared state | `app/src/state.js` | KEEP; canonicalize later |
| Browser persistence | IndexedDB + localStorage fallback | KEEP; harden |
| Sync | `app/src/sync/*` | KEEP; evolve toward outbox |
| Auth | `app/src/auth/*` + backend auth routes | KEEP; canonicalize |
| Tenant model | backend `tenants` | KEEP; bridge into Organization |
| Users/memberships | backend `users`, `memberships` | KEEP; evolve into canonical identity |
| Devices/sessions | backend `devices`, `sessions` | KEEP; connect to Device/Session identity |
| Products | `products/*` | KEEP |
| Orders | `orders/*` | KEEP |
| Marketplace | `marketplace/*` + backend routes | KEEP; formalize orchestration |
| Seller order operations | backend order persistence/checkout flow | KEEP; formalize SellerOrder |
| Inventory | `warehouse/inventory.js` + product stock | HARDEN; migrate toward ledger |
| Warehouse | `warehouse/*` | KEEP; deepen later |
| Logistics | `logistics/*` | KEEP; deepen later |
| Restaurant | `restaurant/*` | KEEP; vertical-pack boundary later |
| B2B | `b2b/*` | KEEP; deepen in Commerce Engine |
| Audit | backend `audit_events` | KEEP; normalize later |
| Payments | client payment methods/payment-proof | HARDEN; create Payment Core later |
| Documents | receipts currently exist | ADAPT into Document Engine later |
| Printing | receipt print/browser behavior | DEFER adapter extraction until core is stable |
| Platform adapters | `platform/*` | KEEP; expand later |

## 3. Architectural conclusion

The Phase 6 source is not a blank foundation. It already contains many of the concepts required by the Master Roadmap. The correct strategy is therefore incremental extraction and canonicalization, not a rewrite.

The first Phase 10 work should connect existing concepts:

```text
existing tenants
existing users
existing memberships
existing devices
existing sessions
        │
        ▼
Canonical Identity
        │
        ▼
Organization → Location → User → Membership → Channel Identity → Device/Session
```

Likewise:

```text
existing product.stock
existing stock transactions
        │
        ▼
Inventory Ledger
        │
        ▼
Derived available quantity + reservations
```

And:

```text
existing audit_events
        │
        ▼
Canonical AuditEvent
```

## 4. Important Phase 0 constraint

Do not introduce duplicate parallel systems merely because the roadmap uses new names. Each new canonical domain must have a compatibility bridge to the Phase 6 implementation.


## Phase 10.2 update
- Organization/location model is now exposed additively.
- Canonical location types: STORE, WAREHOUSE, COLLECTION_CENTER, DELIVERY_HUB, OFFICE, RESTAURANT.
- Existing default locations remain STORE.
- Location CRUD is tenant-session protected; no existing catalog/order/sync semantics are switched yet.
