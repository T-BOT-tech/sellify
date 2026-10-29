import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const queue = readFileSync(new URL('../app/src/orders/queue.js', import.meta.url), 'utf8');
const start = queue.indexOf('export function renderDailySummary()');
const end = queue.indexOf('export function renderQueue()', start);
assert.ok(start >= 0 && end > start, 'daily order summary should exist');
const summary = queue.slice(start, end);
assert.match(summary, /t\('orderValue'\)/, 'queue totals should be labeled as order value');
assert.doesNotMatch(summary, /t\('todaySales'\)/, 'order totals must not be presented as confirmed sales');
assert.match(summary, /orderValueTotal\s*=\s*todaysOrders\.reduce/, 'summary should explicitly calculate order value');
assert.match(summary, /avgOrderValue\s*=\s*totalOrdersCount/, 'average metric should remain average order value');

for (const locale of ['en', 'am', 'om', 'so', 'sw', 'es', 'hi']) {
  const source = readFileSync(new URL(`../app/src/i18n/locales/${locale}.js`, import.meta.url), 'utf8');
  assert.match(source, /orderValue\s*:/, `locale ${locale} should define the order value label`);
}
console.log('Order queue order-value labeling regression: PASS');
