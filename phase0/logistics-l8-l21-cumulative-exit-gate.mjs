// Logistics L8-L21 cumulative exit gate.
// This is a certification orchestrator only: it owns no Logistics domain authority.
// Each layer remains independently authoritative within its existing boundary.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const gates = [
  ['L8', 'phase0/logistics-demand-profile-regression.mjs'],
  ['L9', 'phase0/logistics-capacity-profile-regression.mjs'],
  ['L8-L10', 'phase0/logistics-l8-l10-demand-capacity-matching-regression.mjs'],
  ['L11', 'phase0/logistics-scheduling-decision-regression.mjs'],
  ['L12', 'phase0/logistics-evidence-profile-regression.mjs'],
  ['L13', 'phase0/logistics-multi-leg-movement-regression.mjs'],
  ['L14', 'phase0/logistics-hub-depot-regression.mjs'],
  ['L15', 'phase0/logistics-regional-freight-regression.mjs'],
  ['L16', 'phase0/logistics-b2b-distribution-regression.mjs'],
  ['L17', 'phase0/logistics-b2c-delivery-regression.mjs'],
  ['L18', 'phase0/logistics-p2p-delivery-regression.mjs'],
  ['L19', 'phase0/logistics-dynamic-capacity-utilization-regression.mjs'],
  ['L20', 'phase0/logistics-network-corridor-intelligence-regression.mjs'],
  ['L21', 'phase0/logistics-external-network-expansion-regression.mjs'],
];

for (const [layer, relativePath] of gates) {
  const script = path.join(root, relativePath);
  try {
    execFileSync(process.execPath, [script], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });
  } catch (error) {
    assert.fail(`Logistics ${layer} exit gate failed: ${relativePath} (exit status ${error?.status ?? 'unknown'})`);
  }
}

console.log('LOGISTICS L8-L21 CUMULATIVE EXIT GATE: PASS');
