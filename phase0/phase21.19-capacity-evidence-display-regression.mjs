import assert from 'node:assert/strict';
import fs from 'node:fs';
import { projectCapacityEvidenceDisplay } from '../app/src/procurement/capacity-evidence-display.js';

const ui = fs.readFileSync(new URL('../app/src/procurement/ui.js', import.meta.url), 'utf8');
assert.match(ui, /projectCapacityEvidenceDisplay/);
assert.match(ui, /Quality \${esc\(display\.quality\)}/);
assert.match(ui, /Freshness \${esc\(display\.freshness\)}/);
const displayModule = fs.readFileSync(new URL('../app/src/procurement/capacity-evidence-display.js', import.meta.url), 'utf8');
assert.match(displayModule, /Declaration recorded/);
assert.doesNotMatch(ui, /\$\{esc\(validity\)\} · SELF-REPORTED/);

const now = Date.parse('2026-11-22T12:00:00.000Z');
const legacy = projectCapacityEvidenceDisplay({ observedAt: null, validUntil: '2026-12-01T00:00:00.000Z', quality: 'UNKNOWN' }, now);
assert.equal(legacy.quality, 'UNKNOWN');
assert.equal(legacy.freshness, 'UNKNOWN');
assert.equal(legacy.recordedLabel, 'Declaration record time unknown');

const current = projectCapacityEvidenceDisplay({ observedAt: '2026-11-21T12:00:00.000Z', validUntil: '2026-12-01T00:00:00.000Z', quality: 'SELF_REPORTED' }, now);
assert.equal(current.quality, 'SELF_REPORTED');
assert.equal(current.freshness, 'CURRENT');
assert.match(current.recordedLabel, /^Declaration recorded /);

const stale = projectCapacityEvidenceDisplay({ observedAt: '2026-11-01T00:00:00.000Z', validUntil: '2026-11-20T00:00:00.000Z', quality: 'SELF_REPORTED' }, now);
assert.equal(stale.freshness, 'STALE');
assert.match(stale.validityLabel, /^Declared validity expired /);

const futureObserved = projectCapacityEvidenceDisplay({ observedAt: '2026-11-23T00:00:00.000Z', validUntil: '2026-12-01T00:00:00.000Z', quality: 'SELF_REPORTED' }, now);
assert.equal(futureObserved.freshness, 'UNKNOWN');

const unsupportedQuality = projectCapacityEvidenceDisplay({ observedAt: '2026-11-21T12:00:00.000Z', validUntil: '2026-12-01T00:00:00.000Z', quality: 'SELF_ATTESTED_VERIFIED' }, now);
assert.equal(unsupportedQuality.quality, 'UNKNOWN');
assert.equal(unsupportedQuality.freshness, 'CURRENT');
assert.throws(() => { current.freshness = 'CURRENT'; }, TypeError);
console.log('Phase 21.19 Procurement Capacity Evidence Display Regression: PASS');
