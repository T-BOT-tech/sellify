#!/usr/bin/env node
/**
 * Perplexity audit tooling.
 *
 * Read-only inventory of backend/lib/store-sqlite.js.
 *
 * It identifies exported functions, SQL tables, migration markers, and
 * domain references to guide a behavior-preserving persistence refactor.
 * This script does not modify application source or runtime behavior.
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const storePath = path.join(repoRoot, 'backend', 'lib', 'store-sqlite.js');
const outputDir = path.join(repoRoot, 'docs', 'perplexity-audit', 'generated');

const source = await readFile(storePath, 'utf8');

const exportedFunctions = [];
const exportPattern = /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g;

for (const match of source.matchAll(exportPattern)) {
  const line = source.slice(0, match.index).split('\n').length;
  exportedFunctions.push({ name: match[1], line });
}

const tables = [];
const tablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\"'`]?)([A-Za-z_][\w]*)\1/gi;

for (const match of source.matchAll(tablePattern)) {
  const line = source.slice(0, match.index).split('\n').length;
  tables.push({ name: match[2], line });
}

const migrations = [];
const migrationPattern = /migration\s*[:=]\s*([\w-]+)/gi;

for (const match of source.matchAll(migrationPattern)) {
  const line = source.slice(0, match.index).split('\n').length;
  migrations.push({ identifier: match[1], line });
}

const domainRules = [
  { domain: 'identity', patterns: ['user', 'membership', 'session', 'invite', 'pairing', 'auth'] },
  { domain: 'tenant', patterns: ['tenant', 'organization', 'location'] },
  { domain: 'catalog', patterns: ['catalog', 'product', 'listing'] },
  { domain: 'order', patterns: ['order', 'checkout', 'fulfillment'] },
  { domain: 'inventory', patterns: ['inventory', 'stock', 'movement', 'warehouse', 'bin', 'receiving'] },
  { domain: 'procurement', patterns: ['procurement', 'rfq', 'quote', 'purchase', 'receivable', 'invoice', 'credit'] },
  { domain: 'supplier', patterns: ['supplier', 'capacity', 'qualification', 'commercial', 'trust'] },
  { domain: 'logistics', patterns: ['logistics', 'delivery', 'courier', 'shipment', 'scheduling', 'route'] },
  { domain: 'payment', patterns: ['payment', 'refund', 'settlement', 'reconciliation', 'provider'] },
  { domain: 'marketplace', patterns: ['marketplace', 'seller', 'storefront'] },
  { domain: 'service', patterns: ['service', 'booking', 'appointment', 'resource'] },
  { domain: 'compliance', patterns: ['compliance', 'audit', 'country', 'tax'] },
  { domain: 'event', patterns: ['event', 'outbox', 'replay'] }
];

function classifyFunction(name) {
  const normalized = String(name || '').toLowerCase();
  for (const rule of domainRules) {
    if (rule.patterns.some(pattern => normalized.includes(pattern))) {
      return rule.domain;
    }
  }
  return 'shared';
}

const functions = exportedFunctions
  .map(fn => ({ ...fn, proposedDomain: classifyFunction(fn.name) }))
  .sort((a, b) => a.name.localeCompare(b.name));

const byDomain = {};
for (const fn of functions) {
  byDomain[fn.proposedDomain] ||= [];
  byDomain[fn.proposedDomain].push(fn);
}

const domainOrder = [
  'identity',
  'tenant',
  'catalog',
  'order',
  'inventory',
  'procurement',
  'supplier',
  'logistics',
  'payment',
  'marketplace',
  'service',
  'compliance',
  'event',
  'shared'
];

const domains = domainOrder
  .filter(domain => byDomain[domain]?.length)
  .map((domain, index) => ({
    order: index + 1,
    domain,
    functionCount: byDomain[domain].length,
    functions: byDomain[domain]
  }));

const inventory = {
  generatedAt: new Date().toISOString(),
  source: 'backend/lib/store-sqlite.js',
  exportedFunctionCount: functions.length,
  tableCount: tables.length,
  migrationMarkerCount: migrations.length,
  functions,
  tables,
  migrations,
  notes: [
    'This is a static, best-effort inventory.',
    'It is intended to guide an incremental persistence refactor.',
    'Do not extract a domain until its tables, transactions, foreign keys, and cross-domain invariants are understood.'
  ]
};

const refactorPlan = {
  generatedAt: new Date().toISOString(),
  strategy: 'Extract one bounded persistence domain at a time while preserving SQL behavior, transactions, constraints, indexes, and migration compatibility.',
  prerequisites: [
    'Create a table and foreign-key inventory before extracting any domain.',
    'Identify transaction boundaries and cross-domain invariants.',
    'Run tenant-isolation, authorization, idempotency, replay, and adversarial gates after every extraction.'
  ],
  extractionSlices: domains.map(domain => ({
    order: domain.order,
    domain: domain.domain,
    functionCount: domain.functionCount,
    targetDirectory: `backend/lib/persistence/${domain.domain}/`,
    risk: ['payment', 'inventory', 'order'].includes(domain.domain) ? 'high' : 'medium',
    requiredChecks: [
      'Migration compatibility regression',
      'Tenant and organization isolation regression',
      'Authorization regression',
      'Idempotency and replay regression',
      'Adversarial regression',
      'Domain-specific cumulative gate'
    ]
  })),
  nonGoals: [
    'No database engine migration.',
    'No table renaming or destructive schema change.',
    'No change to SQL semantics or transaction boundaries.',
    'No creation of duplicate canonical authorities.',
    'No extraction of a domain before its dependencies are mapped.'
  ]
};

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, 'store-inventory.json'), `${JSON.stringify(inventory, null, 2)}\n`);
await writeFile(path.join(outputDir, 'store-refactor-plan.json'), `${JSON.stringify(refactorPlan, null, 2)}\n`);

const inventoryMarkdown = [
  '# SQLite store inventory',
  '',
  `Generated: ${inventory.generatedAt}`,',
  '',
  `Source: \`${inventory.source}\``,
  '',
  `Exported functions: ${inventory.exportedFunctionCount}`,',
  '',
  `Tables detected: ${inventory.tableCount}`,',
  '',
  `Migration markers detected: ${inventory.migrationMarkerCount}`,',
  '',
  '## Proposed persistence domains',
  '',
  '| Order | Domain | Functions |',
  '|---:|---|---:|',
  ...domains.map(domain => `| ${domain.order} | \`${domain.domain}\` | ${domain.functionCount} |`),
  '',
  '## Tables',
  '',
  '| Table | Source line |',
  '|---|---:|',
  ...tables.map(table => `| \`${table.name}\` | ${table.line} |`),
  ''
].join('\n');

const planMarkdown = [
  '# SQLite store refactor plan',
  '',
  `Generated: ${refactorPlan.generatedAt}`,',
  '',
  refactorPlan.strategy,
  '',
  '## Extraction slices',
  '',
  '| Order | Domain | Functions | Target directory | Risk |',
  '|---:|---|---:|---|---|',
  ...refactorPlan.extractionSlices.map(slice => `| ${slice.order} | \`${slice.domain}\` | ${slice.functionCount} | \`${slice.targetDirectory}\` | ${slice.risk} |`),
  '',
  '## Required checks per slice',
  '',
  ...refactorPlan.extractionSlices[0]?.requiredChecks.map(check => `- ${check}`),
  '',
  '## Non-goals',
  '',
  ...refactorPlan.nonGoals.map(item => `- ${item}`),
  ''
].join('\n');

await writeFile(path.join(outputDir, 'store-inventory.md'), inventoryMarkdown);
await writeFile(path.join(outputDir, 'store-refactor-plan.md'), planMarkdown);

console.log(`Inventoried ${functions.length} exported functions, ${tables.length} tables, and ${migrations.length} migration markers.`);
console.log(`Proposed ${domains.length} persistence domains.`);
