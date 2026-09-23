# PHASE 18.7 — QUALIFICATION & VERIFICATION CONTRACT

## Frozen rules
1. Organization is the only canonical supplier identity.
2. Supplier Network stores qualification claims and evidence metadata.
3. Country/Domain Packs define required qualification categories and local rules.
4. DECLARED is a supplier claim.
5. DOCUMENTED means evidence metadata has been supplied; it is not automatically verified.
6. VERIFIED requires an explicit authorized verification action.
7. Verification records retain verifier identity and verification timestamp.
8. Validity dates are descriptive evidence boundaries; expired qualifications cannot remain represented as current VERIFIED truth.
9. REVOKED represents an invalidated qualification record and must not be treated as valid.
10. Historical qualification evidence is auditable and versioned.
11. Visibility is enforced through central authorization, not UI-only filtering.
12. Supplier Network does not create legal/regulatory truth merely by storing a qualification.
13. External registries, when added later, connect through adapters and explicit evidence provenance.
14. Procurement may consume qualification signals for deterministic eligibility in a future integration, but Procurement remains the authority for procurement decisions.
15. AI may summarize or recommend using qualification evidence later, but AI cannot independently create VERIFIED status.
