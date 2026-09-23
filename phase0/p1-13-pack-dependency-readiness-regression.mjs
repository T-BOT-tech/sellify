import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../app/src/authorization/pack-readiness.js', import.meta.url), 'utf8');
assert.match(source, /DEPENDENCY_UNAVAILABLE/);
assert.match(source, /CONFIGURATION_INACTIVE/);
assert.match(source, /DECLARATIVE_ONLY/);
assert.match(source, /JOURNEY_UNAVAILABLE/);
assert.match(source, /READY/);
assert.match(source, /CORE_AUTHORITIES/);
assert.match(source, /backend\/lib\/authorization\.js/);
assert.match(source, /settings:configure/);
assert.doesNotMatch(source, /pack-journey-composition/);

const settings = fs.readFileSync(new URL('../app/src/ui/settings.js', import.meta.url), 'utf8');
assert.match(settings, /renderPackReadinessPanel/);
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
assert.match(html, /id="packReadinessPanel"/);

console.log('P1-13 Pack Dependency & Readiness regression: PASS');
