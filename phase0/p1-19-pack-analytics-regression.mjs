import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('app/src/authorization/pack-analytics.js','utf8');
const settings = fs.readFileSync('app/src/ui/settings.js','utf8');
const html = fs.readFileSync('app/index.html','utf8');

assert.match(source, /audit\?limit/);
assert.match(source, /audit:view/);
assert.match(source, /UNKNOWN/);
assert.match(source, /FAILURE/);
assert.match(source, /does not create telemetry/);
assert.doesNotMatch(source, /INSERT INTO|CREATE TABLE|recordAuditEvent|telemetryStore|analytics_events/);
assert.match(settings, /renderPackAnalyticsPanel/);
assert.match(html, /id="packAnalyticsPanel"/);

console.log('P1-19 Pack Analytics & Product Telemetry regression: PASS');
