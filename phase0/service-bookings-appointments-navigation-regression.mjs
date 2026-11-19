import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const [ui, tabs, html, bookingModule] = await Promise.all([
  read('app/src/logistics/ui.js'),
  read('app/src/ui/tabs.js'),
  read('app/index.html'),
  read('app/src/logistics/service-bookings.js'),
]);

assert.match(ui, /function canOpenAppointmentsWorkspace\(\)/);
assert.match(ui, /service_provider/);
assert.match(ui, /scopeType.*RESOURCE/);
assert.match(ui, /hasServiceOfferings/);
assert.match(ui, /export function renderAppointments\(\)/);
assert.match(ui, /workspace\.innerHTML = serviceBookingsWorkspaceShell\(\)/);
assert.match(ui, /mountServiceBookingsWorkspace\(workspace\)/);
assert.doesNotMatch(ui, /mountServiceBookingsWorkspace\(list\)/,
  'appointments are no longer embedded in the Logistics delivery workspace');

assert.match(tabs, /renderLogistics, renderAppointments/);
assert.match(tabs, /'appointments'/);
assert.match(tabs, /const overflowTabs = \[[^\]]*'appointments'/,
  'the shared More destination must remain active while the Appointments tab is open');
assert.match(tabs, /if \(tab === 'appointments'\) renderAppointments\(\)/);
assert.match(tabs, /navAppointments/,
  'Appointments participates in the shared More navigation visibility manager');

assert.match(html, /id="tab-appointments"/);
assert.match(html, /id="appointmentsWorkspace"/);
assert.match(html, /id="navAppointments"/);
assert.match(html, /switchTab\('appointments'\)/);
assert.match(html, /data-i18n="serviceBookingsTitle"/);

assert.match(bookingModule, /serviceBookingsWorkspaceShell/);
assert.match(bookingModule, /mountServiceBookingsWorkspace/);
assert.match(bookingModule, /service-provider\/bookings/);

console.log('Service booking standalone Appointments navigation regression: PASS');
console.log('Service providers with resource-scoped assignments have a dedicated workspace entry point.');
console.log('Service operators with service catalog offerings can access appointments without enabling Logistics.');
console.log('Booking and provider queue authority remains in the existing service-bookings module.');
