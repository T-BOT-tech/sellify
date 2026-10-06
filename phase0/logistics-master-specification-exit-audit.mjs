// Logistics Master Specification Exit Audit — L1-L21.
// Source-derived control only. This audit does not claim runtime certification.
// The master specification requires implemented behavior to remain distinguishable
// from deferred/future opportunities and prohibits duplicate domain authorities.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const pkg = JSON.parse(read('package.json'));

const evidence = [
  ['L1-L7 foundation', [
    'phase13.10.1:logistics-boundary-test',
    'test:phase13.10.2',
    'test:phase13.10.3',
    'test:phase13.10.4',
    'test:phase13.10.5',
    'test:phase13.10.6',
    'test:phase13.10.7',
    'test:phase13.10.9',
    'test:phase13.10.10',
    'test:phase13.10.11',
    'test:phase13.10.12',
    'test:phase13.10.13',
    'test:phase13.10.14',
    'test:phase13.10.15',
  ]],
  ['L8 Demand Profiles', ['test:logistics-l8']],
  ['L9 Capacity Profiles', ['test:logistics-l9']],
  ['L10 Demand → Capacity Matching', ['test:logistics-l8-l10']],
  ['L11 Scheduling', ['test:logistics-l11.16']],
  ['L12 Evidence Profiles', ['test:logistics-l12']],
  ['L13 Multi-Leg Movement', ['test:logistics-l13']],
  ['L14 Hub / Depot Coordination', ['test:logistics-l14']],
  ['L15 Regional Freight', ['test:logistics-l15']],
  ['L16 B2B Distribution', ['test:logistics-l16']],
  ['L17 B2C Delivery', ['test:logistics-l17']],
  ['L18 P2P Delivery', ['test:logistics-l18']],
  ['L19 Dynamic Capacity Utilization', ['test:logistics-l19']],
  ['L20 Network / Corridor Intelligence', ['test:logistics-l20.10']],
  ['L21 External Network Expansion', ['test:logistics-l21.11']],
];

for (const [layer, scripts] of evidence) {
  for (const script of scripts) {
    assert.equal(typeof pkg.scripts?.[script], 'string', `Missing evidence script for ${layer}: ${script}`);
  }
}

const sourceContracts = [
  'app/src/verticals/logistics/logistics-demand-profile-contract.js',
  'app/src/verticals/logistics/logistics-capacity-profile-contract.js',
  'app/src/verticals/logistics/multi-leg-movement-contract.js',
  'app/src/verticals/logistics/hub-depot-contract.js',
  'app/src/verticals/logistics/regional-freight-contract.js',
  'app/src/verticals/logistics/b2b-distribution-contract.js',
  'app/src/verticals/logistics/b2c-delivery-contract.js',
  'app/src/verticals/logistics/p2p-delivery-contract.js',
  'app/src/verticals/logistics/dynamic-capacity-utilization-contract.js',
  'app/src/verticals/logistics/network-corridor-intelligence-contract.js',
];

for (const rel of sourceContracts) {
  assert.equal(fs.existsSync(path.join(root, rel)), true, `Missing master-audit contract: ${rel}`);
}

const forbiddenAuthorityTokens = [
  'LogisticsOrder',
  'LogisticsPayment',
  'LogisticsInventory',
  'LogisticsLedger',
  'LogisticsIdentity',
  'LogisticsFulfillment',
  'LogisticsProviderRegistry',
];

for (const rel of sourceContracts) {
  const source = read(rel);
  for (const token of forbiddenAuthorityTokens) {
    const declaration = new RegExp(`(?:export\\s+)?(?:const|let|var|class|function)\\s+${token}\\b`);
    assert(!declaration.test(source), `${rel} declares forbidden parallel authority ${token}`);
  }
}

// Master-spec explicit deferrals must remain visible in the source boundary.
// L13 deliberately does not create persistent legs; it extends the existing
// Movement → Shipment extension point only.
const multiLeg = read('app/src/verticals/logistics/multi-leg-movement-contract.js');
assert.match(multiLeg, /Persistent multi-leg legs remain deferred/i);
assert.match(multiLeg, /no leg store/i);

// L10 must continue delegating matching to Discovery rather than introducing
// a second matcher.
const matching = read('backend/lib/discovery/logistics-provider-matching.js');
assert.match(matching, /matchDiscoveryCandidates/);
assert.match(matching, /discovery_matching/);

// L21 must remain provider-neutral at the Logistics core boundary.
const external = read('app/src/verticals/logistics/external-network-contract.js');
assert.match(external, /provider-neutral|provider neutral/i);

assert.equal(pkg.engines?.node, '>=24');
assert.equal(pkg.scripts?.['test:logistics-l8-l21'], 'node phase0/logistics-l8-l21-cumulative-exit-gate.mjs');
assert.equal(pkg.scripts?.['test:logistics-l8-l21-certification'], 'node phase0/logistics-l8-l21-final-certification.mjs');

console.log('SELLIFY LOGISTICS MASTER SPECIFICATION EXIT AUDIT L1-L21: PASS');
console.log('All roadmap layers have registered regression evidence and required contracts are present.');
console.log('No prohibited parallel Logistics authority declarations detected in audited contracts.');
console.log('L13 persistent multi-leg storage remains explicitly deferred per master specification.');
console.log('L10 continues to reuse Discovery matching authority.');
console.log('L21 remains provider-neutral at the Logistics core boundary.');
console.log('Runtime certification remains separate and requires Node >=24 execution.');
