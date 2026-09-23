import {spawnSync} from 'node:child_process';
const tests=['phase18.1-supplier-network-profile-regression.mjs','phase18.2-supplier-network-capability-regression.mjs','phase18.3-supplier-network-catalog-regression.mjs','phase18.4-supplier-network-service-area-regression.mjs','phase18.5-supplier-network-capacity-regression.mjs','phase18.6-supplier-network-commercial-regression.mjs','phase18.7-supplier-network-qualification-regression.mjs','phase18.8-supplier-network-performance-regression.mjs'];
for(const test of tests){const r=spawnSync(process.execPath,['phase0/'+test],{stdio:'inherit'});if(r.status!==0)process.exit(r.status??1)}
const r=spawnSync(process.execPath,['phase0/phase17.10-cumulative-exit-gate.mjs'],{stdio:'inherit'});if(r.status!==0)process.exit(r.status??1);
console.log('Phase 18.8 Cumulative Gate: PASS');
