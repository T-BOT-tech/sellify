#!/usr/bin/env node
/**
 * Perplexity audit regression gate.
 *
 * Validates basic coverage and internal consistency of the static ROUTES-table
 * inventory. It does not prove runtime route completeness or classification correctness.
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

await runScript(path.join(repoRoot, 'scripts', 'perplexity-server-route-inventory.mjs'));
await runScript(path.join(repoRoot, 'scripts', 'perplexity-server-route-classification.mjs'));

const inventory = JSON.parse(
  await readFile(path.join(generatedDir, 'server-route-inventory.json'), 'utf8')
);
const classification = JSON.parse(
  await readFile(path.join(generatedDir, 'server-route-classification.json'), 'utf8')
);
const refactorPlan = JSON.parse(
  await readFile(path.join(generatedDir, 'server-refactor-plan.json'), 'utf8')
);

if (!Array.isArray(inventory.routes) || inventory.routes.length === 0) {
  throw new Error('Route inventory did not detect any routes.');
}

// backend/server.js currently declares its API surface in a central ROUTES
// array. A tiny count means the parser missed that source of truth (as the
// previous two-route scanner did). Revisit this floor only after reviewing
// an intentional router architecture change.
if (!Number.isInteger(inventory.routeTableCount) || inventory.routeTableCount < 200) {
  throw new Error(`Expected at least 200 explicit ROUTES-table entries; detected ${inventory.routeTableCount}.`);
}
if (inventory.routes.some(route => !route.method || !route.path || !route.sourceKind)) {
  throw new Error('Route inventory contains an incomplete route record.');
}
if (inventory.routes.some(route => route.sourceKind === 'ROUTES table' && !route.routePattern)) {
  throw new Error('ROUTES-table entry is missing its original regex pattern.');
}

if (inventory.routeCount !== inventory.routes.length) {
  throw new Error('Route inventory count does not match detected routes.');
}

if (classification.routeCount !== inventory.routeCount) {
  throw new Error('Route classification count does not match route inventory count.');
}

const unknownRoutes = classification.modules
  .find(module => module.module === 'unknown')?.routes ?? [];

if (unknownRoutes.length > 0) {
  const examples = unknownRoutes
    .slice(0, 10)
    .map(route => `${route.method} ${route.path} (line ${route.line})`)
    .join(', ');
  console.warn(
    `Review required: ${unknownRoutes.length} routes are not yet classified. Examples: ${examples}`
  );
}

if (classification.duplicateCount > 0) {
  const examples = classification.duplicates
    .slice(0, 10)
    .map(duplicate => `${duplicate.key} at lines ${duplicate.firstLine} and ${duplicate.duplicateLine}`)
    .join(', ');
  throw new Error(
    `${classification.duplicateCount} duplicate route keys detected. Examples: ${examples}`
  );
}

if (!Array.isArray(refactorPlan.extractionSlices) || refactorPlan.extractionSlices.length === 0) {
  throw new Error('Refactor plan did not produce any extraction slices.');
}

const moduleSummary = classification.modules
  .map(module => `${module.module}: ${module.routeCount}`)
  .join(', ');

console.log(`Route inventory gate passed: ${inventory.routeCount} routes (${inventory.routeTableCount} ROUTES-table entries).`);
console.log(`Proposed modules: ${moduleSummary}.`);
console.log(`Unclassified routes: ${unknownRoutes.length}.`);
console.log(`Duplicate route keys: ${classification.duplicateCount}.`);
