#!/usr/bin/env node
/**
 * Perplexity audit regression gate.
 *
 * Validates that the server route inventory and classification tooling
 * produce a complete, non-conflicting route map before backend extraction.
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

console.log(`Route inventory gate passed: ${inventory.routeCount} routes.`);
console.log(`Proposed modules: ${moduleSummary}.`);
console.log(`Unclassified routes: ${unknownRoutes.length}.`);
console.log(`Duplicate route keys: ${classification.duplicateCount}.`);
