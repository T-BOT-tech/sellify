// Phase 19.11 — AI Intent Translation Boundary regression.
import assert from 'node:assert/strict';
import {
  discoveryAiIntentTranslationContract,
  translateDiscoveryIntent,
  validateTranslatedDiscoveryIntent,
  discoverFromNaturalLanguage,
} from '../backend/lib/discovery/index.js';

const checks = [];
function pass(name) { checks.push(`PASS ${name}`); }

const contract = discoveryAiIntentTranslationContract();
assert.equal(contract.authority, 'discovery_ai_intent_boundary'); pass('AI boundary authority');
assert.equal(contract.input, 'natural_language'); pass('natural-language input');
assert.equal(contract.output, 'structured_discovery_intent'); pass('structured intent output');
assert.equal(contract.candidateGeneration, false); pass('AI cannot generate candidates');
assert.equal(contract.ranking, false); pass('AI cannot rank');
assert.equal(contract.trustScoring, false); pass('AI cannot trust-score');
assert.equal(contract.execution, false); pass('AI cannot execute');
assert.equal(contract.persistence, 'none'); pass('AI boundary has no persistence');
assert.equal(contract.directDatabaseAccess, false); pass('no direct database access');
assert.equal(contract.directCredentialsAccess, false); pass('no direct credentials access');
assert.equal(contract.flow, 'Natural Language → AI → Structured Intent → Deterministic Discovery'); pass('frozen flow');

const translated = await translateDiscoveryIntent({
  text: 'Find 5 tons of coffee in Ethiopia for wholesale',
  translator: async () => ({ intent: {
    object: 'coffee', countryCode: 'ET', quantity: 5, unit: 'ton',
    commercialMode: 'WHOLESALE', wholesale: true,
  } }),
});
assert.equal(translated.ai, true); pass('translation marked AI');
assert.equal(translated.deterministic, false); pass('translation itself not deterministic');
assert.equal(translated.execution, false); pass('translation execution disabled');
assert.equal(translated.persistence, false); pass('translation persistence disabled');
assert.equal(translated.intent.countryCode, 'ET'); pass('country normalized');
assert.equal(translated.intent.commercialMode, 'WHOLESALE'); pass('commercial mode normalized');

const direct = await translateDiscoveryIntent({
  text: 'buy coffee',
  translator: async () => ({ search: 'coffee', currency: 'ETB' }),
});
assert.equal(direct.intent.search, 'coffee'); pass('direct structured translator result supported');
assert.equal(direct.intent.currency, 'ETB'); pass('currency normalized');

for (const bad of [
  { candidates: [] },
  { matchScore: 99 },
  { trustScore: 100 },
  { actions: [] },
  { sql: 'SELECT 1' },
  { providerId: 'supplier-network' },
  { organizationId: 'org-1' },
]) {
  await assert.rejects(
    () => translateDiscoveryIntent({ text: 'find coffee', translator: async () => bad }),
    error => error?.code === 'DISCOVERY_AI_INTENT_INVALID',
  );
}
pass('forbidden AI output fields rejected');

assert.throws(
  () => validateTranslatedDiscoveryIntent({ unsupportedField: 'x' }),
  error => error?.code === 'DISCOVERY_AI_INTENT_INVALID',
); pass('unsupported intent fields rejected');

assert.throws(
  () => validateTranslatedDiscoveryIntent({ quantity: -1 }),
  error => error?.code === 'DISCOVERY_MARKET_CONTEXT_INVALID',
); pass('invalid market intent rejected by canonical context');

const discovered = await discoverFromNaturalLanguage({
  text: 'unlikely-phase19.11-no-match',
  translator: async text => ({ intent: { search: text, limit: 5 } }),
  providerIds: ['commerce.organization'],
});
assert.equal(discovered.ai, true); pass('composed discovery records AI translation stage');
assert.equal(discovered.deterministic, true); pass('post-translation discovery remains deterministic');
assert.equal(discovered.aiStage.translated, true); pass('AI stage explicitly visible');
assert.equal(discovered.aiStage.ranking, false); pass('AI stage cannot rank');
assert.equal(discovered.aiStage.execution, false); pass('AI stage cannot execute');
assert.equal(discovered.aiStage.persistence, false); pass('AI stage cannot persist');
assert.equal(discovered.persisted, false); pass('composed discovery remains non-persistent');

await assert.rejects(
  () => translateDiscoveryIntent({ text: 'find coffee' }),
  error => error?.code === 'DISCOVERY_AI_INTENT_INVALID',
); pass('missing translator adapter rejected');

console.log(checks.join('\n'));
console.log(`${checks.length} PASS / 0 FAIL`);
