// Phase 20.11 — Cross-Border AI Intent Boundary regression.
import assert from 'node:assert/strict';
import { crossBorderAiIntentContract, translateCrossBorderIntent } from '../app/src/cross-border-ai-intent.js';

const checks = [];
function pass(name) { checks.push(`PASS ${name}`); }
const c = crossBorderAiIntentContract();
assert.equal(c.authority, 'cross_border_ai_intent_boundary'); pass('boundary authority');
assert.equal(c.discoveryTranslation, 'existing_phase19_ai_boundary'); pass('reuses Phase 19 AI boundary');
assert.equal(c.feasibilityDecision, false); pass('AI cannot decide feasibility');
assert.equal(c.complianceDecision, false); pass('AI cannot decide compliance');
assert.equal(c.authorization, false); pass('AI cannot authorize');
assert.equal(c.execution, false); pass('AI cannot execute');
assert.equal(c.persistence, 'none'); pass('no persistence');
assert.equal(c.directDatabaseAccess, false); pass('no database access');
assert.equal(c.directCredentialsAccess, false); pass('no credentials access');
assert.equal(c.flow, 'Natural Language → AI → Structured Cross-Border Intent → Deterministic Phase 20 Evaluation'); pass('frozen flow');

const translated = await translateCrossBorderIntent({
  text: 'Find 10 tons of coffee from Ethiopia to Kenya for wholesale',
  translator: async () => ({ intent: {
    originCountryCode: 'et', destinationCountryCode: 'ke', object: 'coffee', quantity: 10,
    unit: 'ton', commercialMode: 'WHOLESALE', currency: 'ETB',
  } }),
});
assert.equal(translated.ai, true); pass('translation marked AI');
assert.equal(translated.originCountryCode, 'ET'); pass('origin normalized');
assert.equal(translated.destinationCountryCode, 'KE'); pass('destination normalized');
assert.equal(translated.intent.quantity, 10); pass('quantity preserved');
assert.equal(translated.intent.commercialMode, 'WHOLESALE'); pass('commercial mode preserved');
assert.equal(translated.discoveryIntent.countryCode, 'KE'); pass('discovery projection uses destination');
assert.equal(translated.feasibility, 'none'); pass('AI does not decide feasibility');
assert.equal(translated.authorization, false); pass('AI cannot authorize result');
assert.equal(translated.execution, false); pass('AI cannot execute result');
assert.equal(translated.persistence, false); pass('translation is non-persistent');
assert.equal(translated.nextStage, 'deterministic_cross_border_evaluation'); pass('deterministic evaluation is next stage');

for (const bad of [
  { candidates: [] }, { feasibility: 'FEASIBLE' }, { complianceDecision: true },
  { actions: [] }, { paymentAuthorization: true }, { createOrder: true }, { credentials: 'x' },
  { database: 'x' }, { providerId: 'fx-provider' },
]) {
  await assert.rejects(
    () => translateCrossBorderIntent({ text: 'trade coffee', translator: async () => ({ intent: { originCountryCode: 'ET', destinationCountryCode: 'KE', ...bad } }) }),
    error => error?.code === 'CROSS_BORDER_AI_INTENT_INVALID',
  );
}
pass('forbidden AI output fields rejected');

await assert.rejects(
  () => translateCrossBorderIntent({ text: 'trade coffee', translator: async () => ({ intent: { originCountryCode: 'ET', object: 'coffee' } }) }),
  error => error?.code === 'CROSS_BORDER_AI_INTENT_INVALID',
); pass('missing destination rejected');

await assert.rejects(
  () => translateCrossBorderIntent({ text: 'trade coffee', translator: async () => ({ intent: { originCountryCode: 'ET', destinationCountryCode: 'ET' } }) }),
  error => error?.code === 'CROSS_BORDER_AI_INTENT_INVALID',
); pass('same-country intent rejected');

await assert.rejects(
  () => translateCrossBorderIntent({ text: 'trade coffee' }),
  error => error?.code === 'CROSS_BORDER_AI_INTENT_INVALID',
); pass('missing translator rejected');

console.log(checks.join('\n'));
console.log(`${checks.length} PASS / 0 FAIL`);
