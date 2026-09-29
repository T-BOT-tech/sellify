# GAP-1 — Payment Certification Checklist

Use this document before declaring GAP-1 complete.

## A. Authority

- [ ] Payment Core remains sole financial authority.
- [ ] Provider adapters cannot write payment ledger entries.
- [ ] Cheki cannot settle payments directly.
- [ ] Frontend cannot mark a payment financially successful.
- [ ] Ledger remains append-only.
- [ ] Organization isolation is enforced server-side.

## B. PaymentAccount

- [ ] Canonical PaymentAccount identity exists.
- [ ] Phone is not the primary identity.
- [ ] Multiple accounts per organization are supported.
- [ ] Telebirr account can coexist with CBE.
- [ ] M-Pesa account can coexist with CBE/Telebirr.
- [ ] BOA account can coexist with other providers.
- [ ] Inactive accounts cannot receive new authoritative payment assignments.
- [ ] Account ownership is organization-scoped.
- [ ] Secrets are not returned to frontend.

## C. Providers

- [ ] Telebirr provider contract is explicit.
- [ ] CBE provider contract is explicit.
- [ ] M-Pesa provider contract is explicit.
- [ ] BOA provider contract is explicit.
- [ ] Capabilities accurately describe implementation.
- [ ] Unsupported operations fail explicitly.
- [ ] Adding a provider does not require Payment Core rewrite.
- [ ] Provider adapters contain no persistence authority.

## D. Channels

- [ ] Manual is separate from provider.
- [ ] SMS is separate from provider.
- [ ] API is separate from provider.
- [ ] Future webhook can be added without provider-channel coupling.
- [ ] Channel input becomes evidence/command before financial processing.

## E. Evidence and verification

- [ ] Evidence is treated as untrusted.
- [ ] Evidence has stable identity/fingerprint where possible.
- [ ] VerificationResult is provider-neutral.
- [ ] Provider-specific payloads are not required by Payment Core.
- [ ] Verification identifies provider/account/reference/amount/currency where available.
- [ ] Failed verification cannot settle a payment.

## F. Invariants

- [ ] Organization matches.
- [ ] Provider matches.
- [ ] PaymentAccount matches.
- [ ] Amount matches or explicit partial policy applies.
- [ ] Currency matches.
- [ ] Reference uniqueness is enforced.
- [ ] Provider transaction uniqueness is enforced.
- [ ] Payment intent expiry is enforced.
- [ ] Authorization is enforced.
- [ ] Ledger transition is atomic.

## G. Idempotency

- [ ] API commands are idempotent.
- [ ] Same key + same request returns same result.
- [ ] Same key + conflicting request returns conflict.
- [ ] Duplicate evidence is safe.
- [ ] Duplicate provider transaction is safe.
- [ ] Worker retries are safe.
- [ ] Webhook replay is safe.
- [ ] Concurrent reconciliation is safe.

## H. Cheki

- [ ] Only required reusable Cheki components are extracted.
- [ ] Initial documented scope is CBE/Telebirr/BOA.
- [ ] Extra parser families are not silently introduced.
- [ ] Cheki UI/hosting is not imported into Sellify.
- [ ] Cheki does not own Sellify payment persistence.
- [ ] Cheki output becomes VerificationResult.

## I. Reconciliation worker

- [ ] Job contract is explicit.
- [ ] Retry/backoff is bounded.
- [ ] Provider timeout is handled.
- [ ] Rate limiting is respected.
- [ ] Duplicate job execution is safe.
- [ ] Permanent failure is observable.
- [ ] Correlation IDs exist.

## J. Frontend

- [ ] Dedicated payment module exists.
- [ ] No payment authority in localStorage.
- [ ] Payment-changing requests use idempotency.
- [ ] Backend status is displayed as source of truth.
- [ ] 400/401/403/404/409/422/5xx handling is explicit.
- [ ] Provider credentials never reach browser.
- [ ] PaymentAccount configuration uses canonical backend APIs.

## K. Security/adversarial

- [ ] Cross-tenant evidence rejected.
- [ ] Cross-tenant PaymentAccount rejected.
- [ ] Wrong receiving account rejected.
- [ ] Amount tampering rejected.
- [ ] Currency tampering rejected.
- [ ] Reference replay rejected/idempotently handled.
- [ ] Unauthorized role rejected.
- [ ] Courier/logistics or unrelated roles cannot bypass payment permissions.
- [ ] Provider webhook signature is verified where supported.
- [ ] Sensitive provider payloads are protected.

## L. Regression

- [ ] Existing baseline tests pass.
- [ ] Existing FUX regressions pass.
- [ ] GAP-2 logistics tests remain green.
- [ ] Compliance tests remain green.
- [ ] Marketplace/inventory tests remain green.
- [ ] Payment-specific regressions pass.
- [ ] Security checks pass.
- [ ] Release certification passes.

## M. Productization

- [ ] Organization is the stable payment-service identity.
- [ ] chatId is not treated as future public payment identity.
- [ ] Public API is not coupled directly to internal routes.
- [ ] Future external credentials have a documented boundary.
- [ ] API/provider/verification contracts are versionable.
- [ ] No second ledger is introduced.
- [ ] No second Payment Core is introduced.

## Final release gate

Do not mark GAP-1 complete if any financial-authority invariant is implemented only in frontend code.

Do not mark GAP-1 complete if provider adapters can bypass Payment Core.

Do not mark GAP-1 complete if duplicate evidence/provider transactions can create duplicate settlement.

Do not mark GAP-1 complete merely because a happy-path payment works.
