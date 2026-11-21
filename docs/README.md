# Sellify documentation index

**Index snapshot:** 2026-11-21  
**Repository:** `T-BOT-tech/sellify`  
**Rule:** current source and verified runtime evidence outrank historical plans, handoffs, and phase snapshots.

This index separates current operating references from historical evidence. It does not declare every document current merely because it remains in the repository.

## Current operating references

| Document | Purpose | Use |
|---|---|---|
| [Implementation Register](SELLIFY_IMPLEMENTATION_REGISTER.md) | Current integration status, branch policy, evidence rules, and retained branch inventory | **Primary operational register.** Refresh against live GitHub before acting. |
| [Service Capability Composition Map and Gap Register](SELLIFY_SERVICE_CAPABILITY_COMPOSITION_MAP_AND_GAP_REGISTER_2026-11-19.md) | Service capability ownership, composition boundaries, and evidence-quality follow-up | Focused service/capacity audit snapshot; its source baseline predates PR #282 and #291. Re-audit before treating it as a current-main certification. |
| [SC-03 Resource and Appointment Source Audit](SC03_SERVICE_RESOURCE_AND_APPOINTMENT_FEASIBILITY_SOURCE_AUDIT_2026-11-19.md) | Detailed service resource, availability, booking, authorization, and regression evidence | Historical focused audit, updated for the November 21 authorization-boundary correction; not a whole-repository audit or production certification. |
| [Payment Authority Map](../PAYMENT_AUTHORITY_MAP.md) | Payment ownership and authority boundaries | Reference for payment-domain changes; verify against current payment source and GAP-1 records. |
| [GAP-1 Payment Implementation](GAP-1-PAYMENT-IMPLEMENTATION.md) | Payment implementation/productization work | Workstream reference; refresh status and source links before execution. |
| [GAP-1 Payment Contracts](GAP-1-PAYMENT-CONTRACTS.md) | Payment contracts | Contract reference; reconcile with Payment Core source before changing behavior. |
| [GAP-2 Logistics Source of Truth](../SELLIFY_GAP_2_LOGISTICS_SOURCE_OF_TRUTH.md) | Frozen Logistics authority and boundary | Preserve as the Logistics boundary reference; verify current source before implementation. |
| [Deployment Certification](DEPLOYMENT-CERTIFICATION.md) | Deployment and release acceptance | Operational gate reference; do not equate CI success with production readiness. |
| [UI Evaluation Environment](SELLIFY_UI_EVALUATION_ENVIRONMENT.md) | Private UI evaluation environment | Prepared-environment instructions; manual runtime and visual sign-off remain distinct evidence. |

## Product and engineering entry points

- [Repository README](../README.md) — project overview, runtime requirements, local development, and deployment.
- [Frontend README](../app/README.md) — app module map and frontend development guidance.
- [Phase 0 README](../phase0/README.md) — regression suite entry point and baseline notes.
- [Contributing](../CONTRIBUTING.md) — contribution guidance.
- [Security](../SECURITY.md) — security reporting guidance.

## Payment architecture and gap records

The following payment documents preserve useful architecture, contracts, and prior audit reasoning, but their dates/statuses predate the current payment frontend implementation. They are **design/history references, not current gap trackers**:

- `../PAYMENT_AUTHORITY_MAP.md` — September 28 authority inspection snapshot.
- `../AI_HANDOFF_GAP-1-PAYMENT.md` — historical implementation handoff; its claim that no dedicated frontend payment module exists is superseded.
- `../SELLIFY_FRONTEND_BACKEND_GAP_AI_HANDOFF.md` — October 2 handoff; its PF-1 task list is superseded.
- `../SELLIFY_FRONTEND_BACKEND_GAP_ANALYSIS_LATEST.md` — October 12 gap snapshot; “Latest” is historical.
- `../SELLIFY_FRONTEND_BACKEND_GAP_CERTIFICATION_MATRIX.md` and `../SELLIFY_FRONTEND_BACKEND_GAP_IMPLEMENTATION_ROADMAP.md` — October 2 matrix/roadmap; their statuses require re-audit.
- `GAP-1-PAYMENT-CONTRACTS.md`, `GAP-1-PAYMENT-IMPLEMENTATION.md`, `GAP-1-PAYMENT-PRODUCTIZATION-ARCHITECTURE.md`, and `GAP-1-PAYMENT-CERTIFICATION-CHECKLIST.md` — design contracts, architecture, and acceptance criteria. Reconcile with live Payment Core source before implementing or claiming completion.

**Current source evidence:** `app/src/payments/client.js`, `contract.js`, `projection.js`, `state.js`, and `ui.js` exist on main. PF-1/PF-2 regression scripts are registered in the root package manifest. Their presence establishes implementation artifacts, not by itself a production-readiness or full certification claim.

## Historical and phase evidence

The repository root and `phase0/` contain a large collection of phase handoffs, implementation records, source snapshots, hash manifests, and certification evidence. These documents should be treated as **historical evidence unless explicitly promoted into the current operating references above**.

Examples that must not be mistaken for current architecture or current source instructions:

- [Phase 6 Architecture Inventory](../phase0/ARCHITECTURE-INVENTORY.md) — a historical Phase 6 snapshot, not the current architecture map.
- [Consolidated P1 Manifest](../SELLIFY-CONSOLIDATED-P1-MANIFEST.md) — a September 19 source/evidence snapshot, not the live source of truth.
- [AI Handoff](../SELLIFY_AI_HANDOFF.md) — contains legacy source-ZIP and project-direction instructions; do not follow those historical instructions over current `main`, the current product constitution, and the implementation register.
- Dated phase handoffs and cumulative exit records — preserve as audit trail; check their recorded commit, runtime, and scope before relying on a status claim.

## Reconciliation policy

1. Current source code on `main` is the implementation baseline.
2. The approved FUX/Product Experience Constitution and domain-specific authority contracts govern product and architecture decisions. Do not infer that a handoff supersedes them.
3. The Implementation Register records the current integration and branch-control picture, but must be refreshed when main, PRs, or branch inventory changes.
4. Audit documents are snapshots. Their source SHA, test SHA, runtime, and explicit limitations travel with their conclusions.
5. Historical evidence is preserved unless it is proven redundant, unreferenced, and unnecessary for audit or reproducibility.
6. Do not move or delete phase documents until relative links, test references, workflow references, hashes, and external handoff dependencies have been checked.

## Current cleanup status

- Documentation inventory: classified at a high level; detailed duplicate/reference analysis remains in progress.
- Implementation Register: reconciled to the November 21 branch/PR state and PR #291 integration.
- File moves/deletions: none performed as part of this documentation reconciliation.
- Next step: audit stale root-level handoffs and phase records against current source, then propose only evidence-safe archive or consolidation actions.
