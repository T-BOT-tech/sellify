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
const html = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
assert.match(tenantSource, /getOfferingTemplates/);
assert.match(tenantSource, /getOfferingTemplate/);
assert.match(tenantSource, /\.\.\.\(category \? \{ category \} : \{\}\)/);
assert.match(tenantSource, /\.\.\.\(unit \? \{ unit \} : \{\}\)/);
assert.match(tenantSource, /item_type: itemType/);
assert.match(tenantSource, /itemType === 'product' && stock !== undefined/);
assert.match(html, /onboardingOfferingTemplate/);
assert.match(html, /onboardingProdCategory/);
assert.match(html, /onboardingProdUnit/);
assert.match(tenantSource, /does not itself create a booking|does not itself create a reservation|catalog entry does not itself create a booking/);
console.log('Reusable offering starter-template regression passed.');
