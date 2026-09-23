import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');

assert.match(html, /class="modal" role="dialog" aria-modal="true"/, 'modal containers must expose dialog semantics');
assert.match(html, /id="pinError" role="alert" aria-live="assertive"/, 'PIN errors must be announced');
assert.match(html, /<label for="pinStaffSelect">Select Staff Profile<\/label>/, 'staff selector must have an associated label');
assert.match(html, /<label for="pinInput">Enter 4-Digit Station PIN<\/label>/, 'PIN input must have an associated label');
assert.match(html, /<label for="customerNameInput">Name<\/label>/, 'customer name input must have an associated label');
assert.match(html, /<label for="customerPhoneInput">Phone<\/label>/, 'customer phone input must have an associated label');
assert.match(html, /<label for="customerEmailInput">Email<\/label>/, 'customer email input must have an associated label');

console.log('FUX-31 accessibility source regression: PASS');
