// Logistics Scheduling workspace — UI over the existing canonical scheduling API.
// This module owns presentation only. The backend/store remain authoritative.
import { config } from '../state.js';
import { authHeaders } from '../auth/tenant.js';
import { escapeHtml } from '../utils/index.js';
import { t } from '../ui/i18n.js';
import { localDateTimeToIso, normalizeCandidateWindow } from '../verticals/logistics/scheduling-timezone-contract.js';

export { localDateTimeToIso, normalizeCandidateWindow };

let activities = [];
const lastEvaluations = new Map();
let lastState = 'UNKNOWN_STALE';
let feedback = '';
let workspaceTimezone = null;
let refreshSequence = 0;
let mountedStatusNode = null;
let pendingRequestKey = null;
let pendingRequestFingerprint = '';
const pendingTransitionKeys = new Map();
const candidateWindowDrafts = new Map();

function endpoint(activityId = '') {
  const base = (config.syncUrl || window.location.origin).replace(/\/$/, '');
  const root = `/tenants/${encodeURIComponent(config.chatId)}/logistics/scheduling`;
  return base + root + (activityId ? `/${encodeURIComponent(activityId)}` : '');
}

function roleNames() {
  const contextual = Array.isArray(config.contextualRoles) ? config.contextualRoles : [];
  return [
    String(config.currentStaffRole || config.authRole || config.tenantRole || '').toLowerCase(),
    ...contextual.map(item => String(item?.role || '').toLowerCase()),
  ];
}

function canViewScheduling() {
  return roleNames().some(role => [
    'owner', 'manager', 'logistics_manager', 'logistics_dispatcher',
    'logistics_courier', 'logistics_viewer',
  ].includes(role));
}

function canManageScheduling() {
  return roleNames().some(role => [
    'owner', 'manager', 'logistics_manager', 'logistics_dispatcher',
  ].includes(role));
}

function schedulingLocationId() {
  if (config.locationId) return String(config.locationId);
  const contextual = Array.isArray(config.contextualRoles) ? config.contextualRoles : [];
  const scoped = [...new Set(contextual
    .filter(item => String(item?.scopeType || '').toUpperCase() === 'LOCATION' && item?.scopeId)
    .map(item => String(item.scopeId)))];
  return scoped.length === 1 ? scoped[0] : null;
}

function stateLabel(state) {
  const keys = {
    LOADING: 'logisticsSchedulingLoading',
    READY: 'logisticsSchedulingReady',
    EMPTY: 'logisticsSchedulingEmpty',
    DENIED: 'logisticsSchedulingDenied',
    ERROR: 'logisticsSchedulingError',
    UNKNOWN_STALE: 'logisticsSchedulingUnknownStale',
  };
  return t(keys[state] || 'logisticsSchedulingUnknownStale');
}

function formatWindow(start, end, timeZone = workspaceTimezone) {
  if (!start && !end) return '—';
  const safe = value => {
    if (!value) return '—';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return String(value);
    if (!timeZone) return date.toISOString();
    try {
      return new Intl.DateTimeFormat(undefined, {
        timeZone, dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23',
      }).format(date);
    } catch {
      return date.toISOString();
    }
  };
  return `${safe(start)} – ${safe(end)}`;
}

function candidateWindowForActivity(activity, startValue, endValue) {
  if (startValue || endValue) {
    return normalizeCandidateWindow(startValue, endValue, activity?.timezone || workspaceTimezone);
  }
  if (activity?.mode === 'WINDOWED' && activity.requestedStart && activity.requestedEnd) {
    return {
      scheduledStart: activity.requestedStart,
      scheduledEnd: activity.requestedEnd,
      timezone: activity.timezone || workspaceTimezone,
    };
  }
  return null;
}

function updateTimezoneLabel(root) {
  const label = root.querySelector('#logisticsSchedulingTimezone');
  if (!label) return;
  label.textContent = workspaceTimezone
    ? `${t('logisticsSchedulingTimeZone')}: ${workspaceTimezone}`
    : t('logisticsSchedulingTimeZoneMissing');
}

function transitionTargets(status) {
  const map = {
    REQUESTED: ['SCHEDULED', 'CANCELLED', 'EXPIRED'],
    SCHEDULED: ['CONFIRMED', 'CANCELLED', 'MISSED', 'EXPIRED'],
    CONFIRMED: ['IN_PROGRESS', 'CANCELLED', 'MISSED', 'FAILED'],
    IN_PROGRESS: ['COMPLETED', 'FAILED'],
  };
  return map[String(status || '').toUpperCase()] || [];
}

function renderActivity(activity) {
  const targets = canManageScheduling() ? transitionTargets(activity.status) : [];
  const transitionButtons = targets.map(target => {
    const feasibilityBlocked = target === 'SCHEDULED' && activity.lastEvaluation !== 'FEASIBLE';
    const blockedAttributes = feasibilityBlocked
      ? `disabled aria-disabled="true" title="${escapeHtml(t('logisticsSchedulingScheduleBlocked'))}"`
      : '';
    return `<button type="button" class="btn-secondary" data-scheduling-transition="${escapeHtml(target)}" data-activity-id="${escapeHtml(activity.id)}" ${blockedAttributes}>${escapeHtml(target.replaceAll('_', ' '))}</button>`;
  }).join('');
  const scheduleWindow = activity.status === 'REQUESTED' && canManageScheduling()
    ? `<div class="logistics-scheduling-window">
         <label>${t('logisticsSchedulingScheduledStart')} <input type="datetime-local" data-scheduled-start="${escapeHtml(activity.id)}"></label>
         <label>${t('logisticsSchedulingScheduledEnd')} <input type="datetime-local" data-scheduled-end="${escapeHtml(activity.id)}"></label>
       </div>`
    : '';
  return `
    <article class="logistics-meta logistics-scheduling-card" data-scheduling-card="${escapeHtml(activity.id)}">
      <div><strong>${escapeHtml(activity.activityType || 'Activity')}</strong> · ${escapeHtml(activity.status || 'UNKNOWN')}</div>
      <div>${escapeHtml(t('logisticsSchedulingRequestedWindow'))}: ${escapeHtml(formatWindow(activity.requestedStart, activity.requestedEnd, activity.timezone || workspaceTimezone))}</div>
      <div>${escapeHtml(t('logisticsSchedulingScheduledWindow'))}: ${escapeHtml(formatWindow(activity.scheduledStart, activity.scheduledEnd, activity.timezone || workspaceTimezone))}</div>
      <div>${escapeHtml(t('logisticsSchedulingTimeZone'))}: ${escapeHtml(activity.timezone || workspaceTimezone || t('logisticsSchedulingTimeZoneMissing'))}</div>
      <div>Reference: ${escapeHtml(activity.relatedFulfillmentId || activity.relatedOrderId || activity.relatedMovementId || '—')}</div>
      ${activity.lastEvaluation ? `<div class="scheduling-feasibility-result" role="status">Feasibility: ${escapeHtml(activity.lastEvaluation)}</div>` : ''}
      <div class="logistics-scheduling-actions">
        <button type="button" class="btn-secondary" data-scheduling-evaluate="${escapeHtml(activity.id)}">${t('logisticsSchedulingEvaluate')}</button>
        ${transitionButtons}
      </div>
      ${scheduleWindow}
    </article>`;
}

function handleSchedulingError(root, error) {
  if (error?.code === 'SCHEDULING_FEASIBILITY_UNKNOWN') {
    lastState = 'READY';
    feedback = t('logisticsSchedulingBlockedUnknown');
  } else if (error?.code === 'SCHEDULING_FEASIBILITY_CONFLICT') {
    lastState = 'READY';
    feedback = t('logisticsSchedulingBlockedConflict');
  } else {
    lastState = error?.status === 401 || error?.status === 403
      ? 'DENIED' : error?.status && error.status < 500 ? 'ERROR' : 'UNKNOWN_STALE';
    feedback = error?.message || '';
  }
  renderWorkspace(root);
}

function bindSchedulingControls(root) {
  const refreshButton = root.querySelector('#logistics-scheduling-refresh');
  if (refreshButton && refreshButton.dataset.schedulingBound !== '1') {
    refreshButton.dataset.schedulingBound = '1';
    refreshButton.addEventListener('click', async () => {
      try { await refresh(root); } catch (error) { handleSchedulingError(root, error); }
    });
  }

  root.querySelectorAll('[data-scheduling-filter]').forEach(filter => {
    if (filter.dataset.schedulingBound === '1') return;
    filter.dataset.schedulingBound = '1';
    filter.addEventListener('change', async () => {
      try { await refresh(root); } catch (error) { handleSchedulingError(root, error); }
    });
  });

  root.querySelectorAll('[data-scheduling-evaluate]').forEach(button => {
    if (button.dataset.schedulingBound === '1') return;
    button.dataset.schedulingBound = '1';
    button.addEventListener('click', async () => {
      try { await evaluateActivity(root, button.dataset.schedulingEvaluate); }
      catch (error) { handleSchedulingError(root, error); }
    });
  });

  root.querySelectorAll('[data-scheduling-transition]').forEach(button => {
    if (button.dataset.schedulingBound === '1') return;
    button.dataset.schedulingBound = '1';
    button.addEventListener('click', async () => {
      try {
        await transitionActivity(root, button.dataset.activityId, button.dataset.schedulingTransition, button);
      } catch (error) {
        handleSchedulingError(root, error);
      }
    });
  });

  root.querySelectorAll('[data-scheduled-start], [data-scheduled-end]').forEach(input => {
    if (input.dataset.schedulingBound === '1') return;
    input.dataset.schedulingBound = '1';
    input.addEventListener('input', () => {
      const activityId = String(input.dataset.scheduledStart || input.dataset.scheduledEnd || '');
      for (const key of pendingTransitionKeys.keys()) {
        if (key.startsWith(`${activityId}:SCHEDULED:`)) pendingTransitionKeys.delete(key);
      }
      lastEvaluations.delete(activityId);
      const activity = activities.find(item => String(item.id) === activityId);
      if (activity) activity.lastEvaluation = null;
      const startInput = root.querySelector(`[data-scheduled-start="${CSS.escape(activityId)}"]`);
      const endInput = root.querySelector(`[data-scheduled-end="${CSS.escape(activityId)}"]`);
      candidateWindowDrafts.set(activityId, {
        start: startInput?.value || '',
        end: endInput?.value || '',
      });
      const card = input.closest('[data-scheduling-card]');
      card?.querySelector('.scheduling-feasibility-result')?.remove();
      const scheduleButton = card?.querySelector('[data-scheduling-transition="SCHEDULED"]');
      if (scheduleButton) {
        scheduleButton.disabled = true;
        scheduleButton.setAttribute('aria-disabled', 'true');
        scheduleButton.title = t('logisticsSchedulingScheduleBlocked');
      }
      feedback = t('logisticsSchedulingWindowChanged');
      lastState = 'READY';
      const status = root.querySelector('#logisticsSchedulingStatus');
      if (status) status.textContent = [stateLabel(lastState), feedback].filter(Boolean).join(' ');
    });
  });
}

function renderWorkspace(root) {
  const status = root.querySelector('#logisticsSchedulingStatus');
  const list = root.querySelector('#logisticsSchedulingList');
  if (status) status.textContent = [stateLabel(lastState), feedback].filter(Boolean).join(' ');
  updateTimezoneLabel(root);
  if (!list) return;
  // Preserve operator-entered candidate windows when an evaluation, refresh,
  // or command causes the activity cards to be re-rendered.
  list.querySelectorAll('[data-scheduled-start]').forEach(input => {
    const activityId = String(input.dataset.scheduledStart || '');
    if (!activityId) return;
    const endInput = Array.from(list.querySelectorAll('[data-scheduled-end]'))
      .find(candidate => String(candidate.dataset.scheduledEnd || '') === activityId);
    candidateWindowDrafts.set(activityId, { start: input.value, end: endInput?.value || '' });
  });
  list.innerHTML = activities.map(renderActivity).join('');
  if (lastState === 'EMPTY') list.innerHTML = `<div class="empty">${stateLabel('EMPTY')}</div>`;
  if (lastState === 'DENIED' || lastState === 'ERROR' || lastState === 'UNKNOWN_STALE') {
    list.innerHTML = `<div class="empty">${stateLabel(lastState)}</div>` + activities.map(renderActivity).join('');
  }
  for (const [activityId, draft] of candidateWindowDrafts) {
    const startInput = Array.from(list.querySelectorAll('[data-scheduled-start]'))
      .find(candidate => String(candidate.dataset.scheduledStart || '') === activityId);
    const endInput = Array.from(list.querySelectorAll('[data-scheduled-end]'))
      .find(candidate => String(candidate.dataset.scheduledEnd || '') === activityId);
    if (startInput) startInput.value = draft.start;
    if (endInput) endInput.value = draft.end;
  }
  bindSchedulingControls(root);
}

export function logisticsSchedulingWorkspaceShell() {
  if (!canViewScheduling()) return '';
  const requestForm = canManageScheduling() ? `
    <form id="logisticsSchedulingRequestForm" class="logistics-scheduling-form">
      <div class="settings-section-label">${t('logisticsSchedulingRequestTitle')}</div>
      <label>${t('logisticsSchedulingActivityType')}
        <select name="activityType" required>
          <option value="PICKUP">Pickup</option><option value="DELIVERY">Delivery</option>
          <option value="LOADING">Loading</option><option value="UNLOADING">Unloading</option>
          <option value="DEPARTURE">Departure</option><option value="ARRIVAL">Arrival</option>
          <option value="CHECKPOINT">Checkpoint</option><option value="TRANSFER">Transfer</option>
          <option value="HANDOFF">Handoff</option><option value="HUB_ARRIVAL">Hub arrival</option>
          <option value="HUB_DEPARTURE">Hub departure</option>
        </select>
      </label>
      <label>${t('logisticsSchedulingMode')}
        <select name="mode"><option value="WINDOWED">Windowed</option><option value="SCHEDULED">Scheduled</option><option value="ON_DEMAND">On demand</option></select>
      </label>
      <label>${t('logisticsSchedulingReferenceType')}
        <select name="referenceType"><option value="fulfillment">Fulfillment</option><option value="order">Order</option><option value="movement">Movement</option></select>
      </label>
      <label>${t('logisticsSchedulingReferenceId')} <input name="referenceId" required maxlength="160"></label>
      <div class="logistics-meta">${t('logisticsSchedulingReferenceHint')}</div>
      <label>${t('logisticsSchedulingRequestedStart')} <input name="requestedStart" type="datetime-local"></label>
      <label>${t('logisticsSchedulingRequestedEnd')} <input name="requestedEnd" type="datetime-local"></label>
      <button type="submit" class="btn-primary">${t('logisticsSchedulingSubmit')}</button>
    </form>` : '';
  const filterMarkup = `
    <div class="logistics-scheduling-filters" aria-label="${t('logisticsSchedulingFilters')}">
      <label>${t('logisticsSchedulingStatusFilter')}
        <select id="logisticsSchedulingStatusFilter" data-scheduling-filter>
          <option value="">${t('logisticsSchedulingAllStatuses')}</option>
          <option value="REQUESTED">REQUESTED</option><option value="SCHEDULED">SCHEDULED</option>
          <option value="CONFIRMED">CONFIRMED</option><option value="IN_PROGRESS">IN PROGRESS</option>
          <option value="COMPLETED">COMPLETED</option><option value="CANCELLED">CANCELLED</option>
          <option value="EXPIRED">EXPIRED</option><option value="MISSED">MISSED</option><option value="FAILED">FAILED</option>
        </select>
      </label>
      <label>${t('logisticsSchedulingTypeFilter')}
        <select id="logisticsSchedulingTypeFilter" data-scheduling-filter>
          <option value="">${t('logisticsSchedulingAllTypes')}</option>
          <option value="PICKUP">PICKUP</option><option value="DELIVERY">DELIVERY</option>
          <option value="LOADING">LOADING</option><option value="UNLOADING">UNLOADING</option>
          <option value="DEPARTURE">DEPARTURE</option><option value="ARRIVAL">ARRIVAL</option>
          <option value="CHECKPOINT">CHECKPOINT</option><option value="TRANSFER">TRANSFER</option>
          <option value="HANDOFF">HANDOFF</option><option value="HUB_ARRIVAL">HUB ARRIVAL</option>
          <option value="HUB_DEPARTURE">HUB DEPARTURE</option>
        </select>
      </label>
    </div>`;
  return `
    <section class="logistics-scheduling-workspace" aria-label="Logistics scheduling">
      <div class="logistics-workspace-head">
        <div><h3 style="margin:0;">${t('logisticsSchedulingTitle')}</h3><div class="logistics-meta">${t('logisticsSchedulingHint')}</div></div>
        <button type="button" class="btn-secondary" id="logistics-scheduling-refresh">${t('logisticsSchedulingRefresh')}</button>
      </div>
      <div id="logisticsSchedulingTimezone" class="logistics-meta" role="status" aria-live="polite"></div>
      ${filterMarkup}
      ${requestForm}
      <div id="logisticsSchedulingStatus" role="status" aria-live="polite">${stateLabel('UNKNOWN_STALE')}</div>
      <div id="logisticsSchedulingList" aria-live="polite"></div>
    </section>`;
}

async function refresh(root) {
  const sequence = ++refreshSequence;
  if (!config.chatId || !config.sessionToken) {
    lastState = 'DENIED';
    renderWorkspace(root);
    return;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    lastState = 'UNKNOWN_STALE';
    feedback = '';
    renderWorkspace(root);
    return;
  }
  feedback = '';
  lastState = 'LOADING';
  renderWorkspace(root);
  try {
    const query = new URLSearchParams();
    const locationId = schedulingLocationId();
    if (locationId) query.set('locationId', locationId);
    const statusFilter = root.querySelector('#logisticsSchedulingStatusFilter')?.value || '';
    const typeFilter = root.querySelector('#logisticsSchedulingTypeFilter')?.value || '';
    if (statusFilter) query.set('status', statusFilter);
    if (typeFilter) query.set('activityType', typeFilter);
    const response = await fetch(endpoint() + (query.size ? `?${query}` : ''), { headers: authHeaders() });
    const data = await response.json().catch(() => ({}));
    if (sequence !== refreshSequence) return;
    if (response.status === 401 || response.status === 403) {
      lastState = 'DENIED';
      renderWorkspace(root);
      return;
    }
    if (!response.ok) throw new Error(data?.error?.message || `Scheduling request failed (${response.status})`);
    workspaceTimezone = typeof data.timezone === 'string' && data.timezone.trim() ? data.timezone.trim() : null;
    activities = (Array.isArray(data.activities) ? data.activities : []).map(activity => ({
      ...activity,
      lastEvaluation: lastEvaluations.get(String(activity.id)) || activity.lastEvaluation || null,
    }));
    feedback = '';
    lastState = activities.length ? 'READY' : 'EMPTY';
  } catch {
    lastState = typeof navigator !== 'undefined' && !navigator.onLine ? 'UNKNOWN_STALE' : 'ERROR';
  }
  if (sequence === refreshSequence) renderWorkspace(root);
}

function commandKey() {
  return globalThis.crypto?.randomUUID?.() || `scheduling-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function submitRequest(root, form) {
  // Invalidate list reads started before this mutation so stale responses cannot erase its result.
  ++refreshSequence;
  const values = new FormData(form);
  const referenceType = String(values.get('referenceType') || 'fulfillment');
  const referenceId = String(values.get('referenceId') || '').trim();
  const startValue = String(values.get('requestedStart') || '');
  const endValue = String(values.get('requestedEnd') || '');
  const mode = String(values.get('mode') || 'WINDOWED');
  const hasWindow = Boolean(startValue || endValue);
  if (hasWindow && (!startValue || !endValue)) {
    lastState = 'READY';
    feedback = t('logisticsSchedulingWindowInvalid');
    renderWorkspace(root);
    return;
  }
  if (hasWindow && !workspaceTimezone) {
    lastState = 'READY';
    feedback = t('logisticsSchedulingTimeZoneMissing');
    renderWorkspace(root);
    return;
  }
  const requestedWindow = hasWindow
    ? normalizeCandidateWindow(startValue, endValue, workspaceTimezone)
    : null;
  if (hasWindow && !requestedWindow) {
    lastState = 'READY';
    feedback = t('logisticsSchedulingWindowInvalid');
    renderWorkspace(root);
    return;
  }
  const body = {
    activity_type: String(values.get('activityType') || 'DELIVERY'),
    mode,
    location_id: schedulingLocationId(),
    timezone: workspaceTimezone,
    requested_start: requestedWindow?.scheduledStart || null,
    requested_end: requestedWindow?.scheduledEnd || null,
    [`related_${referenceType}`]: { id: referenceId },
  };
  if (mode === 'WINDOWED' && (!body.requested_start || !body.requested_end)) {
    lastState = 'READY';
    feedback = t('logisticsSchedulingWindowRequired');
    renderWorkspace(root);
    return;
  }
  const fingerprint = JSON.stringify(body);
  if (!pendingRequestKey || pendingRequestFingerprint !== fingerprint) {
    pendingRequestKey = commandKey();
    pendingRequestFingerprint = fingerprint;
  }
  const key = pendingRequestKey;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    lastState = 'UNKNOWN_STALE';
    renderWorkspace(root);
    return;
  }
  const response = await fetch(endpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(), 'Idempotency-Key': key },
    body: JSON.stringify({ ...body, idempotencyKey: key }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data?.error?.message || `Scheduling request failed (${response.status})`), { status: response.status });
  pendingRequestKey = null;
  pendingRequestFingerprint = '';
  form.reset();
  await refresh(root);
}

async function evaluateActivity(root, activityId) {
  // Evaluation is newer evidence than any list read already in flight.
  ++refreshSequence;
  const startInput = root.querySelector(`[data-scheduled-start="${CSS.escape(String(activityId))}"]`);
  const endInput = root.querySelector(`[data-scheduled-end="${CSS.escape(String(activityId))}"]`);
  if (!startInput?.value || !endInput?.value) {
    lastState = 'READY';
    feedback = t('logisticsSchedulingWindowRequired');
    renderWorkspace(root);
    return;
  }
  const activity = activities.find(item => String(item.id) === String(activityId));
  const candidateWindow = candidateWindowForActivity(activity, startInput.value, endInput.value);
  if (!candidateWindow) {
    lastState = 'READY';
    feedback = t('logisticsSchedulingWindowInvalid');
    renderWorkspace(root);
    return;
  }
  const response = await fetch(endpoint(activityId) + '/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(candidateWindow),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data?.error?.message || `Evaluation failed (${response.status})`), { status: response.status });
  const evaluation = data?.evaluation?.evaluation || 'UNKNOWN';
  const item = activities.find(activity => String(activity.id) === String(activityId));
  if (item) item.lastEvaluation = evaluation;
  lastEvaluations.set(String(activityId), evaluation);
  lastState = 'READY';
  feedback = evaluation === 'UNKNOWN'
    ? t('logisticsSchedulingBlockedUnknown')
    : evaluation === 'CONFLICT' ? t('logisticsSchedulingBlockedConflict') : '';
  renderWorkspace(root);
  const card = root.querySelector(`[data-scheduling-card="${CSS.escape(String(activityId))}"]`);
  if (card) {
    const note = document.createElement('div');
    note.setAttribute('role', 'status');
    note.textContent = `${t('logisticsSchedulingEvaluation')}: ${evaluation}`;
    card.appendChild(note);
  }
}

async function transitionActivity(root, activityId, target, button) {
  // A pre-command list response must not overwrite the command result.
  ++refreshSequence;
  const activity = activities.find(item => String(item.id) === String(activityId));
  if (!activity) return;
  const startInput = root.querySelector(`[data-scheduled-start="${CSS.escape(String(activityId))}"]`);
  const endInput = root.querySelector(`[data-scheduled-end="${CSS.escape(String(activityId))}"]`);
  const body = { status: target, expectedVersion: activity.version };
  if (target === 'SCHEDULED') {
    const candidateWindow = candidateWindowForActivity(activity, startInput?.value, endInput?.value);
    if (!candidateWindow) {
      lastState = 'READY';
      feedback = startInput?.value && endInput?.value
        ? t('logisticsSchedulingWindowInvalid')
        : t('logisticsSchedulingWindowRequired');
      renderWorkspace(root);
      return;
    }
    Object.assign(body, candidateWindow);
  }
  const transitionKey = `${activityId}:${target}:${activity.version}`;
  const key = pendingTransitionKeys.get(transitionKey) || commandKey();
  pendingTransitionKeys.set(transitionKey, key);
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    lastState = 'UNKNOWN_STALE';
    renderWorkspace(root);
    return;
  }
  const response = await fetch(endpoint(activityId) + '/transition', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders(), 'Idempotency-Key': key },
    body: JSON.stringify({ ...body, idempotencyKey: key }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 409 || response.status === 412) await refresh(root);
    throw Object.assign(new Error(data?.error?.message || `Transition failed (${response.status})`), { status: response.status, code: data?.error?.code });
  }
  pendingTransitionKeys.delete(transitionKey);
  const updated = data?.activity;
  if (updated && String(updated.status || '').toUpperCase() !== 'REQUESTED') {
    candidateWindowDrafts.delete(String(activityId));
  }
  if (updated) activities = activities.map(item => String(item.id) === String(activityId) ? updated : item);
  await refresh(root);
}

export function mountLogisticsSchedulingWorkspace(root) {
  if (!root) return;
  const requestForm = root.querySelector('#logisticsSchedulingRequestForm');
  if (requestForm && requestForm.dataset.schedulingSubmitBound !== '1') {
    requestForm.dataset.schedulingSubmitBound = '1';
    requestForm.addEventListener('input', () => {
      pendingRequestKey = null;
      pendingRequestFingerprint = '';
    });
    const submit = async () => {
      if (!requestForm.reportValidity()) return;
      try { await submitRequest(root, requestForm); }
      catch (error) { handleSchedulingError(root, error); }
    };
    requestForm.addEventListener('submit', event => {
      event.preventDefault();
      submit();
    });
    requestForm.querySelector('button[type="submit"]')?.addEventListener('click', event => {
      event.preventDefault();
      submit();
    });
  }
  const statusNode = root.querySelector('#logisticsSchedulingStatus');
  if (statusNode && statusNode !== mountedStatusNode) {
    mountedStatusNode = statusNode;
    renderWorkspace(root);
    refresh(root);
  } else {
    bindSchedulingControls(root);
  }
}
