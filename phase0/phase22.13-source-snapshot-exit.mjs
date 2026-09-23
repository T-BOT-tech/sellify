import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = ['PHASE22.13_SOURCE_SNAPSHOT_EXIT.md','PHASE22.12_IMPLEMENTATION_HANDOFF.md','PHASE22.12-SOURCE-HASHES.sha256','package.json','app/src/phase22-procurement-intent.js','app/src/phase22-procurement-context.js','app/src/phase22-evidence-supplier-intelligence.js','app/src/phase22-procurement-preparation.js','app/src/phase22-deterministic-result-explanation.js','app/src/phase22-action-proposal-authorization.js','app/src/phase22-procurement-integration.js'];
for (const rel of required) assert.equal(fs.existsSync(path.join(root,rel)),true,`missing exit artifact: ${rel}`);
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')); assert.equal(pkg.engines?.node,'>=24');
const doc=fs.readFileSync(path.join(root,'PHASE22.13_SOURCE_SNAPSHOT_EXIT.md'),'utf8');
assert.match(doc,/Functional Phase 22 exit: PASS/); assert.match(doc,/Node v22\.16\.0/); assert.match(doc,/BLOCKED \/ NOT CERTIFIED/); assert.match(doc,/No duplicate authority/);
for (const [phase,script] of [['22.9','phase0/phase22.9-adversarial-idempotency-regression.mjs'],['22.10','phase0/phase22.10-cumulative-phase22-gate.mjs'],['22.11','phase0/phase22.11-node24-verification.mjs']]) { const r=spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8'}); assert.equal(r.status,0,`${phase} failed\n${r.stdout}\n${r.stderr}`); console.log(`PASS ${phase} exit regression`); }
const r=spawnSync(process.execPath,['phase0/phase22.12-hashes-documentation-regression.mjs'],{cwd:root,encoding:'utf8'}); assert.equal(r.status,0,`22.12 failed\n${r.stdout}\n${r.stderr}`); console.log('PASS 22.12 hash/documentation regression');
console.log('PHASE 22.13 SOURCE SNAPSHOT / EXIT: PASS'); console.log('Functional Phase 22 exit: PASS'); console.log('Node >=24 release certification: BLOCKED (actual runtime is Node 22.x)');
