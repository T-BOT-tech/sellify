import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getWorkspaceActivationAction } from '../app/src/experience/workspace.js';

const source = await readFile(new URL('../app/src/experience/workspace.js', import.meta.url), 'utf8');

assert.equal(
  getWorkspaceActivationAction({ offeringCount: 2, canAddOffering: true }),
  'TAKE_ORDER',
  'a workspace with existing offerings can lead with taking an order',
);
assert.equal(
  getWorkspaceActivationAction({ offeringCount: 0, canAddOffering: true }),
  'SET_UP_CATALOG',
  'an empty workspace with catalog permission must guide the operator to set up the catalog first',
);
assert.equal(
  getWorkspaceActivationAction({ offeringCount: 0, canAddOffering: false }),
  'CATALOG_SETUP_REQUIRED',
  'an operator without catalog permission must receive an owner/manager handoff instead of a blocked add action',
);

assert.match(source, /canAddOffering: hasPermission\(currentRole\(\), 'inventory:add'\)/,
  'catalog setup availability must use the existing role-permission authority');
assert.match(source, /switchTab\('catalog'\); requestAnimationFrame\(\(\) => document\.getElementById\('newProdName'\)\?\.focus\(\)\)/,
  'the setup action must open the existing catalog and focus its existing item-name field');
assert.match(source, /Add your first product or service before taking an order/,
  'the first-sale prerequisite must be explicit');
assert.match(source, /Ask a business owner or manager to add the first product or service/,
  'users without catalog permission must receive a clear handoff');
assert.match(source, /<strong>\$\{products\.length\} offerings<\/strong>|\$\{products\.length\} offerings/,
  'catalog copy must count products and services as offerings');

console.log('First-workspace catalog activation regression: PASS');
