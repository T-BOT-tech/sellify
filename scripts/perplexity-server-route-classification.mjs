#!/usr/bin/env node
/**
 * Heuristic classification of the static route inventory.
 * Classifications are review hints, not evidence of canonical ownership.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const inputPath = path.join(repoRoot, 'docs', 'perplexity-audit', 'generated', 'server-route-inventory.json');
const outputDir = path.join(repoRoot, 'docs', 'perplexity-audit', 'generated');
const inventory = JSON.parse(await readFile(inputPath, 'utf8'));

const domainRules = [
  { module: 'auth', patterns: ['/auth/', '/authorization/', '/pairing', '/pair', '/invites', '/accept-invite', '/migrate-legacy'] },
  { module: 'payments', patterns: ['/payments', '/payment', '/checkout', '/refund', '/settlement'] },
  { module: 'procurement', patterns: ['/procurement', '/rfq', '/quotes', '/purchase-orders', '/receivables', '/invoices', '/credit-terms'] },
  { module: 'suppliers', patterns: ['/suppliers', '/supplier-network', '/supplier'] },
  { module: 'inventory', patterns: ['/inventory', '/stock', '/movements'] },
  { module: 'warehouse', patterns: ['/warehouse', '/locations', '/bins', '/receiving'] },
  { module: 'logistics', patterns: ['/logistics', '/deliveries', '/delivery', '/couriers', '/shipments', '/scheduling'] },
  { module: 'discovery', patterns: ['/discovery', '/search', '/matching', '/opportunities'] },
  { module: 'marketplace', patterns: ['/api/marketplace', '/marketplace'] },
  { module: 'telegram', patterns: ['/telegram', '/telegram-storefront', '/telegram-buyer'] },
  { module: 'catalog', patterns: ['/catalog'] },
  { module: 'sync', patterns: ['/sync', '/events'] },
  { module: 'admin', patterns: ['/admin', '/audit', '/compliance', '/config'] },
];

function classify(routePath) {
  const normalized = String(routePath || '').toLowerCase();
  // Tenant-scoped APIs place the domain after /tenants/:tenantId. Remove
  // only that scope prefix before checking specific domain route segments.
  const scopedPath = normalized.replace(/^\/tenants\/[^/]+(?=\/|$)/, '') || normalized;
  for (const rule of domainRules) {
    if (rule.patterns.some(pattern => scopedPath.startsWith(pattern) || scopedPath.includes(pattern))) {
      return rule.module;
    }
  }
  if (normalized === '/tenants' || normalized === '/tenants/:param' || /^\/(?:memberships|packs|devices|invites)(?:\/|$)/.test(scopedPath)) {
    return 'tenants';
  }
  return 'unknown';
}

const classified = inventory.routes.map(route => ({
  ...route,
  proposedModule: classify(route.path)
}));
const byModule = {};
for (const route of classified) {
  byModule[route.proposedModule] ||= [];
  byModule[route.proposedModule].push(route);
}

const duplicates = [];
const routeKeys = new Map();
for (const route of classified) {
  const key = `${route.method} ${route.routePattern || route.path}`;
  if (routeKeys.has(key)) duplicates.push({ key, firstLine: routeKeys.get(key), duplicateLine: route.line });
  else routeKeys.set(key, route.line);
}

const extractionOrder = [
  'auth', 'tenants', 'catalog', 'sync', 'marketplace', 'telegram',
  'discovery', 'suppliers', 'procurement', 'inventory', 'warehouse',
  'logistics', 'payments', 'admin', 'unknown'
];
const modules = extractionOrder.filter(module => byModule[module]?.length).map((module, index) => ({
  order: index + 1,
  module,
  routeCount: byModule[module].length,
  targetFile: `backend/lib/routes/${module}.js`,
  routes: byModule[module]
}));

const classification = {
  generatedAt: new Date().toISOString(),
  sourceInventory: 'docs/perplexity-audit/generated/server-route-inventory.json',
  routeCount: classified.length,
  moduleCount: modules.length,
  duplicateCount: duplicates.length,
  duplicates,
  modules,
  notes: [
    'Path-based heuristics only; tenant scope is stripped before domain matching.',
    'Unknown routes require manual review.',
    'A proposed module is not a canonical-authority decision or extraction approval.'
  ]
};
const refactorPlan = {
  generatedAt: new Date().toISOString(),
  strategy: 'Review and extract one behaviorally characterized route group at a time.',
  prerequisites: [
    'Verify inventory coverage against the ROUTES array and inline handlers.',
    'Inspect each handler, middleware, authorization, side effects, and error behavior.',
    'Review unknown and overlapping classifications manually.',
    'Run HTTP, authorization, tenant-isolation, and adversarial regression gates after every extraction.'
  ],
  extractionSlices: modules.map(module => ({
    order: module.order,
    module: module.module,
    targetFile: module.targetFile,
    routeCount: module.routeCount,
    risk: ['payments', 'logistics', 'auth'].includes(module.module) ? 'high' : 'medium',
    requiredChecks: [
      'Existing route contract regression',
      'Authorization and role matrix regression',
      'Tenant and organization isolation regression',
      'Location scope regression where applicable',
      'Adversarial API boundary regression'
    ]
  })),
  nonGoals: [
    'No API contract changes.',
    'No database schema changes.',
    'No new canonical authority.',
    'No extraction of payment, inventory, fulfillment, or scheduling logic in the first slice.',
    'No deletion or renaming of existing tests or npm scripts.'
  ]
};

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, 'server-route-classification.json'), `${JSON.stringify(classification, null, 2)}\n`);
await writeFile(path.join(outputDir, 'server-refactor-plan.json'), `${JSON.stringify(refactorPlan, null, 2)}\n`);

const classificationMarkdown = [
  '# Server route classification',
  '',
  `Generated: ${classification.generatedAt}`,
  '',
  `Routes classified: ${classification.routeCount}`,
  '',
  `Proposed modules: ${classification.moduleCount}`,
  '',
  `Duplicate route keys: ${classification.duplicateCount}`,
  '',
  '> Heuristic grouping for review only; it does not prove canonical ownership.',
  '',
  '| Order | Module | Routes | Target file |',
  '|---:|---|---:|---|',
  ...modules.map(module => `| ${module.order} | \`${module.module}\` | ${module.routeCount} | \`${module.targetFile}\` |`),
  '',
  '## Duplicate route keys',
  '',
  duplicates.length ? '| Key | First line | Duplicate line |\n|---|---:|---:|\n' + duplicates.map(item => `| \`${item.key}\` | ${item.firstLine} | ${item.duplicateLine} |`).join('\n') : 'None detected.',
  ''
].join('\n');
const planMarkdown = [
  '# Server refactor plan',
  '',
  `Generated: ${refactorPlan.generatedAt}`,
  '',
  refactorPlan.strategy,
  '',
  '## Extraction slices',
  '',
  '| Order | Module | Routes | Target file | Risk |',
  '|---:|---|---:|---|---|',
  ...refactorPlan.extractionSlices.map(slice => `| ${slice.order} | \`${slice.module}\` | ${slice.routeCount} | \`${slice.targetFile}\` | ${slice.risk} |`),
  '',
  '## Prerequisites',
  '',
  ...refactorPlan.prerequisites.map(item => `- ${item}`),
  '',
  '## Non-goals',
  '',
  ...refactorPlan.nonGoals.map(item => `- ${item}`),
  ''
].join('\n');
await writeFile(path.join(outputDir, 'server-route-classification.md'), classificationMarkdown);
await writeFile(path.join(outputDir, 'server-refactor-plan.md'), planMarkdown);
console.log(`Classified ${classified.length} routes into ${modules.length} proposed modules; ${duplicates.length} duplicate route keys.`);
