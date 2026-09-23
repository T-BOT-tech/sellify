# Phase 14.14 — Node >=24 Regression

Status: **BLOCKED — runtime unavailable**

The project requirement remains Node >=24. The current verification environment reports Node 22.16.0, so this phase cannot certify the supported runtime.

Checks performed:
- package engine remains `>=24`.
- no runtime requirement was lowered.
- Phase 14 country regression sources remain intact.
- A release certification requires an actual Node >=24 runtime and must be rerun there.

This is an environment gate, not a source-code failure.
