import fs from 'node:fs';
import assert from 'node:assert/strict';
const required = [
 'phase0/PHASE14.0-COUNTRY-PACK-BASELINE.md','phase0/PHASE14.13-CROSS-COUNTRY-REGRESSION.md',
 'phase0/phase14.0-country-pack-baseline-regression.mjs','phase0/phase14.13-cross-country-regression.mjs',
 'app/src/country-pack-contract.js','app/src/country-configuration.js','app/src/country-event-integration.js',
 'backend/lib/country-security-isolation.js','SELLIFY_AI_HANDOFF.md'
];
for (const f of required) assert.equal(fs.existsSync(f), true, `Missing final-snapshot artifact: ${f}`);
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.equal(pkg.engines?.node,'>=24');
console.log('Phase 14.15 final snapshot structure: PASS');
