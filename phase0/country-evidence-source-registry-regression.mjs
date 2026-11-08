import assert from 'node:assert/strict';
import {
  COUNTRY_EVIDENCE_SOURCE_STATES,
  createCountryEvidenceSourceRegistry,
  countryEvidenceSourceRegistryContract,
  defineCountryEvidenceSource,
} from '../app/src/country-evidence-source-registry.js';

const base = {
  sourceId: 'et-tax-guidance-001',
  title: 'Tax guidance reference',
  authority: 'Example revenue authority',
  jurisdiction: 'ET',
  scope: 'business invoicing guidance; scope requires legal review',
  sourceType: 'regulator_guidance',
  url: 'https://example.gov.et/tax/guidance',
  state: 'UNVERIFIED',
  accessedAt: '2026-11-08T10:00:00Z',
  provenance: { capturedByProcess: 'country-intelligence-research' },
};

const source = defineCountryEvidenceSource(base);
assert.equal(source.state, 'UNVERIFIED');
assert.equal(source.persistent, false);
assert.equal(source.legalDecision, false);
assert.ok(Object.isFrozen(source));
assert.ok(Object.isFrozen(source.provenance));

assert.throws(() => defineCountryEvidenceSource({ ...base, sourceId: 'ET Bad ID' }), /stable lowercase identifier/);
assert.throws(() => defineCountryEvidenceSource({ ...base, sourceType: 'guess' }), /unsupported sourceType/);
assert.throws(() => defineCountryEvidenceSource({ ...base, url: 'javascript:alert(1)' }), /HTTP or HTTPS/);
assert.throws(() => defineCountryEvidenceSource({ ...base, state: 'VERIFIED' }), /verifiedAt and verificationBasis/);
assert.throws(
  () => defineCountryEvidenceSource({
    ...base, state: 'VERIFIED', verifiedAt: '2026-11-08',
    verificationBasis: 'reviewed', effectiveFrom: '2026-11-10', effectiveUntil: '2026-11-01',
  }),
  /must not precede/,
);

const verified = defineCountryEvidenceSource({
  ...base,
  sourceId: 'ke-regulator-guidance-001',
  jurisdiction: 'KE',
  state: 'VERIFIED',
  verifiedAt: '2026-11-08T10:30:00Z',
  verificationBasis: 'Primary source text reviewed; legal applicability still requires jurisdictional review',
});
assert.equal(verified.state, 'VERIFIED');
assert.equal(verified.launchReadinessDecision, false);

const registry = createCountryEvidenceSourceRegistry([source, verified]);
assert.equal(registry.size(), 2);
assert.equal(registry.get('ET-TAX-GUIDANCE-001').sourceId, 'et-tax-guidance-001');
assert.equal(registry.list({ jurisdiction: 'et' }).length, 1);
assert.equal(registry.list({ state: 'VERIFIED' }).length, 1);
assert.throws(() => registry.register(base), error => error.code === 'COUNTRY_EVIDENCE_SOURCE_EXISTS');
assert.equal(registry.contract.persistence, 'none');
assert.equal(registry.contract.sourceClassificationProvesOfficialness, false);
assert.equal(registry.contract.ownsLegalInterpretation, false);
assert.deepEqual(COUNTRY_EVIDENCE_SOURCE_STATES, ['UNVERIFIED', 'VERIFIED', 'STALE', 'CONFLICTING', 'REJECTED']);
assert.equal(countryEvidenceSourceRegistryContract().ownsCommercialReadiness, false);

console.log('Country evidence source registry regression: PASS');
