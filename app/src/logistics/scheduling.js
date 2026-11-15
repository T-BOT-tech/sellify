// Logistics Scheduling workspace — UI over the existing canonical scheduling API.
// This module owns presentation only. The backend/store remain authoritative.
import { config } from '../state.js';
import { authHeaders } from '../auth/tenant.js';
import { escapeHtml } from '../utils/index.js';
import { t } from '../ui/i18n.js';

let activities = [];
let lastState = 'UNKNOWN_STALE';
let feedback = '';
let refreshSequence = 0;
let mountedStatusNode = null;
let pendingRequestKey = null;
let pendingRequestFingerprint = '';
const pendingTransitionKeys = new Map();

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

function formatWindow(start, end) {
  if (!start && !end) return '—';
  const safe = value => value ? new Date(value).toLocaleString() : '—';
  return `${safe(start)} – ${safe(end)}`;
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
         <label>Scheduled start <input type="datetime-local" data-scheduled-start="${escapeHtml(activity.id)}"></label>
         <label>Scheduled end <input type="datetime-local" data-scheduled-end="${escapeHtml(activity.id)}"></label>
       </div>`
    : '';
  return `
    <article class="logistics-meta logistics-scheduling-card" data-scheduling-card="${escapeHtml(activity.id)}">
      <div><strong>${escapeHtml(activity.activityType || 'Activity')}</strong> · ${escapeHtml(activity.status || 'UNKNOWN')}</div>
      <div>Requested: ${escapeHtml(formatWindow(activity.requestedStart, activity.requestedEnd))}</div>
      <div>Scheduled: ${escapeHtml(formatWindow(activity.scheduledStart, activity.scheduledEnd))}</div>
      <div>Reference: ${escapeHtml(activity.relatedFulfillmentId || activity.relatedOrderId || activity.relatedMovementId || '—')}</div>
      ${activity.lastEvaluation ? `<div role="status">Feasibility: ${escapeHtml(activity.lastEvaluation)}</div>` : ''}
      <div class="logistics-scheduling-actions">
        <button type="button" class="btn-secondary" data-scheduling-evaluate="${escapeHtml(activity.id)}">${t('logisticsSchedulingEvaluate')}</button>
        ${transitionButtons}
      </div>
      ${scheduleWindow}
    </article>`;
}

function renderWorkspace(root) {
  const status = root.querySelector('#logisticsSchedulingStatus');
  const list = root.querySelector('#logisticsSchedulingList');
  if (status) status.textContent = [stateLabel(lastState), feedback].filter(Boolean).join(' ');
  if (!list) return;
  list.innerHTML = activities.map(renderActivity).join('');
  if (lastState === 'EMPTY') list.innerHTML = `<div class="empty">${stateLabel('EMPTY')}</div>`;
  if (lastState === 'DENIED' || lastState === 'ERROR' || lastState === 'UNKNOWN_STALE') {
    list.innerHTML = `<div class="empty">${stateLabel(lastState)}</div>` + activities.map(renderActivity).join('');
  }
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
  return `
    <section class="logistics-scheduling-workspace" aria-label="Logistics scheduling">
      <div class="logistics-workspace-head">
        <div><h3 style="margin:0;">${t('logisticsSchedulingTitle')}</h3><div class="logistics-meta">${t('logisticsSchedulingHint')}</div></div>
        <button type="button" class="btn-secondary" id="logistics-scheduling-refresh">${t('logisticsSchedulingRefresh')}</button>
      </div>
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
    const response = await fetch(endpoint() + (query.size ? `?${query}` : ''), { headers: authHeaders() });
    const data = await response.json().catch(() => ({}));
    if (sequence !== refreshSequence) return;
    if (response.status === 401 || response.status === 403) {
      lastState = 'DENIED';
      renderWorkspace(root);
      return;
    }
    if (!response.ok) throw new Error(data?.error?.message || `Scheduling request failed (${response.status})`);
    activities = Array.isArray(data.activities) ? data.activities : [];
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
  const values = new FormData(form);
  const referenceType = String(values.get('referenceType') || 'fulfillment');
  const referenceId = String(values.get('referenceId') || '').trim();
  const startValue = String(values.get('requestedStart') || '');
  const endValue = String(values.get('requestedEnd') || '');
  const mode = String(values.get('mode') || 'WINDOWED');
  const body = {
    activity_type: String(values.get('activityType') || 'DELIVERY'),
    mode,
    location_id: schedulingLocationId(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    requested_start: startValue ? new Date(startValue).toISOString() : null,
    requested_end: endValue ? new Date(endValue).toISOString() : null,
    [`related_${referenceType}`]: { id: referenceId },
  };
  if (mode === 'WINDOWED' && (!body.requested_start || !body.requested_end)) {
    lastState = 'ERROR';
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
  const response = await fetch(endpoint(activityId) + '/evaluate', {
    method: 'POST', headers: authHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data?.error?.message || `Evaluation failed (${response.status})`), { status: response.status });
  const evaluation = data?.evaluation?.evaluation || 'UNKNOWN';
  const item = activities.find(activity => String(activity.id) === String(activityId));
  if (item) item.lastEvaluation = evaluation;
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
  const activity = activities.find(item => String(item.id) === String(activityId));
  if (!activity) return;
  const startInput = root.querySelector(`[data-scheduled-start="${CSS.escape(String(activityId))}"]`);
  const endInput = root.querySelector(`[data-scheduled-end="${CSS.escape(String(activityId))}"]`);
  const body = { status: target, expectedVersion: activity.version };
  if (target === 'SCHEDULED') {
    if (!startInput?.value || !endInput?.value) {
      lastState = 'ERROR';
      renderWorkspace(root);
      return;
    }
    body.scheduledStart = new Date(startInput.value).toISOString();
    body.scheduledEnd = new Date(endInput.value).toISOString();
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
  if (updated) activities = activities.map(item => String(item.id) === String(activityId) ? updated : item);
  await refresh(root);
}

export function mountLogisticsSchedulingWorkspace(root) {
  if (!root) return;
  const shouldBind = root.dataset.schedulingWorkspaceBound !== '1';
  if (shouldBind) {
    root.dataset.schedulingWorkspaceBound = '1';
    root.addEventListener('click', async event => {
    const refreshButton = event.target.closest('#logistics-scheduling-refresh');
    const evaluateButton = event.target.closest('[data-scheduling-evaluate]');
    const transitionButton = event.target.closest('[data-scheduling-transition]');
    try {
      if (refreshButton) await refresh(root);
      else if (evaluateButton) await evaluateActivity(root, evaluateButton.dataset.schedulingEvaluate);
      else if (transitionButton) await transitionActivity(root, transitionButton.dataset.activityId, transitionButton.dataset.schedulingTransition, transitionButton);
    } catch (error) {
      if (error?.code === 'SCHEDULING_FEASIBILITY_UNKNOWN') {
        lastState = 'READY';
        feedback = t('logisticsSchedulingBlockedUnknown');
      } else if (error?.code === 'SCHEDULING_FEASIBILITY_CONFLICT') {
        lastState = 'READY';
        feedback = t('logisticsSchedulingBlockedConflict');
      } else {
        lastState = error?.status === 401 || error?.status === 403 ? 'DENIED' : error?.status && error.status < 500 ? 'ERROR' : 'UNKNOWN_STALE';
        feedback = error?.message || '';
      }
      renderWorkspace(root);
    }
  });
  root.addEventListener('input', event => {
    if (event.target?.closest('#logisticsSchedulingRequestForm')) {
      pendingRequestKey = null;
      pendingRequestFingerprint = '';
    }
    const activityId = event.target?.dataset?.scheduledStart || event.target?.dataset?.scheduledEnd;
    if (activityId) {
      for (const key of pendingTransitionKeys.keys()) {
        if (key.startsWith(`${activityId}:SCHEDULED:`)) pendingTransitionKeys.delete(key);
      }
    }
  });
  root.addEventListener('submit', async event => {
    if (event.target?.id !== 'logisticsSchedulingRequestForm') return;
    event.preventDefault();
    try { await submitRequest(root, event.target); }
    catch (error) { lastState = error?.status === 401 || error?.status === 403 ? 'DENIED' : error?.status && error.status < 500 ? 'ERROR' : 'UNKNOWN_STALE'; renderWorkspace(root); }
  });
  }
  const statusNode = root.querySelector('#logisticsSchedulingStatus');
  if (statusNode && statusNode !== mountedStatusNode) {
    mountedStatusNode = statusNode;
    renderWorkspace(root);
    refresh(root);
  }
}
