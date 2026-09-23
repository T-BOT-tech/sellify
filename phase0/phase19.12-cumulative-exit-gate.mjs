// Phase 19.12 — final cumulative exit gate.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const checks = [
  ['19.2', 'phase19.2-discovery-provider-registry-regression.mjs'],
  ['19.3', 'phase19.3-cross-marketplace-product-discovery-regression.mjs'],
  ['19.4', 'phase19.4-seller-organization-discovery-regression.mjs'],
  ['19.5', 'phase19.5-supplier-network-federation-regression.mjs'],
  ['19.6', 'phase19.6-market-context-regression.mjs'],
  ['19.7', 'phase19.7-deterministic-matching-regression.mjs'],
  ['19.8', 'phase19.8-explainable-ranking-regression.mjs'],
  ['19.9', 'phase19.9-opportunity-model-regression.mjs'],
  ['19.10', 'phase19.10-unified-discovery-api-regression.mjs'],
  ['19.11', 'phase19.11-ai-intent-translation-boundary-regression.mjs'],
  ['19.12', 'phase19.12-full-ecosystem-discovery-exit-regression.mjs'],
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

const phase18 = run('phase18.12-supplier-network-final-exit-regression.mjs');
if (!phase18.pass) throw new Error('Phase 18.12 structural exit failed');
console.log('Phase 18.12 structural exit: PASS');

const phase16 = run('phase16.12-platform-regression.mjs');
if (!phase16.pass) throw new Error('Phase 16.12 platform regression failed');
console.log('Phase 16.12 platform regression: PASS');

const golden = run('golden-regression.mjs');
if (!golden.pass) throw new Error('Phase 0 Golden failed');
console.log('Phase 0 Golden: PASS');

const report = {
  phase: '19.12',
  name: 'Full Ecosystem Discovery Exit',
  status: 'PASS',
  cumulative: results,
  phase18_12_structural: 'PASS',
  phase16_12_platform: 'PASS',
  phase0_golden: 'PASS',
  node24: 'DEFERRED_TO_PHASE_16.13',
  runtime: process.version,
  architecture: 'FLOWOS Discovery Fabric',
  mission: 'Discover globally. Match deterministically. Rank transparently. Preserve provenance. Act only through the owning domain.',
  aiBoundary: 'Natural Language → AI → Structured Intent → Deterministic Discovery',
  persistence: 'none',
  transactionExecution: false,
  authorityBoundary: 'Discovery is federated; authority is decentralized.',
};
writeFileSync('phase0/PHASE19.12-CUMULATIVE-EXIT-REPORT.json', JSON.stringify(report, null, 2) + '\n');
writeFileSync('PHASE19.12-CUMULATIVE-EXIT.md', `# Phase 19.12 — Full Ecosystem Discovery Exit\n\nStatus: **PASS**\n\nPhases 19.2–19.12 pass consecutively. Phase 18.12 structural exit, Phase 16.12 platform regression, and Phase 0 Golden also pass. Node >=24 remains explicitly deferred to Phase 16.13 certification.\n\n## Frozen Discovery Fabric constitution\n\n> Discover globally. Match deterministically. Rank transparently. Preserve provenance. Act only through the owning domain.\n\nAI boundary: Natural Language → AI → Structured Intent → Deterministic Discovery.\n\nDiscovery remains read-only and derived. Product, organization, supplier, inventory, procurement, payment, order, settlement, and trust authorities remain owned by their respective domains.\n`);
console.log('PHASE 19.12 CUMULATIVE EXIT: PASS');
