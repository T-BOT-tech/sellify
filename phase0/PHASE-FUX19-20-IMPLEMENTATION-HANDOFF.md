# PHASE FUX-19 + FUX-20 IMPLEMENTATION HANDOFF

## CURRENT PHASE
FUX-19 UX Experimentation + FUX-20 Product Analytics

## OBJECTIVE
Add the experience-layer experimentation guardrail contract and product analytics taxonomy without creating a new authorization, transaction, event, audit, telemetry, analytics, assignment, or rollout authority.

## SOURCE INSPECTION
Inspected the actual continuation source, including:
- `app/src/authorization/pack-analytics.js`
- `app/src/authorization/pack-experimentation.js`
- `app/src/experience/notifications-observability-contract.js`
- existing FUX regressions and package scripts

The existing Pack analytics surface is read-only over the canonical audit stream. The existing Pack experimentation surface explicitly fails closed because the source does not establish a canonical experimentation service, assignment store, variant evaluator, or rollout authority.

## CURRENT STATE
FUX-19/FUX-20 had useful Pack-level read-only UX surfaces, but no shared experience contract for experimentation guardrails or the required analytics taxonomy.

## SOURCE OF TRUTH
FUX constitution and the current SELLIFY source remain authoritative. FUX-19 requires experience experiments with business-rule/security guardrails. FUX-20 requires activation, Pack adoption, funnels, completion, efficiency and reliability metrics. Analytics must map to existing request/correlation/event/audit infrastructure and must not become hidden authorization or transaction authority.

## PROPOSED CHANGE
Added `app/src/experience/experimentation-analytics-contract.js` containing:
- experimentation guardrail states and checks;
- fail-closed production mutation boundary;
- canonical assignment/rollout authority declaration;
- product analytics taxonomy;
- canonical evidence metric projection;
- request/correlation, operation, capability, actor, organization, scope, status, latency and error-category identifiers;
- duplicate-authority assertions.

Added a focused regression and npm script.

## FILES TO CHANGE
- `app/src/experience/experimentation-analytics-contract.js`
- `phase0/fux19-20-experimentation-analytics-regression.mjs`
- `phase0/PHASE-FUX19-20-IMPLEMENTATION-HANDOFF.md`
- `package.json`

## MIGRATION
None. This is additive and read-only. Existing Pack analytics/experimentation surfaces remain intact.

## TEST PLAN
Focused FUX-19/FUX-20 regression plus relevant existing FUX-17/FUX-18 and Golden Regression where the available runtime supports them.

## RISKS
The current source still does not establish a canonical experimentation assignment/rollout service. Therefore the contract intentionally cannot activate or mutate production experiments.

## IMPLEMENTATION RESULT
Implemented the bounded FUX-19/FUX-20 experience contract. No existing business authority was replaced or rewritten.

## VERIFICATION
The focused FUX-19/FUX-20 regression must pass before this slice is considered locally complete. Node >=24 release certification remains a separate gate.

## NOT CHANGED
No Commerce, Payment, Inventory, Fulfillment, Logistics, Procurement, Supplier Network, Event, Audit, transaction, authorization, telemetry backend, analytics store, experiment assignment store, rollout service, or AI execution authority was introduced.

## NEXT STEP
Proceed to FUX-21 + FUX-22 + FUX-23 only after retaining this boundary: QA must verify authority traceability; security UX must fail closed; recovery UX must distinguish retry/resume/rollback/conflict/provider failure states.
