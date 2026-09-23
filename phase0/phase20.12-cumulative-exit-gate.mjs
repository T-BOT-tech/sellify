// Phase 20.12 — Cross-Border Commerce Coordination cumulative exit gate.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const checks = [
  ['20.1', 'phase20.1-cross-border-contract-regression.mjs'],
  ['20.2', 'phase20.2-trade-lane-regression.mjs'],
  ['20.3', 'phase20.3-cross-border-market-context-regression.mjs'],
  ['20.4', 'phase20.4-country-interface-regression.mjs'],
  ['20.5', 'phase20.5-currency-context-regression.mjs'],
  ['20.6', 'phase20.6-cross-border-commercial-regression.mjs'],
  ['20.7', 'phase20.7-trade-requirements-evidence-regression.mjs'],
  ['20.8', 'phase20.8-cross-border-logistics-regression.mjs'],
  ['20.9', 'phase20.9-cross-border-evaluation-regression.mjs'],
  ['20.10', 'phase20.10-cross-border-plan-regression.mjs'],
  ['20.11', 'phase20.11-cross-border-ai-intent-regression.mjs'],
];

function run(file) {
  const r = spawnSync(process.execPath, [`phase0/${file}`], { encoding: 'utf8' });
  return { pass: r.status === 0, stdout: r.stdout || '', stderr: r.stderr || '' };
}

const results = [];
for (const [phase, file] of checks) {
  const result = run(file);
  results.push({ phase, file, status: result.pass ? 'PASS' : 'FAIL' });
  if (!result.pass) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`Phase ${phase} failed`);
  }
  console.log(`Phase ${phase}: PASS`);
}

for (const [label, file] of [
  ['Phase 19.12 discovery exit', 'phase19.12-full-ecosystem-discovery-exit-regression.mjs'],
  ['Phase 18.12 structural exit', 'phase18.12-supplier-network-final-exit-regression.mjs'],
  ['Phase 16.12 platform regression', 'phase16.12-platform-regression.mjs'],
  ['Phase 0 Golden', 'golden-regression.mjs'],
]) {
  const result = run(file);
  if (!result.pass) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`${label} failed`);
  }
  console.log(`${label}: PASS`);
}

const report = {
  phase: '20.12',
  name: 'Full Cross-Border Commerce Coordination Exit',
  status: 'PASS',
  cumulative: results,
  phase19_12_discovery_exit: 'PASS',
  phase18_12_structural_exit: 'PASS',
  phase16_12_platform_regression: 'PASS',
  phase0_golden: 'PASS',
  node24: 'DEFERRED_TO_PHASE_16.13',
  runtime: process.version,
  architecture: 'Cross-Border Commerce Coordination',
  mission: 'Coordinate cross-border commercial flows without creating duplicate domain authority.',
  persistence: 'none for Phase 20 coordination contracts',
  transactionExecution: false,
  providerExecution: false,
  aiBoundary: 'Natural Language → AI → Structured Cross-Border Intent → Deterministic Phase 20 Evaluation',
  authorityBoundary: 'Cross-border coordination is derived; existing domain authorities remain canonical.',
  invariants: {
    unknownIsSuccess: false,
    feasibilityIsAuthorization: false,
    authorizationIsExecution: false,
    duplicateAuthority: false,
  },
};
writeFileSync('phase0/PHASE20.12-CUMULATIVE-EXIT-REPORT.json', JSON.stringify(report, null, 2) + '\n');
console.log('PHASE 20.12 CUMULATIVE EXIT: PASS');
