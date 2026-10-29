import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const moduleSource = await readFile(new URL('../app/src/logistics/service-bookings.js', import.meta.url), 'utf8');
const logisticsSource = await readFile(new URL('../app/src/logistics/ui.js', import.meta.url), 'utf8');

assert.match(moduleSource, /\/service-bookings/);
assert.match(moduleSource, /item\\.item_type \\|\\| item\\.type/);
assert.match(moduleSource, /method:\s*'PATCH'/);
assert.match(moduleSource, /'Idempotency-Key'/);
assert.match(moduleSource, /expected_version:\s*Number\(button\.dataset\.version\)/);
assert.match(moduleSource, /response\.ok/);
assert.match(moduleSource, /escapeHtml\(booking\.customer_note\)/);
assert.match(moduleSource, /escapeHtml\(booking\.status_reason\)/);
assert.match(moduleSource, /\['REJECTED', 'FAILED', 'CANCELLED'\]/);
assert.match(moduleSource, /config\.contextualRoles/);
assert.match(moduleSource, /No service bookings yet/);
assert.match(logisticsSource, /serviceBookingsWorkspaceShell/);
assert.match(logisticsSource, /mountServiceBookingsWorkspace\(list\)/);

console.log('Service booking operator workspace regression passed.');
