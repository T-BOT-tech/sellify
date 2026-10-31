import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getOfferingTemplate, getOfferingTemplates } from '../app/src/catalog/offering-templates.js';

const types = ['product', 'service'];
const businessTemplates = ['retail-shop', 'barbershop', 'hotel-rooms', 'rental', 'consultation', 'repair', 'restaurant', 'wholesale', 'other'];
for (const businessTemplate of businessTemplates) {
  for (const itemType of types) {
    const templates = getOfferingTemplates({ businessTemplate, itemType });
    assert.ok(templates.length > 0, `templates available for ${businessTemplate}/${itemType}`);
    assert.ok(templates.every(item => item.itemType === itemType && item.key && item.label && item.category && item.unit));
    assert.equal(new Set(templates.map(item => item.key)).size, templates.length, 'template keys unique within a suggestion list');
    for (const item of templates) {
      assert.deepEqual(getOfferingTemplate({ businessTemplate, itemType, templateKey: item.key }), item);
    }
  }
}
assert.equal(getOfferingTemplate({ businessTemplate: 'repair', itemType: 'service', templateKey: 'spare-part' }), null, 'product templates cannot be selected as service templates');
assert.equal(getOfferingTemplate({ businessTemplate: 'unknown', itemType: 'product', templateKey: 'general-product' })?.category, 'General', 'unknown business templates safely use generic defaults');
assert.equal(getOfferingTemplates({ businessTemplate: 'repair', itemType: 'service' }).find(item => item.key === 'diagnostics')?.name, 'Diagnostics');
assert.equal(getOfferingTemplates({ businessTemplate: 'repair', itemType: 'product' }).find(item => item.key === 'spare-part')?.unit, 'piece');

const tenantSource = await readFile(new URL('../app/src/auth/tenant.js', import.meta.url), 'utf8');
const mainSource = await readFile(new URL('../app/src/main.js', import.meta.url), 'utf8');
const bridgeSource = await readFile(new URL('../app/src/window-bridge.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
assert.match(tenantSource, /getOfferingTemplates/);
assert.match(tenantSource, /getOfferingTemplate/);
assert.match(tenantSource, /\.\.\.\(category \? \{ category \} : \{\}\)/);
assert.match(tenantSource, /\.\.\.\(unit \? \{ unit \} : \{\}\)/);
assert.match(tenantSource, /item_type: itemType/);
assert.match(tenantSource, /itemType === 'product' && stock !== undefined/);
assert.match(mainSource, /export \{[^}]*applyOnboardingOfferingTemplate[^}]*populateOnboardingOfferingTemplates[^}]*\}/s, 'onboarding offering handlers must be re-exported from main.js');
assert.match(bridgeSource, /applyOnboardingOfferingTemplate, populateOnboardingOfferingTemplates/, 'inline onboarding handlers must be exposed on window');
assert.match(html, /onboardingOfferingTemplate/);
assert.match(html, /onboardingProdCategory/);
assert.match(html, /onboardingProdUnit/);
assert.match(tenantSource, /does not itself create a booking|does not itself create a reservation|catalog entry does not itself create a booking/);


// The onboarding selector belongs to the business currently being created. A
// cached template from an already-selected tenant must not override that
// explicit selection when suggesting or applying the first offering.
assert.match(tenantSource, /String\(document\.getElementById\('onboardingBusinessTemplate'\)\?\.value \|\| config\.businessTemplate \|\| 'other'\)/,
  'the visible onboarding business-template choice must take precedence over stale tenant config');

const populateFunctionSource = tenantSource.match(
  /export function populateOnboardingOfferingTemplates\(\) \{[\s\S]*?\n\}/,
)?.[0];
const applyFunctionSource = tenantSource.match(
  /export function applyOnboardingOfferingTemplate\(templateKey\) \{[\s\S]*?\n\}/,
)?.[0];
assert.ok(populateFunctionSource && applyFunctionSource, 'onboarding offering handlers must be available for behavior tests');
const businessSelector = { value: 'repair' };
const offeringSelector = {
  value: '',
  options: [],
  replaceChildren(...options) { this.options = options; },
};
const nameInput = { value: '', dataset: {} };
const categoryInput = { value: '' };
const unitInput = { value: '' };
const elements = {
  onboardingBusinessTemplate: businessSelector,
  onboardingItemType: { value: 'service' },
  onboardingOfferingTemplate: offeringSelector,
  onboardingProdName: nameInput,
  onboardingProdCategory: categoryInput,
  onboardingProdUnit: unitInput,
};
const offeringHarness = {
  config: { businessTemplate: 'retail-shop' },
  document: { getElementById: id => elements[id] || null },
  getOfferingTemplates,
  getOfferingTemplate,
  Option: class Option { constructor(text, value) { this.text = text; this.value = value; } },
};
const executablePopulate = populateFunctionSource.replace(/^export /, '');
const executableApply = applyFunctionSource.replace(/^export /, '');
const vm = await import('node:vm');
vm.default.runInNewContext(
  executablePopulate + '\n' + executableApply
    + '\nthis.populate = populateOnboardingOfferingTemplates; this.apply = applyOnboardingOfferingTemplate;',
  offeringHarness,
);
const suggestedTemplates = offeringHarness.populate();
assert.ok(suggestedTemplates.some(item => item.key === 'diagnostics'),
  'selected repair business must show repair service suggestions despite stale cached retail-shop config');
assert.equal(offeringHarness.apply('diagnostics')?.category, 'Repair services',
  'applying a starter suggestion must use the selected onboarding business template');
assert.equal(categoryInput.value, 'Repair services');

console.log('Reusable offering starter-template regression passed.');
