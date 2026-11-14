import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const moduleSource = await readFile(new URL('../app/src/logistics/service-bookings.js', import.meta.url), 'utf8');
const logisticsSource = await readFile(new URL('../app/src/logistics/ui.js', import.meta.url), 'utf8');
const serverSource = await readFile(new URL('../backend/server.js', import.meta.url), 'utf8');
const localeNames = ['en', 'am', 'om', 'so', 'sw', 'es', 'hi', 'fr', 'ar', 'ha', 'yo', 'ru', 'pt'];
const localeSources = await Promise.all(localeNames.map(locale => readFile(new URL('../app/src/i18n/locales/' + locale + '.js', import.meta.url), 'utf8')));

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
const canOperateSource = moduleSource.slice(moduleSource.indexOf('function canOperate'), moduleSource.indexOf('function renderBookingCard'));
assert.ok(canOperateSource.includes("role === 'owner' || role === 'manager'"));
assert.doesNotMatch(canOperateSource, /logistics_manager|logistics_dispatcher/);
assert.match(moduleSource, /if \(!canManageServiceResources\(\) && !hasServiceProviderResourceScope\(\)\) return '';/);
const bookingHandler = serverSource.slice(serverSource.indexOf('async function handleServiceBookings'), serverSource.indexOf('async function handleServiceDeliveryAssessment'));
assert.match(bookingHandler, /service:booking:view/);
assert.match(bookingHandler, /service:booking:request/);
assert.doesNotMatch(bookingHandler, /logistics:scheduling:/);
assert.match(moduleSource, /import \{ t \} from '..\/ui\/i18n\.js'/);
for (const key of ['serviceBookingsTitle', 'serviceBookingsRefresh', 'serviceBookingsDescription', 'serviceBookingsLoading', 'serviceBookingsSignIn', 'serviceBookingsNoOrders', 'serviceBookingsDenied', 'serviceBookingsPartialFailure', 'serviceBookingsEmpty', 'serviceBookingSingular', 'serviceBookingPlural', 'serviceBookingsLoaded', 'serviceBookingReasonPrompt', 'serviceBookingCompletionPrompt', 'serviceBookingUpdateFailed', 'serviceBookingsLoadFailed', 'serviceBookingSelectResource', 'serviceBookingNoEligibleResource', 'serviceBookingResourceRequired', 'serviceBookingAssignedResource', 'serviceBookingResourceUnknown', 'serviceBookingResourceReleased', 'serviceResourceAvailabilityConfigured', 'serviceResourceAvailabilityNotConfigured']) {
  assert.match(moduleSource, new RegExp(key));
  for (const localeSource of localeSources) {
    const occurrences = localeSource.match(new RegExp('\\b' + key + '\\s*:', 'g')) || [];
    assert.equal(occurrences.length, 1, `Expected exactly one ${key} translation per locale`);
  }
}
assert.match(moduleSource, /service-booking-resource-select/);
assert.match(moduleSource, /service_resource_id/);
assert.match(moduleSource, /resource_commitment_state/);
assert.match(moduleSource, /availabilityConfigured/);
assert.match(logisticsSource, /serviceBookingsWorkspaceShell/);
assert.match(logisticsSource, /mountServiceBookingsWorkspace\(list\)/);

console.log('Service booking operator workspace regression passed.');
