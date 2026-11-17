import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [authorization, store, server, ui] = await Promise.all([
  readFile(new URL('../backend/lib/authorization.js', import.meta.url), 'utf8'),
  readFile(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8'),
  readFile(new URL('../backend/server.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/logistics/service-bookings.js', import.meta.url), 'utf8'),
]);

const providerPolicy = authorization.slice(
  authorization.indexOf('service_provider: new Set(['),
  authorization.indexOf(']),', authorization.indexOf('service_provider: new Set([')) + 3,
);
assert.match(providerPolicy, /service:service_booking:view/);
assert.match(authorization, /validServiceResourceContext/);
assert.match(authorization, /String\(context\.resourceId\) === item\.scopeId/);
assert.match(authorization, /if \(role === 'service_provider'\) return AUTHZ\.DENY/);

const projectionStart = store.indexOf('export async function listServiceProviderBookings');
const projectionEnd = store.indexOf('export async function listServiceBookings', projectionStart);
assert.ok(projectionStart >= 0 && projectionEnd > projectionStart);
const projection = store.slice(projectionStart, projectionEnd);
assert.match(projection, /service_resource_commitments/);
assert.match(projection, /c\.state = 'COMMITTED'/);
assert.match(projection, /r\.status = 'ACTIVE'/);
assert.match(projection, /b\.status IN \('CONFIRMED','IN_PROGRESS'\)/);
assert.match(projection, /b\.service_resource_id IN/);
assert.doesNotMatch(projection, /SELECT \*/);

const handlerStart = server.indexOf('async function handleServiceProviderBookings');
const handlerEnd = server.indexOf('async function handleServiceBookings', handlerStart);
assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
const handler = server.slice(handlerStart, handlerEnd);
assert.match(handler, /requireSession/);
assert.match(handler, /session\.contextualRoles/);
assert.match(handler, /listServiceResources\(chatId, \{ includeInactive: false \}\)/);
assert.match(handler, /requireAuthorization\(session, tenant, 'service_resource', 'service:service_booking:view'/);
assert.match(handler, /resourceContext:/);
assert.match(handler, /listServiceProviderBookings\(chatId, activeResources\.map/);
assert.doesNotMatch(handler, /readBody|PATCH|POST|transitionServiceBooking/);
const resourceHandlerStart = server.indexOf('async function handleServiceProviderResources');
const resourceHandlerEnd = server.indexOf('async function handleServiceProviderBookings', resourceHandlerStart);
assert.ok(resourceHandlerStart >= 0 && resourceHandlerEnd > resourceHandlerStart);
const resourceHandler = server.slice(resourceHandlerStart, resourceHandlerEnd);
assert.match(resourceHandler, /session\.contextualRoles/);
assert.match(resourceHandler, /resourceContext/);
assert.match(resourceHandler, /getServiceResourceAvailability\(chatId, resource\.id\)/);
assert.ok(server.includes('service-provider' + String.fromCharCode(92) + '/resources'));
assert.match(ui, /service-provider\/resources/);
assert.match(ui, /if \(!workspace \|\| !status \|\| !list \|\| !canAccessServiceResources\(\)\) return/);
assert.match(ui, /hasServiceProviderResourceScope\(resource\.id\)/);
assert.ok(server.includes('service-provider' + String.fromCharCode(92) + '/bookings'));
assert.match(server, /authorize\(session, organization, location, resource, action, resourceContext\)/);

assert.match(ui, /\/service-provider\/bookings/);
assert.match(ui, /serviceProviderAppointmentsTitle/);
assert.match(ui, /escapeHtml\(booking\.customer_note\)/);
assert.match(ui, /serviceBookingsRefresh/);
assert.match(ui, /serviceProviderAppointmentsUnknownStale/);
assert.match(ui, /UNKNOWN_STALE/);
assert.match(ui, /status\.dataset\.state = bookings\.length \? 'READY' : 'EMPTY'/);

console.log('SC-03.5 service provider booking queue source regression passed.');
