import {spawnSync} from 'node:child_process';
const tests=['phase18.1-supplier-network-profile-regression.mjs','phase18.2-supplier-network-capability-regression.mjs','phase18.3-supplier-network-catalog-regression.mjs','phase18.4-supplier-network-service-area-regression.mjs','phase18.5-supplier-network-capacity-regression.mjs','phase18.6-supplier-network-commercial-regression.mjs','phase18.7-supplier-network-qualification-regression.mjs','phase18.8-supplier-network-performance-regression.mjs','phase18.9-supplier-network-trust-regression.mjs','phase18.10-supplier-network-discovery-regression.mjs','phase18.11-supplier-network-marketplace-integration-regression.mjs'];
for(const file of tests){const r=spawnSync(process.execPath,[`phase0/${file}`],{stdio:'inherit'});if(r.status!==0)throw new Error(`Phase 18 cumulative gate failed: ${file}`);}
const p=spawnSync(process.execPath,['phase0/phase17.10-cumulative-exit-gate.mjs'],{stdio:'inherit'});if(p.status!==0)throw new Error('Phase 17.10 prerequisite failed');
console.log('PHASE18.11 CUMULATIVE EXIT GATE: PASS');
console.log('Phase 18 regressions: 11 PASS / 0 FAIL');
console.log('Phase 17.10 prerequisite: PASS');
console.log('Phase 0 Golden prerequisite: PASS');
console.log('Node >=24 certification: DEFERRED_TO_PHASE_16.13');
