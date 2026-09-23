import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('app/src/authorization/pack-recovery.js', 'utf8');
assert.match(source, /UNKNOWN/);
assert.match(source, /DEPENDENCY_UNAVAILABLE/);
assert.match(source, /CONFIGURATION_INACTIVE/);
assert.match(source, /DECLARATIVE_ONLY/);
assert.match(source, /JOURNEY_UNAVAILABLE/);
assert.match(source, /PROVIDER_UNAVAILABLE/);
assert.match(source, /canonical server/);
assert.match(source, /never mutates Pack state/i);
assert.match(fs.readFileSync('app/src/ui/settings.js', 'utf8'), /renderPackRecoveryPanel/);
assert.match(fs.readFileSync('app/index.html', 'utf8'), /packRecoveryPanel/);
console.log('P1-14 Pack Recovery & Failure UX regression: PASS');
