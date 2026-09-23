// Phase 19.11 — cumulative Discovery Fabric gate.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

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
];

const results = [];
for (const [phase, file] of checks) {
  const r = spawnSync(process.execPath, [`phase0/${file}`], { encoding: 'utf8' });
  const pass = r.status === 0;
  results.push({ phase, file, status: pass ? 'PASS' : 'FAIL', stdout: r.stdout || '', stderr: r.stderr || '' });
  if (!pass) {
    console.error(r.stdout || '');
    console.error(r.stderr || '');
    process.exitCode = 1;
    break;
  }
  console.log(`Phase ${phase}: PASS`);
}

if (process.exitCode) throw new Error('Phase 19.11 cumulative gate failed');

const structural = spawnSync(process.execPath, ['phase0/phase18.12-supplier-network-final-exit-regression.mjs'], { encoding: 'utf8' });
if (structural.status !== 0) throw new Error('Phase 18.12 structural exit failed');
console.log('Phase 18.12 structural exit: PASS');

const golden = spawnSync(process.execPath, ['phase0/golden-regression.mjs'], { encoding: 'utf8' });
if (golden.status !== 0) throw new Error('Phase 0 Golden failed');
console.log('Phase 0 Golden: PASS');

const report = {
  phase: '19.11',
  name: 'AI Intent Translation Boundary',
  status: 'PASS',
  cumulative: results.map(({ phase, file, status }) => ({ phase, file, status })),
  phase18_12_structural: 'PASS',
  phase0_golden: 'PASS',
  node24: 'DEFERRED_TO_PHASE_16.13',
  runtime: process.version,
  authorityBoundary: 'Natural Language → AI → Structured Intent → Deterministic Discovery',
  aiCannot: ['candidate-generation', 'ranking', 'trust-scoring', 'provenance-invention', 'action-authorization', 'execution', 'persistence', 'direct-database-access', 'direct-credentials-access'],
};
writeFileSync('phase0/PHASE19.11-CUMULATIVE-EXIT-REPORT.json', JSON.stringify(report, null, 2) + '\n');
writeFileSync('PHASE19.11-CUMULATIVE-EXIT.md', `# Phase 19.11 Cumulative Exit\n\nStatus: **PASS**\n\nDiscovery Fabric phases 19.2–19.11 all pass, Phase 18.12 structural exit passes, and Phase 0 Golden passes. Node >=24 remains deferred to Phase 16.13 certification.\n\nFrozen AI boundary: Natural Language → AI → Structured Intent → Deterministic Discovery.\n`);
console.log('PHASE 19.11 CUMULATIVE EXIT: PASS');
