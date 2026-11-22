#!/usr/bin/env node
/**
 * Perplexity audit tooling.
 *
 * Read-only inventory of HTTP route declarations in backend/server.js.
 * This script does not modify application source or runtime behavior.
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const serverPath = path.join(repoRoot, 'backend', 'server.js');
const outputDir = path.join(repoRoot, 'docs', 'perplexity-audit', 'generated');

const source = await readFile(serverPath, 'utf8');

const patterns = [
  /\b(?:app|server|router)\.(?:get|post|put|patch|delete|options|head)\s*\(\s*(['"`])([^'"`]+)\1/g,
  /\b(?:if|else\s+if)\s*\([^\n]*req\.method\s*===\s*(['"`])(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\1[^\n]*&&[^\n]*(?:req\.url|pathname)[^\n]*\.startsWith\(\s*(['"`])([^'"`]+)\3/g,
  /\b(?:if|else\s+if)\s*\([^\n]*(?:req\.url|pathname)[^\n]*\.startsWith\(\s*(['"`])([^'"`]+)\1[^\n]*&&[^\n]*req\.method\s*===\s*(['"`])(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\1/g
];

const routes = [];
const seen = new Set();

function addRoute(method, routePath, line) {
  const key = `${method} ${routePath}`;
  if (seen.has(key)) return;
  seen.add(key);
  routes.push({ method, path: routePath, line });
}

for (const match of source.matchAll(patterns[0])) {
  const method = match[0].match(/\.(get|post|put|patch|delete|options|head)\s*\(/i)?.[1];
  if (!method) continue;
  const line = source.slice(0, match.index).split('\n').length;
  addRoute(method.toUpperCase(), match[2], line);
}

for (let i = 1; i < patterns.length; i += 1) {
  for (const match of source.matchAll(patterns[i])) {
    const groups = match.slice(1);
    const method = groups.find(value => /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)$/i.test(value));
    const routePath = groups.find(value => typeof value === 'string' && value.startsWith('/'));
    if (!method || !routePath) continue;
    const line = source.slice(0, match.index).split('\n').length;
    addRoute(method.toUpperCase(), routePath, line);
  }
}

routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

const inventory = {
  generatedAt: new Date().toISOString(),
  source: 'backend/server.js',
  routeCount: routes.length,
  routes,
  notes: [
    'This is a static, best-effort inventory generated from source patterns.',
    'It is intended to guide a behavior-preserving backend refactor.',
    'Every extracted route must be validated against existing HTTP, authorization, tenant-isolation, and adversarial regression gates.'
  ]
};

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, 'server-route-inventory.json'), `${JSON.stringify(inventory, null, 2)}\n`);

const markdown = [
  '# Server route inventory',
  '',
  `Generated: ${inventory.generatedAt}`,
  '',
  `Source: \`${inventory.source}\``,
  '',
  `Detected routes: ${inventory.routeCount}`,
  '',
  '> This is a static, best-effort inventory. Validate every extraction against existing HTTP, authorization, tenant-isolation, and adversarial regression gates.',
  '',
  '| Method | Path | Source line |',
  '|---|---|---:|',
  ...routes.map(route => `| ${route.method} | \`${route.path}\` | ${route.line} |`),
  ''
].join('\n');

await writeFile(path.join(outputDir, 'server-route-inventory.md'), markdown);

console.log(`Wrote ${routes.length} detected routes to ${path.relative(repoRoot, outputDir)}`);
