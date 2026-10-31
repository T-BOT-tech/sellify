import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getPackActivationExperienceModel } from '../app/src/experience/pack-activation-contract.js';

const source = fs.readFileSync(new URL('../app/src/experience/pack-activation-contract.js', import.meta.url), 'utf8');
assert.match(source, /FUX13_PACK_ACTIVATION_CONTRACT_VERSION/);
assert.match(source, /NOT_INSTALLED/);
assert.match(source, /INSTALLED/);
assert.match(source, /ELIGIBLE/);
assert.match(source, /DEPENDENCY_BLOCKED/);
assert.match(source, /ACTIVE/);
assert.match(source, /DEACTIVATED/);
assert.match(source, /UPGRADE_AVAILABLE/);
assert.match(source, /RECOVERY_REQUIRED/);
assert.match(source, /UNKNOWN/);
assert.match(source, /INSTALL/);
assert.match(source, /ACTIVATE/);
assert.match(source, /DEACTIVATE/);
assert.match(source, /UPGRADE/);
assert.match(source, /backend\/lib\/authorization\.js/);
assert.match(source, /app\/src\/state\.js#config/);
assert.match(source, /does not mutate Pack state directly/i);
assert.match(source, /supported: true/);
assert.doesNotMatch(source, /fetch\([^)]*(activate|deactivate|install|upgrade)/i);
assert.doesNotMatch(source, /localStorage\.(setItem|removeItem).*pack/i);

const settings = fs.readFileSync(new URL('../app/src/ui/settings.js', import.meta.url), 'utf8');
assert.match(settings, /renderPackEntitlementPanel/);
assert.match(settings, /renderPackReadinessPanel/);

const pack = { pack_id: 'warehouse', version: '1.0.0' };
const inferredReady = getPackActivationExperienceModel({
  pack,
  readiness: { readiness: 'READY', active: true },
  entitlement: { configurationState: 'ACTIVE_BY_CONFIG' },
});
assert.equal(inferredReady.lifecycleState, 'UNKNOWN', 'readiness must not synthesize canonical ACTIVE lifecycle state');
assert.equal(inferredReady.installation.status, 'UNKNOWN', 'missing canonical lifecycle record must remain unknown');

const inferredInactive = getPackActivationExperienceModel({
  pack,
  readiness: { readiness: 'CONFIGURATION_INACTIVE' },
  entitlement: { configurationState: 'INACTIVE_BY_CONFIG' },
});
assert.equal(inferredInactive.lifecycleState, 'UNKNOWN', 'local configuration must not synthesize DEACTIVATED lifecycle state');

const recovery = getPackActivationExperienceModel({
  pack,
  readiness: { readiness: 'READY', active: true },
  lifecycle: { state: 'RECOVERY_REQUIRED' },
});
assert.equal(recovery.lifecycleState, 'RECOVERY_REQUIRED', 'canonical recovery state must survive projection unchanged');

console.log('FUX-13 Pack Installation/Activation Experience Contract regression: PASS');
