# P1-IMPLEMENTATION-01 — IAM Role Catalogue Productization

## Scope

This slice productizes FUX-2A as a read-only role catalogue and reconciliation surface inside Settings.

## Authority boundary

- `backend/lib/authorization.js` remains the canonical permission policy.
- Existing memberships/sessions remain the identity and role authority.
- No second IAM store, permission evaluator, or role authority was introduced.
- FUX Section 6 Pack role families are represented explicitly as **target product roles**, not silently promoted to server roles.

## Current canonical roles

The current central policy recognizes: owner, manager, cashier, staff, buyer, viewer.

## Target Pack role families

The surface preserves the FUX-2 Section 6 families for Core organization, Restaurant, Retail/POS, Warehouse, Logistics, Agriculture, Procurement, Supplier Network, and Marketplace.

Each target family remains subject to the required reconciliation chain:

`Role → Pack → Capability → Permission → Scope → Conditions → Approval → UI affordance → Server enforcement → Audit/event`

## UX behavior

Settings now includes a Roles & Access section showing:

1. current canonical security role;
2. canonical security role catalogue;
3. target Pack role families;
4. explicit explanation that UI visibility is not authorization;
5. explicit reconciliation status framing.

This slice intentionally does **not** add role assignment or invent server roles. Those require a subsequent canonical membership-management contract.

## Validation

- `node --check app/src/authorization/role-catalog.js` — PASS
- `node --check app/src/ui/settings.js` — PASS
- `node phase0/p1-01-iam-role-catalog-regression.mjs` — PASS
- `node phase0/fux29-seller-golden-journey-regression.mjs` — PASS
- `node phase0/fux30-multi-channel-adversarial-regression.mjs` — PASS

Node 24 production certification remains a separate release gate.
