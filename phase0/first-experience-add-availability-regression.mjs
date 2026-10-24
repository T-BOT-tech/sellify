import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyRolePermissions } from '../app/src/auth/permissions.js';

const html = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
const permissionsSource = await readFile(new URL('../app/src/auth/permissions.js', import.meta.url), 'utf8');
const actionMarkup = html.slice(html.indexOf('<div class="modal-backdrop" id="addSheet"'), html.indexOf('</div>\n\n<div class="modal-backdrop" id="onboardingModal"'));
assert.match(actionMarkup, /data-add-permission="orders:create"/, 'take-order requires order creation permission');
assert.match(actionMarkup, /data-add-permission="inventory:add"/, 'add-product requires inventory-add permission');
assert.equal((actionMarkup.match(/data-add-permission="settings:configure"/g) || []).length, 3,
  'pack, channel, and business setup actions require settings configuration permission');
assert.match(actionMarkup, /onclick="switchTab\('marketplace'\); closeAddSheet\(\);"/,
  'marketplace discovery remains available as a role-independent action');
assert.match(permissionsSource, /document\.querySelectorAll\('\[data-add-permission\]'\)/,
  'the canonical role-permission renderer must apply Add (+) visibility');

const makeButton = permission => ({
  dataset: { addPermission: permission },
  hidden: false,
  attributes: {},
  setAttribute(name, value) { this.attributes[name] = value; },
});
const actions = [
  makeButton('orders:create'),
  makeButton('inventory:add'),
  makeButton('settings:configure'),
  makeButton('settings:configure'),
  makeButton('settings:configure'),
];
const catalogForm = { style: {} };
const summary = { style: {} };
const syncUrlInput = { disabled: false };
const gearButton = { style: {} };
const badgeButton = { innerHTML: '' };
globalThis.document = {
  getElementById(id) {
    return ({
      staffBadgeBtn: badgeButton,
      dailySummaryContainer: summary,
      setSyncUrl: syncUrlInput,
      gearSettingsBtn: gearButton,
    })[id] || null;
  },
  querySelector(selector) { return selector === '.catalog-form-wrap' ? catalogForm : null; },
  querySelectorAll(selector) { return selector === '[data-add-permission]' ? actions : []; },
};

applyRolePermissions('cashier');
assert.deepEqual(actions.map(button => button.hidden), [false, true, true, true, true],
  'cashiers can take orders but do not see catalog-add or settings actions');
assert.deepEqual(actions.map(button => button.attributes['aria-hidden']), ['false', 'true', 'true', 'true', 'true']);
applyRolePermissions('owner');
assert.deepEqual(actions.map(button => button.hidden), [false, false, false, false, false],
  'owner actions become visible again after the role changes');
applyRolePermissions('viewer');
assert.deepEqual(actions.map(button => button.hidden), [true, true, true, true, true],
  'viewers see no role-protected Add (+) actions');

delete globalThis.document;
console.log('First-experience Add (+) availability regression: PASS');
