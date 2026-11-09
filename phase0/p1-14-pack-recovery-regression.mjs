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
assert.match(source, /getPackReadinessModel\(\)\.then\(rows => rows\.map/,
  'recovery projection must await the asynchronous canonical readiness model');
assert.match(source, /getPackRecoveryModel\(\)\.then\(rows =>/,
  'Settings recovery rendering must await its readiness projection');
assert.match(source, /canonical Pack readiness could not be reconciled/,
  'readiness failures must remain UNKNOWN instead of throwing during Settings open');
assert.match(fs.readFileSync('app/src/ui/settings.js', 'utf8'), /renderPackRecoveryPanel/);
assert.match(fs.readFileSync('app/index.html', 'utf8'), /packRecoveryPanel/);
console.log('P1-14 Pack Recovery & Failure UX regression: PASS');
