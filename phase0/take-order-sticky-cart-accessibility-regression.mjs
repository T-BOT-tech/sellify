import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
const start = html.indexOf('id="cartStickyBar"');
assert.ok(start >= 0, 'sticky cart bar must exist');
const tagStart = html.lastIndexOf('<div', start);
const tagEnd = html.indexOf('>', start);
const tag = html.slice(tagStart, tagEnd + 1);

assert.match(tag, /role="button"/);
assert.match(tag, /tabindex="0"/);
assert.match(tag, /aria-label="Review order and total"/);
assert.match(tag, /onclick="scrollToOrderSummary\(\)"/);
assert.match(tag, /event\.key==='Enter'\|\|event\.key===' '/);
assert.match(tag, /event\.preventDefault\(\);scrollToOrderSummary\(\)/);
console.log('Take Order sticky cart keyboard accessibility regression: PASS');
