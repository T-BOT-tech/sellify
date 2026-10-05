import { config, currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';
import { escapeHtml } from '../utils/index.js';

const base = () => (config.syncUrl || window.location.origin).replace(/\/$/, '');
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${config.sessionToken || ''}` });

let complianceRequestLoadSequence = 0;
let auditLoadSequence = 0;
let retentionLoadSequence = 0;
let retentionSaveSequence = 0;

async function request(path, options = {}) {
  const res = await fetch(base() + path, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Request failed (${res.status})`);
  return data;
}

function allowed() {
  return Boolean(config.chatId && config.sessionToken && hasPermission(currentStaff?.role || config.tenantRole || 'owner', 'compliance:manage'));
}

function auditAllowed() {
  return Boolean(config.chatId && config.sessionToken && hasPermission(currentStaff?.role || config.tenantRole || 'owner', 'audit:view'));
}

function auditQuery() {
  const params = new URLSearchParams();
  const action = document.getElementById('auditAction')?.value?.trim();
  const actorId = document.getElementById('auditActorId')?.value?.trim();
  const entityType = document.getElementById('auditEntityType')?.value?.trim();
  const limit = document.getElementById('auditLimit')?.value?.trim() || '100';
  if (action) params.set('action', action);
  if (actorId) params.set('actor_id', actorId);
  if (entityType) params.set('entity_type', entityType);
  params.set('limit', String(Math.max(1, Math.min(500, Number(limit) || 100))));
  return params.toString();
}

async function loadAuditEvents() {
  const status = document.getElementById('auditStatus');
  const list = document.getElementById('auditEvents');
  if (!status || !list || !auditAllowed()) return;
  status.textContent = 'Loading audit history…';
  list.innerHTML = '<div class="hint">Loading…</div>';
  const loadSequence = ++auditLoadSequence;
  const requestChatId = config.chatId;
  const requestSessionToken = config.sessionToken;
  try {
    const query = auditQuery();
    const data = await request(`/tenants/${encodeURIComponent(requestChatId)}/audit?${query}`);
    if (loadSequence !== auditLoadSequence) return;
    if (config.chatId !== requestChatId || config.sessionToken !== requestSessionToken) return;
    const rows = Array.isArray(data?.events) ? data.events : [];
    list.innerHTML = rows.length ? rows.map(row => `<div style="padding:10px 0;border-bottom:1px solid var(--line);">
      <div style="font-weight:600;">${escapeHtml(row.requestType || 'REQUEST')} · ${escapeHtml(row.status || '')}</div>
      <div class="hint">${escapeHtml(row.subjectType || '')} · ${escapeHtml(row.subjectId || '')}</div>
      ${row.reason ? `<div class="hint">Reason: ${escapeHtml(row.reason)}</div>` : ''}
      ${row.resolutionNote ? `<div class="hint">Resolution: ${escapeHtml(row.resolutionNote)}</div>` : ''}
      <div class="hint">Created: ${escapeHtml(row.createdAt || '—')} · Updated: ${escapeHtml(row.updatedAt || '—')}</div>
      ${row.status === 'pending' ? `<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;"><button type="button" class="btn-secondary" data-compliance-status="approved" data-request-id="${escapeHtml(row.id)}">Approve</button><button type="button" class="btn-secondary" data-compliance-status="rejected" data-request-id="${escapeHtml(row.id)}">Reject</button><button type="button" class="btn-secondary" data-compliance-status="cancelled" data-request-id="${escapeHtml(row.id)}">Cancel</button></div>` : ''}
      ${row.status === 'approved' ? `<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;"><button type="button" class="btn-secondary" data-compliance-status="completed" data-request-id="${escapeHtml(row.id)}">Mark completed</button><button type="button" class="btn-secondary" data-compliance-status="cancelled" data-request-id="${escapeHtml(row.id)}">Cancel</button></div>` : ''}
    </div>`).join('') : '<div class="hint">No compliance requests.</div>';    status.textContent = 'Compliance requests loaded.';
    list.querySelectorAll('[data-compliance-status]').forEach(button => {
      button.onclick = async () => {
        if (button.disabled || !allowed()) return;
        const requestId = button.dataset.requestId?.trim();
        const nextStatus = button.dataset.complianceStatus?.trim().toLowerCase();
        if (!requestId || !['approved', 'rejected', 'cancelled', 'completed'].includes(nextStatus)) {
          return;
        }
        const requestChatId = config.chatId;
        const requestSessionToken = config.sessionToken;
        const buttons = list.querySelectorAll(`[data-request-id="${CSS.escape(requestId)}"]`);
        buttons.forEach(control => { control.disabled = true; });
        const requestStatus = document.createElement('span');
        requestStatus.className = 'hint';
        requestStatus.textContent = 'Updating…';
        buttons[buttons.length - 1]?.parentElement?.appendChild(requestStatus);
        try {
          await request(`/tenants/${encodeURIComponent(requestChatId)}/compliance/requests`, {
            method: 'PATCH',
            body: JSON.stringify({ requestId, status: nextStatus, resolutionNote: `Updated to ${nextStatus} in Sellify Settings` }),
          });
          if (config.chatId !== requestChatId || config.sessionToken !== requestSessionToken) return;
          await loadComplianceRequests();
        } catch (error) {
          if (config.chatId === requestChatId && config.sessionToken === requestSessionToken) {
            buttons.forEach(control => { control.disabled = false; });
            requestStatus.textContent = error?.message || 'Request update failed.';
          }
        }
      };
    });
  } catch (error) {
    // Never leave previously loaded compliance decisions visible after a
    // failed refresh; the backend is the authority and stale approvals are
    // unsafe to present as current state.
    if (loadSequence !== complianceRequestLoadSequence) return;
    list.innerHTML = '';
    status.textContent = error?.message || 'Compliance requests could not be loaded.';
  }
}

async function exportCompliance(subjectType, subjectId = null) {
  if (!allowed()) throw new Error('Compliance management permission required.');
  const normalizedSubjectType = String(subjectType || '').trim().toLowerCase();
  if (!['organization', 'customer'].includes(normalizedSubjectType)) {
    throw new Error('Unsupported compliance export subject.');
  }
  const normalizedSubjectId = subjectId == null ? null : String(subjectId).trim();
  if (normalizedSubjectType === 'customer' && !normalizedSubjectId) {
    throw new Error('Customer export requires a customer ID.');
  }
  const trigger = document.getElementById('complianceExport');
  if (trigger?.disabled) return;
  const requestChatId = config.chatId;
  const requestSessionToken = config.sessionToken;
  if (trigger) trigger.disabled = true;
  const path = normalizedSubjectId
    ? `/tenants/${encodeURIComponent(requestChatId)}/compliance/export/${encodeURIComponent(normalizedSubjectType)}/${encodeURIComponent(normalizedSubjectId)}`
    : `/tenants/${encodeURIComponent(requestChatId)}/compliance/export/${encodeURIComponent(normalizedSubjectType)}`;
  try {
    const data = await request(path);
    if (config.chatId !== requestChatId || config.sessionToken !== requestSessionToken) return;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Compliance export returned an invalid response.');
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = `sellify-compliance-${normalizedSubjectType}-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  const status = document.getElementById('complianceExportStatus');
  if (status) status.textContent = 'Compliance export generated and audited.';
    if (auditAllowed()) loadAuditEvents().catch(() => {});
  } finally {
    if (config.chatId === requestChatId && config.sessionToken === requestSessionToken && trigger) trigger.disabled = false;
  }
}

function showComplianceError(error) {
  const status = document.getElementById('complianceStatus');
  if (status) status.textContent = error?.message || 'Compliance operation failed.';
}

export function bindCompliancePanel() {}
