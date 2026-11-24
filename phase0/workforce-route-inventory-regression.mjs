import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const inventory = JSON.parse(await readFile(
  new URL('../docs/perplexity-audit/generated/server-route-inventory.json', import.meta.url),
  'utf8',
));
assert.equal(inventory.source, 'backend/server.js');
assert.ok(Number.isInteger(inventory.routeCount) && inventory.routeCount > 0);
assert.equal(inventory.routeCount, inventory.routes.length);

const workforceRoutes = inventory.routes.filter(route =>
  String(route.routePattern || '').includes('workforce'));
assert.equal(workforceRoutes.length, 5, 'all five Workforce route templates must be inventoried exactly once');
assert.deepEqual(
  workforceRoutes.map(route => route.method).sort(),
  ['GET','GET','PATCH','POST','POST'],
);
assert.ok(workforceRoutes.every(route => route.handlerFunction === 'handleWorkforce'));
assert.ok(workforceRoutes.every(route => route.handlerResolution === 'local declaration'));

const uniqueKeys = new Set(inventory.routes.map(route => `${route.method} ${route.routePattern || route.path}`));
assert.equal(uniqueKeys.size, inventory.routes.length, 'route inventory must not contain duplicate route entries');

console.log('PASS Workforce route inventory: five registered route templates, resolved handler, no duplicates');
