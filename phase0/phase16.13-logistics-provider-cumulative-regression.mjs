// Phase 16.13 Logistics provider stack cumulative regression.
// Runs every distinct Phase 16.13 provider-stack regression once under the
// supported runtime. The .17 package alias is intentionally excluded because
// it points to the .13 regression and is not a separate source test.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const major = Number(process.versions.node.split('.')[0]);
assert(major >= 24, `Phase 16.13 provider regressions require Node >=24; received ${process.version}`);

const regressions = [
  'phase0/phase16.13.1-logistics-network-contract-regression.mjs',
  'phase0/phase16.13.2-logistics-provider-capability-regression.mjs',
  'phase0/phase16.13.3-logistics-provider-adapter-regression.mjs',
  'phase0/phase16.13.4-logistics-provider-discovery-regression.mjs',
  'phase0/phase16.13.5-logistics-provider-verification-regression.mjs',
  'phase0/phase16.13.6-logistics-provider-selection-regression.mjs',
  'phase0/phase16.13.7-logistics-provider-execution-handoff-regression.mjs',
  'phase0/phase16.13.8-logistics-provider-execution-result-regression.mjs',
  'phase0/phase16.13.9-logistics-provider-execution-reliability-regression.mjs',
  'phase0/phase16.13.10-logistics-provider-matching-regression.mjs',
  'phase0/phase16.13.11-logistics-network-integration-regression.mjs',
  'phase0/phase16.13.12-logistics-provider-execution-bridge-regression.mjs',
  'phase0/phase16.13.13-logistics-provider-canonical-application-regression.mjs',
  'phase0/phase16.13.14-logistics-provider-execution-service-regression.mjs',
  'phase0/phase16.13.15-logistics-provider-execution-runtime-regression.mjs',
  'phase0/phase16.13.16-logistics-provider-deployment-adapter-regression.mjs',
  'phase0/phase16.13.18-logistics-provider-callback-regression.mjs',
  'phase0/phase16.13.19-logistics-provider-callback-application-regression.mjs',
];

for (const relativePath of regressions) {
  try {
    execFileSync(process.execPath, [path.join(root, relativePath)], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });
  } catch (error) {
    assert.fail(`Phase 16.13 provider regression failed: ${relativePath} (exit status ${error?.status ?? 'unknown'})`);
  }
}

console.log(`PHASE 16.13 LOGISTICS PROVIDER STACK: PASS (${regressions.length} distinct regressions, ${process.version})`);
