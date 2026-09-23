import assert from 'node:assert/strict';
import fs from 'node:fs';

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

console.log('FUX-13 Pack Installation/Activation Experience Contract regression: PASS');
