// Logistics L8-L21 final certification gate.
// Certification has two independent requirements:
// 1. source/contract integrity;
// 2. actual cumulative execution under the declared Node >=24 runtime.
//
// This gate intentionally fails certification when executed below Node 24.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(pkg.engines?.node, '>=24');

const requiredScripts = [
  'test:logistics-l8',
  'test:logistics-l9',
  'test:logistics-l8-l10',
  'test:logistics-l11.16',
  'test:logistics-l12',
  'test:logistics-l13',
  'test:logistics-l14',
  'test:logistics-l15',
  'test:logistics-l16',
  'test:logistics-l17',
  'test:logistics-l18',
  'test:logistics-l19',
  'test:logistics-l20.10',
  'test:logistics-l21.11',
  'test:logistics-l8-l21',
];

for (const name of requiredScripts) {
  assert.equal(typeof pkg.scripts?.[name], 'string', `Missing Logistics certification script: ${name}`);
}

const requiredFiles = [
  'phase0/logistics-demand-profile-regression.mjs',
  'phase0/logistics-capacity-profile-regression.mjs',
  'phase0/logistics-l8-l10-demand-capacity-matching-regression.mjs',
  'phase0/logistics-scheduling-decision-regression.mjs',
  'phase0/logistics-evidence-profile-regression.mjs',
  'phase0/logistics-multi-leg-movement-regression.mjs',
  'phase0/logistics-hub-depot-regression.mjs',
  'phase0/logistics-regional-freight-regression.mjs',
  'phase0/logistics-b2b-distribution-regression.mjs',
  'phase0/logistics-b2c-delivery-regression.mjs',
  'phase0/logistics-p2p-delivery-regression.mjs',
  'phase0/logistics-dynamic-capacity-utilization-regression.mjs',
  'phase0/logistics-network-corridor-intelligence-regression.mjs',
  'phase0/logistics-external-network-expansion-regression.mjs',
  'phase0/logistics-l8-l21-cumulative-exit-gate.mjs',
];

for (const rel of requiredFiles) {
  assert.equal(fs.existsSync(path.join(root, rel)), true, `Missing Logistics certification source: ${rel}`);
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 24) {
  console.error(`Logistics L8-L21 Final Certification: BLOCKED — Node ${process.version}; Node >=24 is required.`);
  process.exitCode = 2;
} else {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'test:logistics-l8-l21'], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error('Logistics L8-L21 Final Certification: FAIL — cumulative exit gate failed.');
    process.exit(result.status || 1);
  }
  console.log(`Logistics L8-L21 Final Certification: PASS — Node ${process.version}`);
}
