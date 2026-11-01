import assert from 'node:assert/strict';
import fs from 'node:fs';

// The browser module graph reads APP_CONFIG at import time; provide the minimal
// browser global before dynamically loading the readiness projection in Node.
globalThis.window = { __APP_CONFIG__: {} };
const { readinessFor } = await import('../app/src/authorization/pack-readiness.js');

const source = fs.readFileSync(new URL('../app/src/authorization/pack-readiness.js', import.meta.url), 'utf8');
assert.match(source, /DEPENDENCY_UNAVAILABLE/);
assert.match(source, /CONFIGURATION_INACTIVE/);
assert.match(source, /DECLARATIVE_ONLY/);
assert.match(source, /JOURNEY_UNAVAILABLE/);
assert.match(source, /READY/);
assert.match(source, /CORE_AUTHORITIES/);
assert.match(source, /backend\/lib\/authorization\.js/);
assert.match(source, /settings:configure/);
assert.match(source, /PACK_JOURNEY_ENTRY_TO_TAB/);
assert.match(source, /hasExecutableJourney/);
assert.match(source, /ENTRY_EXECUTABLE/);
assert.match(source, /ENTRY_UNRESOLVED/);
assert.match(source, /workspaceTab/);

const lifecycleProjectionPack = { core_dependencies: ['inventory'], ui_entry_points: ['inventory'] };
assert.equal(readinessFor(lifecycleProjectionPack, { enabled: true }, {
  lifecycle: { state: 'RECOVERY_REQUIRED' },
  readiness: { state: 'UNKNOWN', active: false },
}), 'RECOVERY_REQUIRED', 'canonical recovery lifecycle state must not collapse to generic UNKNOWN');
assert.equal(readinessFor(lifecycleProjectionPack, { enabled: true }, {
  lifecycle: { state: 'UPGRADE_BLOCKED' },
  readiness: { state: 'UNKNOWN', active: false },
}), 'UPGRADE_BLOCKED', 'canonical upgrade-blocked lifecycle state must remain visible in readiness projection');
assert.equal(readinessFor(lifecycleProjectionPack, { enabled: true }, {
  lifecycle: { state: 'DEPENDENCY_BLOCKED' },
  readiness: { state: 'UNKNOWN', active: false },
}), 'DEPENDENCY_UNAVAILABLE', 'canonical dependency-blocked lifecycle state must remain visible');

const settings = fs.readFileSync(new URL('../app/src/ui/settings.js', import.meta.url), 'utf8');
assert.match(settings, /renderPackReadinessPanel/);
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
assert.match(html, /id="packReadinessPanel"/);

console.log('P1-13 Pack Dependency & Readiness regression: PASS');
