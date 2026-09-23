import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineVerticalPack } from '../app/src/verticals/contract.js';
import { buildVersionedEvent, eventBoundaryContract } from '../app/src/events/event-boundary.js';
import { assertCountryPack } from '../app/src/country-pack-contract.js';
import { authorize, AUTHZ } from '../backend/lib/authorization.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const pkg = JSON.parse(read('package.json'));
let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`PASS ${name}`); };

check('Node engine remains >=24', () => assert.equal(pkg.engines?.node, '>=24'));
check('Phase 15.20 regression remains wired', () => assert.match(pkg.scripts?.['test:phase15.20'] || '', /phase15\.20-cross-country-regression-gate\.mjs/));
check('Phase 16 baseline script is wired', () => assert.match(pkg.scripts?.['test:phase16.0'] || '', /phase16\.0-platform-baseline-regression\.mjs/));
check('Canonical event boundary remains versioned', () => {
  const c = eventBoundaryContract();
  assert.equal(c.version, '1.0');
  assert.equal(c.outbox_authority, 'app/src/sync/outbox.js#enqueueEvent');
  assert.equal(c.persistence, 'existing outbox and sync_events only');
});
check('Versioned events retain organization and idempotency boundaries', () => {
  const e = buildVersionedEvent({ eventId: 'phase16:baseline:1', eventType: 'baseline.checked', aggregateType: 'platform_baseline', aggregateId: '1', organizationId: 'org-1', payload: {} });
  assert.equal(e.organization_id, 'org-1');
  assert.equal(e.idempotency_key, 'phase16:baseline:1');
});
check('Vertical contract rejects Core Order authority duplication', () => {
  assert.throws(() => defineVerticalPack({ pack_id: 'bad-pack', name: 'Bad', version: '1.0.0', domain_entities: ['Order'] }), /reserved by Core/);
});
check('Country contract rejects forbidden persistence authority', () => {
  assert.throws(() => assertCountryPack({ countryCode: 'ET', currency: 'ETB', locale: 'en-ET', languages: ['en'], tax: {}, documents: {}, phoneRules: {}, addressRules: {}, paymentProviders: [], compliance: {}, numberFormats: {}, dateFormats: {}, ownsPersistence: true }), /forbidden|persistence|COUNTRY_PACK_INVALID/i);
});
check('Central authorization remains deny-by-default for missing actor', () => assert.equal(authorize(null, 'org-1', null, 'platform', 'platform:view'), AUTHZ.DENY));
check('Phase 16 baseline does not introduce a platform store', () => {
  for (const forbidden of ['platform-store', 'platform-ledger', 'platform-database', 'platform-event-store']) {
    assert.equal(fs.existsSync(path.join(ROOT, forbidden)), false, `${forbidden} must not exist`);
  }
});

console.log(`PHASE16.0 BASELINE: ${passed} PASS / 0 FAIL`);
