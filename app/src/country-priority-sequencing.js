// Phase 15.6 — country priority and sequencing gate.
// Strategy-only, non-persistent. Scores are decision-support metadata, not
// regulatory or commercial truth and must be revalidated before activation.

export const COUNTRY_PRIORITY_CONTRACT_VERSION = '1.0';

export const COUNTRY_PRIORITY_WEIGHTS = Object.freeze({
  tam: 20,
  currencyReuse: 15,
  languageReuse: 10,
  regulatoryTaxAlignment: 25,
  regionalTradeIntegration: 15,
  paymentReuse: 10,
  implementationComplexity: 5
});

const EAC_PRIORITY = Object.freeze([
  { countryCode: 'TZ', country: 'Tanzania', scores: { tam: 18, currencyReuse: 12, languageReuse: 10, regulatoryTaxAlignment: 20, regionalTradeIntegration: 14, paymentReuse: 8, implementationComplexity: 4 }, rationale: 'Largest unimplemented EAC population in the current World Bank comparison and strong Kiswahili/EAC reuse; country-specific tax and payment validation remains required.' },
  { countryCode: 'UG', country: 'Uganda', scores: { tam: 16, currencyReuse: 12, languageReuse: 9, regulatoryTaxAlignment: 20, regionalTradeIntegration: 14, paymentReuse: 8, implementationComplexity: 4 }, rationale: 'Large adjacent market with English/Kiswahili reuse and direct EAC integration; existing regional architecture should reduce implementation scope.' },
  { countryCode: 'RW', country: 'Rwanda', scores: { tam: 7, currencyReuse: 12, languageReuse: 8, regulatoryTaxAlignment: 21, regionalTradeIntegration: 13, paymentReuse: 8, implementationComplexity: 5 }, rationale: 'Smaller TAM but strong regional-integration fit and comparatively contained implementation surface; validate local tax/payment details before activation.' },
  { countryCode: 'BI', country: 'Burundi', scores: { tam: 4, currencyReuse: 12, languageReuse: 5, regulatoryTaxAlignment: 16, regionalTradeIntegration: 11, paymentReuse: 5, implementationComplexity: 3 }, rationale: 'Regional fit is meaningful, but language and market-size factors reduce near-term priority.' },
  { countryCode: 'CD', country: 'Democratic Republic of the Congo', scores: { tam: 13, currencyReuse: 7, languageReuse: 3, regulatoryTaxAlignment: 13, regionalTradeIntegration: 11, paymentReuse: 5, implementationComplexity: 2 }, rationale: 'Large TAM and EAC position are attractive, but currency/language and implementation complexity require a dedicated country-overlay workstream.' },
  { countryCode: 'SO', country: 'Somalia', scores: { tam: 6, currencyReuse: 8, languageReuse: 3, regulatoryTaxAlignment: 10, regionalTradeIntegration: 9, paymentReuse: 5, implementationComplexity: 2 }, rationale: 'Newer EAC membership creates strategic potential, but the country overlay should be deferred until the regional contract and local regulatory/payment evidence are stronger.' },
  { countryCode: 'SS', country: 'South Sudan', scores: { tam: 4, currencyReuse: 9, languageReuse: 4, regulatoryTaxAlignment: 9, regionalTradeIntegration: 8, paymentReuse: 4, implementationComplexity: 2 }, rationale: 'Regional adjacency is useful, but near-term implementation complexity and smaller TAM make it a later candidate.' }
]);

const VALID_DIMENSIONS = Object.freeze(Object.keys(COUNTRY_PRIORITY_WEIGHTS));
const COUNTRY_CODE = /^[A-Z]{2}$/;

const totalScore = (scores) => VALID_DIMENSIONS.reduce((sum, key) => sum + Number(scores[key] || 0), 0);

export function listCountryPriorityCandidates() {
  return EAC_PRIORITY.map((candidate) => Object.freeze({
    ...candidate,
    totalScore: totalScore(candidate.scores)
  })).sort((a, b) => b.totalScore - a.totalScore);
}

export function getCountryPriority(countryCode) {
  const code = String(countryCode || '').trim().toUpperCase();
  const candidate = listCountryPriorityCandidates().find((item) => item.countryCode === code);
  if (!candidate) {
    throw Object.assign(new Error(`Unknown unimplemented EAC priority candidate: ${countryCode}`), { code: 'COUNTRY_PRIORITY_UNKNOWN' });
  }
  return candidate;
}

export function validateCountryPriority(candidate) {
  const errors = [];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return { valid: false, errors: ['candidate must be an object'] };
  if (!COUNTRY_CODE.test(candidate.countryCode || '')) errors.push('countryCode must be ISO-like alpha-2');
  if (!candidate.country || typeof candidate.country !== 'string') errors.push('country must be non-empty');
  if (!candidate.scores || typeof candidate.scores !== 'object' || Array.isArray(candidate.scores)) errors.push('scores must be an object');
  else for (const key of VALID_DIMENSIONS) {
    const value = Number(candidate.scores[key]);
    const max = COUNTRY_PRIORITY_WEIGHTS[key];
    if (!Number.isFinite(value) || value < 0 || value > max) errors.push(`score:${key}`);
  }
  if (!candidate.rationale || typeof candidate.rationale !== 'string') errors.push('rationale must be non-empty');
  return { valid: errors.length === 0, errors };
}

export function assertCountryPriority(candidate) {
  const result = validateCountryPriority(candidate);
  if (!result.valid) {
    const error = new Error(`Invalid country priority: ${result.errors.join(', ')}`);
    error.code = 'COUNTRY_PRIORITY_INVALID';
    error.errors = result.errors;
    throw error;
  }
  return candidate;
}

export function countryPrioritySequencingContract() {
  return Object.freeze({
    version: COUNTRY_PRIORITY_CONTRACT_VERSION,
    regionCode: 'EAC',
    scope: 'unimplemented_country_selection',
    weights: { ...COUNTRY_PRIORITY_WEIGHTS },
    persistence: 'none',
    activation: 'manual_gate_required',
    authority: 'strategy_only',
    regulatoryClaim: 'none',
    paymentClaim: 'none',
    taxClaim: 'none'
  });
}
