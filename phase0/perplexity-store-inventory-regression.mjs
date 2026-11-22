#!/usr/bin/env node
/**
 * Perplexity audit regression gate.
 *
 * Validates minimum coverage of exported functions, unique SQL tables, and
 * explicit schema_migrations version guards. This is not an ownership proof.
 *
 * This gate does not modify application source or runtime behavior.
 */

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const generatedDir = path.join(repoRoot, 'docs', 'perplexity-audit', 'generated');

function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: repoRoot,
      stdio: 'inherit'
    });

    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${path.relative(repoRoot, scriptPath)} exited with code ${code}`));
    });
  });
}

await runScript(path.join(repoRoot, 'scripts', 'perplexity-store-inventory.mjs'));

const inventory = JSON.parse(
  await readFile(path.join(generatedDir, 'store-inventory.json'), 'utf8')
);
const refactorPlan = JSON.parse(
  await readFile(path.join(generatedDir, 'store-refactor-plan.json'), 'utf8')
);

if (!Array.isArray(inventory.functions) || inventory.functions.length === 0) {
  throw new Error('Store inventory did not detect any exported functions.');
}

if (inventory.exportedFunctionCount !== inventory.functions.length) {
  throw new Error('Store inventory function count does not match detected functions.');
}

if (!Array.isArray(inventory.tables) || inventory.tables.length === 0) {
  throw new Error('Store inventory did not detect any SQL tables.');
}

if (inventory.tableCount !== inventory.tables.length) {
  throw new Error('Store inventory table count does not match detected tables.');
}
if (new Set(inventory.tables.map(table => table.name)).size !== inventory.tables.length) {
  throw new Error('Store inventory contains duplicate table names.');
}
if (!Number.isInteger(inventory.migrationMarkerCount) || inventory.migrationMarkerCount < 80) {
  throw new Error(`Expected at least 80 explicit migration version guards; detected ${inventory.migrationMarkerCount}.`);
}
const migrationVersions = inventory.migrations.map(item => item.version);
if (new Set(migrationVersions).size !== migrationVersions.length) {
  throw new Error('Store inventory contains duplicate migration versions.');
}
if (migrationVersions.some((version, index) => index > 0 && version <= migrationVersions[index - 1])) {
  throw new Error('Store migration versions are not strictly increasing.');
}

if (!Array.isArray(refactorPlan.extractionSlices) || refactorPlan.extractionSlices.length === 0) {
  throw new Error('Store refactor plan did not produce any extraction slices.');
}

const highRiskSlices = refactorPlan.extractionSlices
  .filter(slice => slice.risk === 'high')
  .map(slice => slice.domain);

const domainSummary = refactorPlan.extractionSlices
  .map(slice => `${slice.domain}: ${slice.functionCount}`)
  .join(', ');

console.log(`Store inventory gate passed: ${inventory.exportedFunctionCount} exported functions.`);
console.log(`Unique tables detected: ${inventory.tableCount} (${inventory.tableDeclarationCount} CREATE TABLE declarations).`);
console.log(`Migration version guards detected: ${inventory.migrationMarkerCount}.`);
console.log(`Proposed domains: ${domainSummary}.`);
console.log(`High-risk domains: ${highRiskSlices.length ? highRiskSlices.join(', ') : 'none'}.`);
