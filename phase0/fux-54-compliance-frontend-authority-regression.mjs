// FUX-54 frontend compliance authority regression.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui = fs.readFileSync('app/src/compliance/ui.js', 'utf8');
const settings = fs.readFileSync('app/src/ui/settings.js', 'utf8');
const html = fs.readFileSync('app/index.html', 'utf8');

assert(ui.includes('/compliance/requests'), 'Compliance UI must use canonical compliance request API');
assert(ui.includes('/compliance/export/'), 'Compliance UI must use canonical export API');
assert(ui.includes('compliance:manage'), 'Compliance UI must enforce the canonical permission vocabulary');
assert(ui.includes('method: \'POST\''), 'Compliance UI must support creating compliance requests');
assert(ui.includes('method: \'PATCH\''), 'Compliance UI must resolve requests through the backend');
assert(!/localStorage.*compliance/i.test(ui), 'Compliance UI must not persist compliance records locally');
assert(settings.includes('renderCompliancePanel'), 'Settings must render the canonical compliance panel');
assert(html.includes('compliancePanel'), 'Settings markup must expose the compliance panel');

console.log('FUX-54 Compliance frontend authority regression: PASS');
