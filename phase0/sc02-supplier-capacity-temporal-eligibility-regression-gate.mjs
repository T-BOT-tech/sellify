// SC-02 — supplier capacity temporal eligibility cross-domain regression gate.
// Runs the canonical Supplier Network, Discovery, Logistics projection and
// Procurement UI regressions together so the UI/backend slice is not merely
// covered by source-shape assertions in the broad cumulative gates.
import { spawnSync } from 'node:child_process';

const checks = [
  ['Supplier Network discovery persistence and capacity composition', 'phase18.10-supplier-network-discovery-regression.mjs'],
  ['Supplier Network Discovery provider projection', 'phase19.5-supplier-network-federation-regression.mjs'],
  ['Deterministic time-window capacity eligibility', 'phase19.7-deterministic-matching-regression.mjs'],
  ['Logistics provider temporal capacity projection', 'phase16.13.10-logistics-provider-matching-regression.mjs'],
  ['Procurement sourcing UI and backend traceability', 'r1-golden-e2e-traceability-gate.mjs'],
  ['Procurement capacity evidence display semantics', 'phase21.19-capacity-evidence-display-regression.mjs'],
  ['Procurement RFQ capacity evidence snapshot persistence', 'phase21.20-procurement-rfq-capacity-evidence-snapshot-regression.mjs'],
];

for (const [label, file] of checks) {
  console.log(`RUN: ${label} (${file})`);
  const result = spawnSync(process.execPath, [`phase0/${file}`], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    throw new Error(`SC-02 regression failed: ${label} (${file})`);
  }
  process.stdout.write(`PASS: ${label}\\n`);
}

console.log('SC-02 Supplier Capacity Temporal Eligibility Gate: PASS');
