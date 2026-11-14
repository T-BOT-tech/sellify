// Operator-facing projection for canonical service bookings.
// The backend remains authoritative for scope, permissions, lifecycle, and persistence.
import { config, orders, products, organizationLocations } from '../state.js';
import { authHeaders } from '../auth/tenant.js';
import { escapeHtml, escapeAttr } from '../utils/index.js';
import { t } from '../ui/i18n.js';
import { assessServiceResourceDeclaredWindow, serviceLocalDateTimeToIso } from '../verticals/services/service-window-assessment-contract.js';

let mountedServiceBookingsWorkspace = null;
let mountedServiceBookingsTenant = null;
const serviceBookingsHandlerRoots = new WeakSet();

const NEXT = Object.freeze({
  REQUESTED: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED'],
  IN_PROGRESS: ['COMPLETED', 'FAILED'],
});

function apiBase() {
  return String(config.syncUrl || window.location.origin).replace(/\/$/, '');
}

function serviceOrders() {
  const serviceIds = new Set((Array.isArray(products) ? products : [])
    .filter(p => String(p.item_type || p.type || '').toLowerCase() === 'service')
    .map(p => String(p.id)));
  return (Array.isArray(orders) ? orders : [])
    .filter(o => o.server_order_id && Array.isArray(o.items)
      && o.items.some(item => String(item.item_type || item.type || '').toLowerCase() === 'service'
        || serviceIds.has(String(item.item_id || item.id || item.product_id || item.productId || ''))))
    .slice(-40);
}

async function requestBookings(order, context) {
  const url = context.baseUrl + '/tenants/' + encodeURIComponent(context.tenantId)
    + '/orders/' + encodeURIComponent(order.server_order_id) + '/service-bookings';
  const response = await fetch(url, { headers: context.headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || t('serviceBookingsLoadFailed'));
    error.status = response.status;
    throw error;
  }
  return Array.isArray(data.bookings) ? data.bookings : [];
}

function canOperate() {
  const roles = Array.isArray(config.contextualRoles) ? config.contextualRoles : [];
  const roleNames = roles.map(r => String(r?.role || '').toLowerCase());
  return ['owner', 'manager'].includes(String(config.currentStaffRole || config.authRole || config.tenantRole || '').toLowerCase())
    || roleNames.some(r => ['logistics_manager', 'logistics_dispatcher'].includes(r));
}

function renderBookingCard(order, booking) {
  const status = String(booking.status || 'REQUESTED').toUpperCase();
  const transitions = NEXT[status] || [];
  const mode = String(booking.appointment_mode || '').replaceAll('_', ' ').toLowerCase();
  const date = value => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value || '—') : parsed.toLocaleString();
  };
  const actions = canOperate() ? transitions.map(target =>
    '<button type="button" class="btn-secondary service-booking-action" data-order-id="' + escapeAttr(order.server_order_id)
    + '" data-booking-id="' + escapeAttr(booking.id) + '" data-version="' + escapeAttr(booking.version)
    + '" data-target="' + escapeAttr(target) + '">' + escapeHtml(target.replaceAll('_', ' ')) + '</button>'
  ).join('') : '';
  return '<article class="logistics-card service-booking-card">'
    + '<div class="logistics-top"><strong>' + escapeHtml(booking.service_item_id || 'Service')
    + '</strong><span class="logistics-status">' + escapeHtml(status.replaceAll('_', ' ')) + '</span></div>'
    + '<div class="logistics-meta">Order ' + escapeHtml(order.server_order_id) + ' · ' + escapeHtml(mode || 'appointment')
    + ' · v' + escapeHtml(booking.version) + '</div>'
    + '<div class="logistics-meta">' + escapeHtml(date(booking.requested_start)) + ' – ' + escapeHtml(date(booking.requested_end)) + '</div>'
    + (booking.customer_note ? '<div class="logistics-meta">' + escapeHtml(booking.customer_note) + '</div>' : '')
    + (booking.status_reason ? '<div class="logistics-meta">Reason: ' + escapeHtml(booking.status_reason) + '</div>' : '')
    + (booking.completion_note ? '<div class="logistics-meta">Completion: ' + escapeHtml(booking.completion_note) + '</div>' : '')
    + (actions ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">' + actions + '</div>' : '')
    + '</article>';
}


function canManageServiceResources() {
  const role = String(config.currentStaffRole || config.authRole || config.tenantRole || '').toLowerCase();
  return role === 'owner' || role === 'manager';
}

function hasServiceProviderResourceScope(resourceId = null) {
  const roles = Array.isArray(config.contextualRoles) ? config.contextualRoles : [];
  return roles.some(item => String(item?.role || '').toLowerCase() === 'service_provider'
    && String(item?.scopeType || '').toUpperCase() === 'RESOURCE'
    && (!resourceId || String(item?.scopeId || '') === String(resourceId)));
}

function canAccessServiceResources() {
  return canManageServiceResources() || hasServiceProviderResourceScope();
}

function serviceResourceEndpoint() {
  return apiBase() + '/tenants/' + encodeURIComponent(config.chatId) + '/service-resources';
}

function serviceResourceCatalogOptions() {
  return '<option value="">' + escapeHtml(t('serviceResourceAllServices')) + '</option>' + (Array.isArray(products) ? products : [])
    .filter(item => String(item.item_type || item.type || '').toLowerCase() === 'service')
    .map(item => '<option value="' + escapeAttr(item.id) + '">' + escapeHtml(item.name || item.title || item.id) + '</option>')
    .join('');
}

function serviceResourceLocationOptions() {
  return '<option value="">' + escapeHtml(t('serviceResourceOrganizationWide')) + '</option>' + (Array.isArray(organizationLocations) ? organizationLocations : [])
    .filter(location => String(location.status || '').toLowerCase() === 'active')
    .map(location => '<option value="' + escapeAttr(location.id) + '">' + escapeHtml(location.name || location.code || location.id) + '</option>')
    .join('');
}

function serviceResourceTypeLabel(type) {
  const labels = {
    PROVIDER: 'serviceResourceTypeProvider',
    FACILITY: 'serviceResourceTypeFacility',
    EQUIPMENT: 'serviceResourceTypeEquipment',
    OTHER: 'serviceResourceTypeOther',
  };
  return t(labels[String(type || '').toUpperCase()] || 'serviceResourceTypeOther');
}

function serviceResourceCard(resource) {
  const active = String(resource.status).toUpperCase() === 'ACTIVE';
  const manager = canManageServiceResources();
  const providerScope = hasServiceProviderResourceScope(resource.id);
  const actions = [];
  if (manager) {
    actions.push('<button type="button" class="btn-secondary service-resource-rename" data-resource-id="' + escapeAttr(resource.id) + '" data-version="' + escapeAttr(resource.version) + '">' + escapeHtml(t('serviceResourceRename')) + '</button>');
    actions.push('<button type="button" class="btn-secondary service-resource-providers" data-resource-id="' + escapeAttr(resource.id) + '">' + escapeHtml(t('serviceResourceManageProviders')) + '</button>');
    actions.push('<button type="button" class="btn-secondary service-resource-toggle" data-resource-id="' + escapeAttr(resource.id) + '" data-version="' + escapeAttr(resource.version) + '" data-status="' + (active ? 'INACTIVE' : 'ACTIVE') + '">' + escapeHtml(active ? t('serviceResourceDeactivate') : t('serviceResourceActivate')) + '</button>');
  }
  if (manager || providerScope) {
    actions.push('<button type="button" class="btn-secondary service-resource-availability" data-resource-id="' + escapeAttr(resource.id) + '">' + escapeHtml(t('serviceAvailabilityConfigure')) + '</button>');
  }
  return '<article class="logistics-card service-resource-card" data-resource-id="' + escapeAttr(resource.id) + '">'
    + '<div class="logistics-top"><strong>' + escapeHtml(resource.name) + '</strong>'
    + '<span class="logistics-status">' + escapeHtml(resource.status) + '</span></div>'
    + '<div class="logistics-meta">' + escapeHtml(serviceResourceTypeLabel(resource.resourceType))
    + (resource.serviceItemId ? ' · ' + escapeHtml(resource.serviceItemId) : ' · ' + escapeHtml(t('serviceResourceAllServices')))
    + (resource.locationId ? ' · ' + escapeHtml(resource.locationId) : ' · ' + escapeHtml(t('serviceResourceOrganizationWide'))) + ' · v' + escapeHtml(resource.version) + '</div>'
    + (resource.description ? '<div class="logistics-meta">' + escapeHtml(resource.description) + '</div>' : '')
    + (actions.length ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">' + actions.join('') + '</div>' : '')
    + '</article>';
}

async function refreshServiceResources(root = document) {
  const workspace = root.querySelector('#serviceBookingsWorkspace');
  const status = workspace?.querySelector('#serviceResourcesStatus');
  const list = workspace?.querySelector('#serviceResourcesList');
  if (!workspace || !status || !list || !canAccessServiceResources()) return;
  if (!config.chatId || !config.sessionToken) {
    status.textContent = t('serviceBookingsSignIn');
    list.replaceChildren();
    return;
  }
  const sequence = Number(workspace.dataset.resourceRefreshSequence || 0) + 1;
  workspace.dataset.resourceRefreshSequence = String(sequence);
  const tenantId = String(config.chatId), sessionToken = String(config.sessionToken);
  status.textContent = t('serviceResourceLoading');
  list.replaceChildren();
  try {
    const response = await fetch(serviceResourceEndpoint() + '?include_inactive=true', { headers: authHeaders() });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error?.message || t('serviceResourceLoadFailed'));
      error.status = response.status;
      throw error;
    }
    if (workspace.isConnected === false || workspace.dataset.resourceRefreshSequence !== String(sequence)
        || String(config.chatId) !== tenantId || String(config.sessionToken) !== sessionToken) return;
    const resources = Array.isArray(data.resources) ? data.resources : [];
    list.innerHTML = resources.map(serviceResourceCard).join('');
    status.textContent = resources.length ? t('serviceResourceReady') : t('serviceResourceEmpty');
  } catch (error) {
    if (workspace.dataset.resourceRefreshSequence !== String(sequence)
        || String(config.chatId) !== tenantId || String(config.sessionToken) !== sessionToken) return;
    status.textContent = error.status === 403 ? t('serviceBookingsDenied')
      : !navigator.onLine ? t('serviceResourceUnknownStale') : t('serviceResourceLoadFailed');
  }
}

async function saveServiceResource(button, root) {
  const form = root.querySelector('#serviceResourceForm');
  if (!form) return;
  const name = form.querySelector('[name="name"]')?.value.trim();
  if (!name) return;
  button.disabled = true;
  const status = root.querySelector('#serviceResourcesStatus');
  status.textContent = t('serviceResourceLoading');
  try {
    const response = await fetch(serviceResourceEndpoint(), {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json', 'Idempotency-Key': 'service-resource-create-' + crypto.randomUUID() },
      body: JSON.stringify({
        name,
        resource_type: form.querySelector('[name="resource_type"]').value,
        description: form.querySelector('[name="description"]').value,
        service_item_id: form.querySelector('[name="service_item_id"]').value || null,
        location_id: form.querySelector('[name="location_id"]').value || null,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || t('serviceResourceSaveFailed'));
    form.reset();
    await refreshServiceResources(root);
  } catch (error) {
    status.textContent = error.message || t('serviceResourceSaveFailed');
  } finally {
    button.disabled = false;
  }
}

async function updateServiceResource(button, root, patch) {
  const resourceId = button.dataset.resourceId;
  const status = root.querySelector('#serviceResourcesStatus');
  button.disabled = true;
  try {
    const response = await fetch(serviceResourceEndpoint() + '/' + encodeURIComponent(resourceId), {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json', 'Idempotency-Key': 'service-resource-update-' + crypto.randomUUID() },
      body: JSON.stringify({ ...patch, expected_version: Number(button.dataset.version) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || t('serviceResourceSaveFailed'));
    await refreshServiceResources(root);
  } catch (error) {
    status.textContent = error.message || t('serviceResourceSaveFailed');
  } finally {
    button.disabled = false;
  }
}


function serviceResourceAvailabilityEndpoint(resourceId) {
  return serviceResourceEndpoint() + '/' + encodeURIComponent(resourceId) + '/availability';
}

async function openServiceResourceAvailability(button, root) {
  const resourceId = button.dataset.resourceId;
  const card = button.closest('.service-resource-card');
  if (!card) return;
  let panel = card.querySelector('.service-resource-availability-panel');
  if (panel) { panel.remove(); return; }
  panel = document.createElement('section');
  panel.className = 'service-resource-availability-panel';
  panel.style.cssText = 'display:grid;gap:8px;margin-top:10px;';
  panel.innerHTML = '<p class="logistics-meta" role="status">' + escapeHtml(t('serviceAvailabilityLoading')) + '</p>';
  card.append(panel);
  button.disabled = true;
  try {
    const response = await fetch(serviceResourceAvailabilityEndpoint(resourceId), { headers: authHeaders() });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || t('serviceAvailabilityLoadFailed'));
    const availability = data.availability || {};
    panel.dataset.version = String(availability.version || 0);
    panel.dataset.timeZone = String(availability.timeZone || '');
    panel.dataset.workingHours = JSON.stringify(availability.workingHours || []);
    panel.dataset.exceptions = JSON.stringify(availability.exceptions || []);
    panel.innerHTML = '<div class="logistics-meta">' + escapeHtml(t('serviceAvailabilityTimezone')) + ': ' + escapeHtml(availability.timeZone || '') + '</div>'
      + '<label>' + escapeHtml(t('serviceAvailabilityWorkingHours')) + '<textarea class="service-availability-hours" rows="7" spellcheck="false">' + escapeHtml(JSON.stringify(availability.workingHours || [], null, 2)) + '</textarea></label>'
      + '<label>' + escapeHtml(t('serviceAvailabilityExceptions')) + '<textarea class="service-availability-exceptions" rows="5" spellcheck="false">' + escapeHtml(JSON.stringify(availability.exceptions || [], null, 2)) + '</textarea></label>'
      + '<p class="logistics-meta">' + escapeHtml(t('serviceAvailabilityDeclarationOnly')) + '</p>'
      + '<fieldset class="service-window-assessment" style="display:grid;gap:8px;border:1px solid var(--border-color, #ddd);padding:10px;border-radius:8px;">'
      + '<legend>' + escapeHtml(t('serviceAvailabilityAssessWindow')) + '</legend>'
      + '<label>' + escapeHtml(t('serviceAvailabilityStart')) + '<input type="datetime-local" class="service-window-start"></label>'
      + '<label>' + escapeHtml(t('serviceAvailabilityEnd')) + '<input type="datetime-local" class="service-window-end"></label>'
      + '<button type="button" class="btn-secondary service-window-assess">' + escapeHtml(t('serviceAvailabilityAssess')) + '</button>'
      + '<div class="logistics-meta service-window-assessment-result" role="status" aria-live="polite"></div>'
      + '</fieldset>'
      + '<div class="logistics-meta service-availability-status" role="status">' + escapeHtml(availability.state === 'EMPTY' ? t('serviceAvailabilityEmpty') : t('serviceAvailabilityDeclared')) + '</div>'
      + '<button type="button" class="btn-primary service-availability-save" data-resource-id="' + escapeAttr(resourceId) + '">' + escapeHtml(t('serviceAvailabilitySave')) + '</button>';
  } catch (error) {
    panel.textContent = error.message || t('serviceAvailabilityLoadFailed');
  } finally { button.disabled = false; }
}

function assessServiceResourceWindow(button) {
  const panel = button.closest('.service-resource-availability-panel');
  if (!panel) return;
  const output = panel.querySelector('.service-window-assessment-result');
  try {
    const timeZone = panel.dataset.timeZone || '';
    const start = serviceLocalDateTimeToIso(panel.querySelector('.service-window-start')?.value, timeZone);
    const end = serviceLocalDateTimeToIso(panel.querySelector('.service-window-end')?.value, timeZone);
    const assessment = assessServiceResourceDeclaredWindow({
      timeZone,
      workingHours: JSON.parse(panel.querySelector('.service-availability-hours')?.value || '[]'),
      exceptions: JSON.parse(panel.querySelector('.service-availability-exceptions')?.value || '[]'),
      start, end,
    });
    const label = assessment.scheduleAssessment === 'WITHIN_DECLARED_HOURS'
      ? t('serviceAvailabilityWithinDeclaredHours')
      : assessment.scheduleAssessment === 'OUTSIDE_DECLARED_HOURS'
        ? t('serviceAvailabilityOutsideDeclaredHours') : t('serviceAvailabilityAssessmentUnknown');
    output.textContent = label + ' ' + t('serviceAvailabilityCommitmentsNotChecked');
  } catch (error) {
    output.textContent = error.message || t('serviceAvailabilityAssessmentUnknown');
  }
}

async function openServiceResourceProviders(button) {
  const resourceId = button.dataset.resourceId;
  const card = button.closest('.service-resource-card');
  if (!card) return;
  let panel = card.querySelector('.service-resource-providers-panel');
  if (panel) { panel.remove(); return; }
  panel = document.createElement('section');
  panel.className = 'service-resource-providers-panel';
  panel.style.cssText = 'display:grid;gap:8px;margin-top:10px;';
  panel.textContent = t('serviceResourceLoading');
  card.append(panel);
  try {
    const response = await fetch(apiBase() + '/tenants/' + encodeURIComponent(config.chatId) + '/memberships', { headers: authHeaders() });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || t('serviceResourceProviderAssignFailed'));
    const memberships = Array.isArray(data.memberships) ? data.memberships : [];
    const assigned = memberships.filter(member => (member.contextualRoles || []).some(role =>
      String(role.role || '').toLowerCase() === 'service_provider'
      && String(role.scopeType || '').toUpperCase() === 'RESOURCE'
      && String(role.scopeId || '') === String(resourceId)));
    const eligible = memberships.filter(member => String(member.role || '').toLowerCase() === 'staff'
      && !assigned.some(item => String(item.id) === String(member.id)));
    panel.innerHTML = '<label>' + escapeHtml(t('serviceResourceSelectProvider')) + '<select class="service-resource-provider-select">'
      + '<option value="">' + escapeHtml(t('serviceResourceNoProviderMembers')) + '</option>'
      + eligible.map(member => '<option value="' + escapeAttr(member.id) + '">' + escapeHtml(member.displayName || member.id) + '</option>').join('')
      + '</select></label>'
      + '<button type="button" class="btn-secondary service-resource-provider-assign" data-resource-id="' + escapeAttr(resourceId) + '">' + escapeHtml(t('serviceResourceAssignProvider')) + '</button>'
      + '<div class="service-resource-provider-status logistics-meta" role="status"></div>'
      + '<div><strong>' + escapeHtml(t('serviceResourceAssignedProviders')) + '</strong>'
      + (assigned.length ? assigned.map(member => '<div class="logistics-meta">' + escapeHtml(member.displayName || member.id)
        + ' <button type="button" class="btn-secondary service-resource-provider-revoke" data-resource-id="' + escapeAttr(resourceId)
        + '" data-membership-id="' + escapeAttr(member.id) + '">' + escapeHtml(t('serviceResourceRevokeProvider')) + '</button></div>').join('')
        : '<div class="logistics-meta">' + escapeHtml(t('serviceResourceEmpty')) + '</div>') + '</div>';
  } catch (error) {
    panel.textContent = error.message || t('serviceResourceProviderAssignFailed');
  }
}

async function assignServiceProvider(button) {
  const panel = button.closest('.service-resource-providers-panel');
  const membershipId = panel?.querySelector('.service-resource-provider-select')?.value;
  const status = panel?.querySelector('.service-resource-provider-status');
  if (!membershipId) { if (status) status.textContent = t('serviceResourceNoProviderMembers'); return; }
  button.disabled = true;
  try {
    const response = await fetch(apiBase() + '/auth/membership-contextual-role', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ membershipId, role: 'service_provider', scopeType: 'RESOURCE', scopeId: button.dataset.resourceId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || t('serviceResourceProviderAssignFailed'));
    if (status) status.textContent = t('serviceResourceProviderAssigned');
    await openServiceResourceProviders({ dataset: { resourceId: button.dataset.resourceId }, closest: () => button.closest('.service-resource-card') });
  } catch (error) {
    if (status) status.textContent = error.message || t('serviceResourceProviderAssignFailed');
  } finally { button.disabled = false; }
}

async function revokeServiceProvider(button) {
  button.disabled = true;
  const panel = button.closest('.service-resource-providers-panel');
  const status = panel?.querySelector('.service-resource-provider-status');
  try {
    const response = await fetch(apiBase() + '/auth/membership-contextual-role/revoke', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        membershipId: button.dataset.membershipId, role: 'service_provider',
        scopeType: 'RESOURCE', scopeId: button.dataset.resourceId,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || t('serviceResourceProviderAssignFailed'));
    if (status) status.textContent = t('serviceResourceProviderAssigned');
    await openServiceResourceProviders({ dataset: { resourceId: button.dataset.resourceId }, closest: () => button.closest('.service-resource-card') });
  } catch (error) {
    if (status) status.textContent = error.message || t('serviceResourceProviderAssignFailed');
  } finally { button.disabled = false; }
}

async function saveServiceResourceAvailability(button, root) {
  const panel = button.closest('.service-resource-availability-panel');
  if (!panel) return;
  let workingHours, exceptions;
  try {
    workingHours = JSON.parse(panel.querySelector('.service-availability-hours')?.value || '[]');
    exceptions = JSON.parse(panel.querySelector('.service-availability-exceptions')?.value || '[]');
    if (!Array.isArray(workingHours) || !Array.isArray(exceptions)) throw new Error('Expected JSON arrays');
  } catch (error) {
    panel.querySelector('.service-availability-status').textContent = t('serviceAvailabilityInvalidJson');
    return;
  }
  button.disabled = true;
  const status = panel.querySelector('.service-availability-status');
  status.textContent = t('serviceAvailabilitySaving');
  try {
    const response = await fetch(serviceResourceAvailabilityEndpoint(button.dataset.resourceId), {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json', 'Idempotency-Key': 'service-availability-' + crypto.randomUUID() },
      body: JSON.stringify({ working_hours: workingHours, exceptions, expected_version: Number(panel.dataset.version || 0) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || t('serviceAvailabilitySaveFailed'));
    panel.dataset.version = String(data.availability?.version || panel.dataset.version);
    panel.dataset.timeZone = String(data.availability?.timeZone || panel.dataset.timeZone || '');
    panel.dataset.workingHours = JSON.stringify(data.availability?.workingHours || workingHours);
    panel.dataset.exceptions = JSON.stringify(data.availability?.exceptions || exceptions);
    status.textContent = t('serviceAvailabilitySavedDeclaration');
  } catch (error) {
    status.textContent = error.message || t('serviceAvailabilitySaveFailed');
  } finally { button.disabled = false; }
}

export function serviceBookingsWorkspaceShell() {
  return '<section id="serviceBookingsWorkspace" class="settings-section" aria-label="' + escapeAttr(t('serviceBookingsTitle')) + '">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">'
    + '<h3 style="margin:0;">' + escapeHtml(t('serviceBookingsTitle')) + '</h3>'
    + '<button type="button" class="btn-secondary" id="serviceBookingsRefresh">' + escapeHtml(t('serviceBookingsRefresh')) + '</button></div>'
    + '<p class="logistics-meta">' + escapeHtml(t('serviceBookingsDescription')) + '</p>'
    + '<div id="serviceBookingsStatus" class="logistics-meta" role="status">' + escapeHtml(t('serviceBookingsLoading')) + '</div>'
    + '<div id="serviceBookingsList"></div>'
    + (canAccessServiceResources()
      ? '<section class="settings-section" aria-label="' + escapeAttr(t('serviceResourceTitle')) + '">'
        + '<h4>' + escapeHtml(t('serviceResourceTitle')) + '</h4>'
        + '<p class="logistics-meta">' + escapeHtml(t('serviceResourceDescription')) + '</p>'
        + (canManageServiceResources()
          ? '<form id="serviceResourceForm" class="settings-form" style="display:grid;gap:8px;">'
            + '<input name="name" maxlength="120" required placeholder="' + escapeAttr(t('serviceResourceName')) + '">'
            + '<select name="resource_type"><option value="PROVIDER">' + escapeHtml(t('serviceResourceTypeProvider')) + '</option><option value="FACILITY">' + escapeHtml(t('serviceResourceTypeFacility')) + '</option><option value="EQUIPMENT">' + escapeHtml(t('serviceResourceTypeEquipment')) + '</option><option value="OTHER">' + escapeHtml(t('serviceResourceTypeOther')) + '</option></select>'
            + '<select name="service_item_id">' + serviceResourceCatalogOptions() + '</select>'
            + '<select name="location_id">' + serviceResourceLocationOptions() + '</select>'
            + '<textarea name="description" maxlength="1000" placeholder="' + escapeAttr(t('serviceResourceDescriptionField')) + '"></textarea>'
            + '<button type="submit" class="btn-primary" id="serviceResourceCreate">' + escapeHtml(t('serviceResourceCreate')) + '</button></form>'
          : '')
        + '<div id="serviceResourcesStatus" class="logistics-meta" role="status">' + escapeHtml(t('serviceResourceLoading')) + '</div>'
        + '<div id="serviceResourcesList"></div></section>'
      : '') + '</section>';
}

export async function refreshServiceBookings(root = document) {
  const workspace = root.querySelector('#serviceBookingsWorkspace');
  const status = workspace?.querySelector('#serviceBookingsStatus');
  const list = workspace?.querySelector('#serviceBookingsList');
  if (!workspace || !status || !list) return;
  if (!config.chatId || !config.sessionToken) {
    status.textContent = t('serviceBookingsSignIn');
    list.replaceChildren();
    return;
  }
  const sequence = Number(workspace.dataset.refreshSequence || 0) + 1;
  workspace.dataset.refreshSequence = String(sequence);
  const tenantId = String(config.chatId);
  const sessionToken = String(config.sessionToken);
  const context = { tenantId, baseUrl: apiBase(), headers: authHeaders() };
  status.textContent = t('serviceBookingsLoading');
  list.replaceChildren();
  const candidates = serviceOrders();
  if (!candidates.length) {
    if (workspace.dataset.refreshSequence === String(sequence)
        && String(config.chatId) === tenantId && String(config.sessionToken) === sessionToken) {
      status.textContent = t('serviceBookingsNoOrders');
    }
    return;
  }
  const results = await Promise.all(candidates.map(async order => {
    try { return { order, bookings: await requestBookings(order, context) }; }
    catch (error) { return { order, error }; }
  }));
  // Ignore responses from an older refresh or a tenant/session that is no
  // longer active. A late response must not repaint another tenant's workspace.
  if (workspace.isConnected === false
      || workspace.dataset.refreshSequence !== String(sequence)
      || String(config.chatId) !== tenantId
      || String(config.sessionToken) !== sessionToken) return;
  const bookings = results.flatMap(result => result.bookings
    ? result.bookings.map(booking => ({ order: result.order, booking }))
    : []);
  list.innerHTML = bookings.map(({ order, booking }) => renderBookingCard(order, booking)).join('');
  const denied = results.filter(result => result.error?.status === 403).length;
  const failures = results.filter(result => result.error && result.error.status !== 403).length;
  status.textContent = bookings.length
    ? bookings.length + ' ' + t(bookings.length === 1 ? 'serviceBookingSingular' : 'serviceBookingPlural') + ' ' + t('serviceBookingsLoaded')
    : denied === results.length
      ? t('serviceBookingsDenied')
      : failures
        ? t('serviceBookingsPartialFailure')
        : t('serviceBookingsEmpty');
}

async function transitionBooking(button, root) {
  const target = button.dataset.target;
  let reason = '';
  let completion_note = '';
  if (['REJECTED', 'FAILED', 'CANCELLED'].includes(target)) {
    reason = window.prompt(t('serviceBookingReasonPrompt') + ' ' + target.toLowerCase() + ':')?.trim() || '';
    if (!reason) return;
  }
  if (target === 'COMPLETED') {
    completion_note = window.prompt(t('serviceBookingCompletionPrompt'))?.trim() || '';
  }
  const orderId = button.dataset.orderId;
  const bookingId = button.dataset.bookingId;
  const url = apiBase() + '/tenants/' + encodeURIComponent(config.chatId)
    + '/orders/' + encodeURIComponent(orderId) + '/service-bookings/' + encodeURIComponent(bookingId);
  button.disabled = true;
  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json', 'Idempotency-Key': 'service-booking-ui-' + crypto.randomUUID() },
      body: JSON.stringify({
        status: target,
        expected_version: Number(button.dataset.version),
        ...(reason ? { reason } : {}),
        ...(completion_note ? { completion_note } : {}),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || t('serviceBookingUpdateFailed'));
    await refreshServiceBookings(root);
  } catch (error) {
    window.alert(error.message || 'Booking update failed. Refresh and retry.');
    button.disabled = false;
  }
}

export function mountServiceBookingsWorkspace(root = document) {
  const workspace = root.querySelector('#serviceBookingsWorkspace');
  if (!workspace) return;
  // The Logistics list re-renders after unrelated assignment updates. Keep
  // the delegated handler on the stable list root and avoid refetching all
  // bookings on every render.
  if (root && typeof root.addEventListener === 'function' && !serviceBookingsHandlerRoots.has(root)) {
    serviceBookingsHandlerRoots.add(root);
    root.addEventListener('click', event => {
      const refresh = event.target.closest('#serviceBookingsRefresh');
      const action = event.target.closest('.service-booking-action');
      const resourceToggle = event.target.closest('.service-resource-toggle');
      const resourceRename = event.target.closest('.service-resource-rename');
      const resourceAvailability = event.target.closest('.service-resource-availability');
      const resourceProviders = event.target.closest('.service-resource-providers');
      const providerAssign = event.target.closest('.service-resource-provider-assign');
      const providerRevoke = event.target.closest('.service-resource-provider-revoke');
      const availabilitySave = event.target.closest('.service-availability-save');
      const windowAssess = event.target.closest('.service-window-assess');
      const createResource = event.target.closest('#serviceResourceCreate');
      if (refresh) { refreshServiceBookings(root); refreshServiceResources(root); }
      if (action) transitionBooking(action, root);
      if (resourceToggle) updateServiceResource(resourceToggle, root, { status: resourceToggle.dataset.status });
      if (resourceAvailability) openServiceResourceAvailability(resourceAvailability, root);
      if (resourceProviders) openServiceResourceProviders(resourceProviders);
      if (providerAssign) assignServiceProvider(providerAssign);
      if (providerRevoke) revokeServiceProvider(providerRevoke);
      if (availabilitySave) saveServiceResourceAvailability(availabilitySave, root);
      if (windowAssess) assessServiceResourceWindow(windowAssess);
      if (resourceRename) {
        const nextName = window.prompt(t('serviceResourceRenamePrompt'))?.trim();
        if (nextName) updateServiceResource(resourceRename, root, { name: nextName });
      }
      if (createResource) { event.preventDefault(); saveServiceResource(createResource, root); }
    });
    root.addEventListener('submit', event => {
      if (event.target?.id !== 'serviceResourceForm') return;
      event.preventDefault();
      const button = event.target.querySelector('#serviceResourceCreate');
      if (button) saveServiceResource(button, root);
    });
  }
  const tenantKey = config.chatId && config.sessionToken
    ? String(config.chatId) + ':' + String(config.sessionToken)
    : '';
  if (tenantKey && (mountedServiceBookingsWorkspace !== workspace || mountedServiceBookingsTenant !== tenantKey)) {
    mountedServiceBookingsWorkspace = workspace;
    mountedServiceBookingsTenant = tenantKey;
    refreshServiceBookings(root);
    refreshServiceResources(root);
  }
}
