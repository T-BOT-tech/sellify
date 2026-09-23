# Phase 15.2 — Kenya Country Pack Identity / Locale

## Scope

Add the Kenya (`KE`) country pack identity and locale projection as the first additive country expansion after the Ethiopia baseline.

## Authority boundary

The Kenya pack is declarative and runtime-only. It does not own organization identity, customer identity, persistence, commerce, inventory, payments, authorization, audit, or events.

Canonical authorities remain the existing Core authorities. `organization.country`, `organization.currency`, and explicit organization timezone remain authoritative; `Africa/Nairobi` is only a fallback when timezone is absent.

## Kenya contract

- Country: `KE`
- Currency: `KES`
- Default locale: `en-KE`
- Supported language codes: `en`, `sw`
- Timezone fallback: `Africa/Nairobi`
- Payment mapping: `mpesa` is declared only as an existing provider-registry identifier with implementation `deferred`; Phase 15.2 does not execute payments.
- Tax, documents, phone/address, and compliance remain deferred country boundaries.

## Compatibility note

Phase 14 regressions that explicitly asserted Ethiopia was the only installed country pack are historical baseline gates. They are not rewritten to pretend the pre-expansion state still exists. Phase 15.2 introduces the new additive baseline and its own regression.

## Non-goals

No Kenyan tax engine, invoice authority, payment execution, payment credentials, customer store, country database, country authorization store, country event broker, or Core replacement is introduced.
