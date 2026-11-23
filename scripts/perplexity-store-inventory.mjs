#!/usr/bin/env node
/**
 * Static inventory of exports, CREATE TABLE declarations, and explicit
 * schema_migrations version guards in backend/lib/store-sqlite.js.
 * Domain labels are name-based hints, not persistence ownership evidence.
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
  exportedFunctions.push({ name: match[1], line: source.slice(0, match.index).split('\n').length });
}

const tableDeclarations = [];
const tablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(["'`]?)([A-Za-z_][\w]*)\1/gi;
for (const match of source.matchAll(tablePattern)) {
  tableDeclarations.push({ name: match[2], line: source.slice(0, match.index).split('\n').length });
}
const tableMap = new Map();
for (const declaration of tableDeclarations) {
  const current = tableMap.get(declaration.name) || { name: declaration.name, line: declaration.line, declarationCount: 0, declarationLines: [] };
  current.declarationCount += 1;
  current.declarationLines.push(declaration.line);
  tableMap.set(declaration.name, current);
}
const tables = [...tableMap.values()].sort((a, b) => a.name.localeCompare(b.name));

// Current store migration implementation gates each numbered migration with
// if (!applied.includes(N)); the old migration[:=] scanner missed all of them.
const migrations = [];
const migrationPattern = /!applied\.includes\(\s*(\d+)\s*\)/g;
for (const match of source.matchAll(migrationPattern)) {
  migrations.push({ version: Number(match[1]), line: source.slice(0, match.index).split('\n').length });
}
migrations.sort((a, b) => a.version - b.version);

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
  return domainRules.find(rule => rule.patterns.some(pattern => normalized.includes(pattern)))?.domain || 'shared';
}
const functions = exportedFunctions.map(fn => ({ ...fn, proposedDomain: classifyFunction(fn.name) })).sort((a, b) => a.name.localeCompare(b.name));
const byDomain = {};
for (const fn of functions) (byDomain[fn.proposedDomain] ||= []).push(fn);
const domainOrder = ['identity','tenant','catalog','order','inventory','procurement','supplier','logistics','payment','marketplace','service','compliance','event','shared'];
const domains = domainOrder.filter(domain => byDomain[domain]?.length).map((domain, index) => ({
  order: index + 1, domain, functionCount: byDomain[domain].length, functions: byDomain[domain]
}));

const inventory = {
  generatedAt: new Date().toISOString(),
  source: 'backend/lib/store-sqlite.js',
  exportedFunctionCount: functions.length,
  tableCount: tables.length,
  tableDeclarationCount: tableDeclarations.length,
  migrationMarkerCount: migrations.length,
  functions, tables, migrations,
  notes: [
    'Static, best-effort source inventory; exported function names do not establish ownership.',
    'Table declarations are deduplicated by name; repeated declarations remain visible through declarationCount and declarationLines.',
    'Migration versions are extracted from explicit applied.includes(N) guards.',
    'Call graphs, foreign keys, transaction boundaries, SQL ownership, and cross-domain invariants require separate analysis.'
  ]
};

const refactorPlan = {
  generatedAt: new Date().toISOString(),
  strategy: 'Map table ownership, foreign keys, transactions, migrations, and cross-domain invariants before considering one bounded persistence extraction.',
  prerequisites: [
    'Review all tables and their foreign-key relationships.',
    'Identify transaction boundaries and cross-domain invariants.',
    'Map exported function call sites and SQL read/write ownership.',
    'Run tenant-isolation, authorization, idempotency, replay, and adversarial gates after every extraction.'
  ],
  extractionSlices: domains.map(domain => ({
    order: domain.order, domain: domain.domain, functionCount: domain.functionCount,
    targetDirectory: `backend/lib/persistence/${domain.domain}/`,
    risk: ['payment','inventory','order'].includes(domain.domain) ? 'high' : 'medium',
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
  '# SQLite store inventory', '',
  `Generated: ${inventory.generatedAt}`, '',
  `Source: \`${inventory.source}\``, '',
  `Exported functions: ${inventory.exportedFunctionCount}`, '',
  `Unique tables: ${inventory.tableCount}`, '',
  `CREATE TABLE declarations: ${inventory.tableDeclarationCount}`, '',
  `Migration version guards: ${inventory.migrationMarkerCount}`, '',
  '## Proposed persistence domains', '',
  '| Order | Domain | Functions |', '|---:|---|---:|',
  ...domains.map(domain => `| ${domain.order} | \`${domain.domain}\` | ${domain.functionCount} |`),
  '', '## Tables', '', '| Table | Declarations | Source lines |', '|---|---:|---|',
  ...tables.map(table => `| \`${table.name}\` | ${table.declarationCount} | ${table.declarationLines.join(', ')} |`),
  '', '## Migration versions', '',
  migrations.map(migration => `- ${migration.version} (line ${migration.line})`).join('\n'),
  ''
].join('\n');
const planMarkdown = [
  '# SQLite store refactor plan', '',
  `Generated: ${refactorPlan.generatedAt}`, '',
  refactorPlan.strategy, '',
  '## Extraction slices', '',
  '| Order | Domain | Functions | Target directory | Risk |', '|---:|---|---:|---|---|',
  ...refactorPlan.extractionSlices.map(slice => `| ${slice.order} | \`${slice.domain}\` | ${slice.functionCount} | \`${slice.targetDirectory}\` | ${slice.risk} |`),
  '', '## Prerequisites', '', ...refactorPlan.prerequisites.map(item => `- ${item}`),
  '', '## Non-goals', '', ...refactorPlan.nonGoals.map(item => `- ${item}`), ''
].join('\n');
await writeFile(path.join(outputDir, 'store-inventory.md'), inventoryMarkdown);
await writeFile(path.join(outputDir, 'store-refactor-plan.md'), planMarkdown);
console.log(`Inventoried ${functions.length} exported functions, ${tables.length} unique tables (${tableDeclarations.length} declarations), and ${migrations.length} migration version guards.`);
console.log(`Proposed ${domains.length} persistence domains.`);
