#!/usr/bin/env node
/**
 * Best-effort route inventory for Sellify's explicit ROUTES table and
 * separately handled HTTP endpoints in backend/server.js.
 *
 * This is static analysis only. It does not establish authorization,
 * middleware, handler side effects, or complete runtime route behavior.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const serverPath = path.join(repoRoot, 'backend', 'server.js');
const outputDir = path.join(repoRoot, 'docs', 'perplexity-audit', 'generated');
const source = await readFile(serverPath, 'utf8');

const routes = [];
const seen = new Set();

function addRoute(method, routePath, line, sourceKind, routePattern = null, handlerExpression = null, handlerFunction = null) {
  const key = `${method} ${routePattern || routePath}`;
  if (seen.has(key)) return;
  seen.add(key);
  routes.push({ method, path: routePath, line, sourceKind, routePattern, handlerExpression, handlerFunction });
}

// The backend's API routes are declared in a central ROUTES array as
// { method, pattern: /^...$/, handler }. Parse those declarations directly.
const routeEntryPattern = /\{\s*method:\s*['"](GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)['"]\s*,\s*pattern:\s*\/([\s\S]*?)\/\s*,\s*handler:\s*([^}\n]+)\s*\}/g;
for (const match of source.matchAll(routeEntryPattern)) {
  const method = match[1].toUpperCase();
  const routePattern = match[2];
  const handlerExpression = match[3].trim();
  const handlerFunction = handlerExpression.match(/\b(handle[A-Z]\w*)\b/)?.[1] ?? null;
  const routePath = routePattern
    .replace(/\\\//g, '/')
    .replace(/^\^/, '')
    .replace(/\$$/, '')
    .replace(/\(\[\^\/\]\+\)/g, ':param');
  const line = source.slice(0, match.index).split('\n').length;
  addRoute(method, routePath, line, 'ROUTES table', routePattern, handlerExpression, handlerFunction);
}

// A small number of endpoints are handled before the ROUTES table.
const inlineRoutes = [
  { method: 'ANY', path: '/health', pattern: /if\s*\(\s*url\.pathname\s*===\s*(['"])\/health\1\s*\)/g },
  { method: 'GET', path: '/config.js', pattern: /if\s*\(\s*url\.pathname\s*===\s*(['"])\/config\.js\1\s*&&\s*req\.method\s*===\s*(['"])GET\2\s*\)/g },
  { method: 'GET', path: '/backend/lib/*', pattern: /if\s*\(\s*req\.method\s*===\s*(['"])GET\1\s*&&\s*url\.pathname\.startsWith\(\s*(['"])\/backend\/lib\/\2\s*\)\s*\)/g },
  { method: 'GET', path: '/shared/*', pattern: /if\s*\(\s*req\.method\s*===\s*(['"])GET\1\s*&&\s*url\.pathname\.startsWith\(\s*(['"])\/shared\/\2\s*\)\s*\)/g },
  { method: 'GET', path: '/store/:param', pattern: /if\s*\(\s*req\.method\s*===\s*(['"])GET\1\s*&&\s*\/\^\\\/store\\\/\[\^\/\]\+\$\/\.test\(url\.pathname\)\s*\)/g },
  { method: 'GET', path: '/track', pattern: /if\s*\(\s*req\.method\s*===\s*(['"])GET\1\s*&&\s*url\.pathname\s*===\s*(['"])\/track\2\s*\)/g },
];
for (const item of inlineRoutes) {
  for (const match of source.matchAll(item.pattern)) {
    const line = source.slice(0, match.index).split('\n').length;
    addRoute(item.method, item.path, line, 'inline handler', null, null, 'static/inline');
  }
}

routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

const inventory = {
  generatedAt: new Date().toISOString(),
  source: 'backend/server.js',
  routeSource: 'ROUTES array plus explicit inline handlers',
  routeCount: routes.length,
  routeTableCount: routes.filter(route => route.sourceKind === 'ROUTES table').length,
  handlerFunctionCount: new Set(routes.map(route => route.handlerFunction).filter(Boolean)).size,
  inlineHandlerCount: routes.filter(route => route.sourceKind === 'inline handler').length,
  namedHandlerCount: routes.filter(route => route.handlerName).length,
  unresolvedHandlerCount: routes.filter(route => !route.handlerName).length,
  routes,
  notes: [
    'Static, best-effort inventory of the explicit ROUTES table and selected inline handlers.',
    'Regex route patterns are preserved alongside display paths; display paths are not executable route contracts.',
    'This inventory does not capture authorization, middleware, handler side effects, or dynamic runtime behavior.',
    'Review every route and handler before defining extraction boundaries.'
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
  `Detected routes: ${inventory.routeCount} (${inventory.routeTableCount} ROUTES-table entries; ${inventory.inlineHandlerCount} inline handlers)`,
  '',
  '> Static, best-effort inventory. Review original regex patterns, authorization, middleware, side effects, and runtime behavior before extraction.',
  '',
  '| Method | Display path | Handler | Handler form | Source line | Original route pattern |',
  '|---|---|---|---:|---|',
  ...routes.map(route => `| ${route.method} | \`${route.path}\` | ${route.handlerName ? `\`${route.handlerName}\`` : 'unresolved'} | ${route.handlerKind} | ${route.line} | ${route.routePattern ? `\`${route.routePattern}\`` : ''} |`),
  ''
].join('\n');
await writeFile(path.join(outputDir, 'server-route-inventory.md'), markdown);
console.log(`Wrote ${routes.length} detected routes (${inventory.routeTableCount} ROUTES-table entries, ${inventory.handlerFunctionCount} distinct named handler functions, ${inventory.inlineHandlerCount} inline handlers).`);
