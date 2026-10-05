import { config, currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';
import { escapeHtml } from '../utils/index.js';

const base = () => (config.syncUrl || window.location.origin).replace(/\/$/, '');
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${config.sessionToken || ''}` });

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
  const requestChatId = config.chatId;
  const requestSessionToken = config.sessionToken;
  try {
    const query = auditQuery();
    const data = await request(`/tenants/${encodeURIComponent(requestChatId)}/audit?${query}`);
    if (config.chatId !== requestChatId || config.sessionToken !== requestSessionToken) return;
    const rows = Array.isArray(data?.events) ? data.events : [];
    list.innerHTML = rows.length ? rows.map(row => {
      const metadata = row.metadata && typeof row.metadata === 'object'
        ? JSON.stringify(row.metadata, null, 2) : '{}';
      const summary = `${row.action || 'event'} · ${row.result || 'success'} · ${row.createdAt || ''}`;
      return `<details style="padding:8px 0;border-bottom:1px solid var(--line);">
        <summary style="cursor:pointer;">${escapeHtml(summary)}</summary>
        <div class="hint" style="margin-top:6px;">Actor: ${escapeHtml(row.actorId || '—')} · Device: ${escapeHtml(row.deviceId || '—')} · Location: ${escapeHtml(row.locationId || '—')}</div>
        <div class="hint">Entity: ${escapeHtml(row.entityType || '—')} · ${escapeHtml(row.entityId || '—')}</div>
        ${row.reason ? `<div class="hint">Reason: ${escapeHtml(row.reason)}</div>` : ''}
        <pre style="white-space:pre-wrap;word-break:break-word;margin:6px 0 0;">${escapeHtml(metadata)}</pre>
      </details>`;
    }).join('') : '<div class="hint">No audit events match these filters.</div>';
    status.textContent = `Audit history loaded · ${rows.length} event${rows.length === 1 ? '' : 's'}.`;
  } catch (error) {
    list.innerHTML = '';
    showAuditError(error);
  }
}

function showAuditError(error) {
  const status = document.getElementById('auditStatus');
  if (status) status.textContent = error?.message || 'Audit history could not be loaded.';
}

export async function renderCompliancePanel() {
  const panel = document.getElementById('compliancePanel');
  if (!panel) return;
  if (!allowed()) {
    panel.innerHTML = '';
    return;
  }
  panel.innerHTML = '<div class="settings-section-label">Compliance & audit</div><div class="hint">Privacy requests, retention policy, and audited data exports are handled by the canonical backend. Audit history is read-only and tenant-scoped.</div><div id="complianceStatus" class="hint">Loading…</div><div id="complianceRequests"></div><div style="display:flex;gap:8px;align-items:center;margin-top:10px;"><label>Audit retention days <input id="complianceRetentionDays" type="number" min="30" max="3650" step="1" style="width:110px;"></label><button type="button" class="btn-secondary" id="complianceRetentionSave">Save retention</button></div><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;"><button type="button" class="btn-secondary" id="complianceNewRequest">New customer deletion request</button><button type="button" class="btn-secondary" id="complianceRefresh">Refresh</button><button type="button" class="btn-secondary" id="complianceExport">Export organization data</button></div><div style="margin-top:16px;"><div style="font-weight:600;">Audit history</div><div class="hint">Filter canonical audit events by action, actor, or entity type. Opening this history is itself audited by the backend.</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;"><input id="auditAction" placeholder="Action" style="flex:1;min-width:120px;"><input id="auditActorId" placeholder="Actor ID" style="flex:1;min-width:120px;"><input id="auditEntityType" placeholder="Entity type" style="flex:1;min-width:120px;"><input id="auditLimit" type="number" min="1" max="500" value="100" style="width:80px;"><button type="button" class="btn-secondary" id="auditRefresh">Refresh audit</button></div><div id="auditStatus" class="hint" style="margin-top:6px;"></div><div id="auditEvents" style="margin-top:4px;"></div></div>';
  document.getElementById('complianceRefresh').onclick = () => loadComplianceRequests();
  document.getElementById('auditRefresh').onclick = () => loadAuditEvents();
  document.getElementById('complianceNewRequest').onclick = () => createComplianceRequest().catch(showComplianceError);
  document.getElementById('complianceExport').onclick = () => exportCompliance('organization').catch(showComplianceError);
  document.getElementById('complianceRetentionSave').onclick = () => saveRetentionPolicy().catch(showComplianceError);
  const panelChatId = config.chatId;
  const panelSessionToken = config.sessionToken;
  await Promise.all([
    loadComplianceRequests(),
    loadRetentionPolicy(),
    auditAllowed() ? loadAuditEvents() : Promise.resolve(),
  ]);
  if (config.chatId !== panelChatId || config.sessionToken !== panelSessionToken) return;
}

async function loadRetentionPolicy() {
  const input = document.getElementById('complianceRetentionDays');
  if (!input || !allowed()) return;
  const requestChatId = config.chatId;
  const requestSessionToken = config.sessionToken;
  try {
    const data = await request(`/tenants/${encodeURIComponent(requestChatId)}/compliance/retention`);
    if (config.chatId !== requestChatId || config.sessionToken !== requestSessionToken) return;
    const retentionDays = Number(data?.policy?.retentionDays);
    if (!Number.isInteger(retentionDays) || retentionDays < 30 || retentionDays > 3650) {
      throw new Error('Backend returned an invalid audit retention policy.');
    }
    input.value = retentionDays;
  } catch (error) {
    if (config.chatId === requestChatId && config.sessionToken === requestSessionToken) showComplianceError(error);
  }
}

async function saveRetentionPolicy() {
  const input = document.getElementById('complianceRetentionDays');
  if (!input || !allowed()) return;
  const parsed = Number(input.value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 30 || parsed > 3650) {
    throw new Error('Retention must be a whole number from 30 to 3650 days.');
  }
  const retentionDays = parsed;
  const requestChatId = config.chatId;
  const requestSessionToken = config.sessionToken;
  try {
    await request(`/tenants/${encodeURIComponent(requestChatId)}/compliance/retention`, {
      method: 'PATCH',
      body: JSON.stringify({ retentionDays }),
    });
    if (config.chatId !== requestChatId || config.sessionToken !== requestSessionToken) return;
    input.value = retentionDays;
    const status = document.getElementById('complianceStatus');
    if (status) status.textContent = 'Audit retention policy saved.';
  } catch (error) {
    input.value = '';
    throw error;
  }
}

async function createComplianceRequest() {
  if (!allowed()) throw new Error('Compliance management permission required.');
  const customerId = window.prompt('Customer ID for the deletion request:')?.trim();
  if (!customerId) return;
  const requestChatId = config.chatId;
  const requestSessionToken = config.sessionToken;
  await request(`/tenants/${encodeURIComponent(requestChatId)}/compliance/requests`, {
    method: 'POST',
    body: JSON.stringify({
      requestType: 'DELETION',
      subjectType: 'customer',
      subjectId: customerId,
      reason: 'Customer privacy request',
    }),
  });
  if (config.chatId !== requestChatId || config.sessionToken !== requestSessionToken) return;
  await loadComplianceRequests();
}

async function loadComplianceRequests() {
  const status = document.getElementById('complianceStatus');
  const list = document.getElementById('complianceRequests');
  if (!status || !list || !allowed()) return;
  status.textContent = 'Loading compliance requests…';
  const requestChatId = config.chatId;
  const requestSessionToken = config.sessionToken;
  try {
    const data = await request(`/tenants/${encodeURIComponent(requestChatId)}/compliance/requests?limit=100`);
    if (config.chatId !== requestChatId || config.sessionToken !== requestSessionToken) return;
    const rows = data.requests || [];
    list.innerHTML = rows.length ? rows.map(row => `<div style="padding:10px 0;border-bottom:1px solid var(--line);">
      <div style="font-weight:600;">${escapeHtml(row.requestType || 'REQUEST')} · ${escapeHtml(row.status || '')}</div>
      <div class="hint">${escapeHtml(row.subjectType || '')} · ${escapeHtml(row.subjectId || '')}</div>
      ${row.reason ? `<div class="hint">${escapeHtml(row.reason)}</div>` : ''}
      ${row.status === 'pending' ? `<div style="display:flex;gap:6px;margin-top:6px;"><button type="button" class="btn-secondary" data-compliance-status="approved" data-request-id="${escapeHtml(row.id)}">Approve</button><button type="button" class="btn-secondary" data-compliance-status="rejected" data-request-id="${escapeHtml(row.id)}">Reject</button></div>` : ''}
    </div>`).join('') : '<div class="hint">No compliance requests.</div>';
    status.textContent = 'Compliance data loaded.';
    list.querySelectorAll('[data-compliance-status]').forEach(button => {
      button.onclick = async () => {
        if (button.disabled || !allowed()) return;
        const requestId = button.dataset.requestId;
        const nextStatus = button.dataset.complianceStatus;
        const requestChatId = config.chatId;
        const requestSessionToken = config.sessionToken;
        const buttons = list.querySelectorAll(`[data-request-id="${CSS.escape(requestId)}"]`);
        buttons.forEach(control => { control.disabled = true; });
        try {
          await request(`/tenants/${encodeURIComponent(requestChatId)}/compliance/requests`, {
            method: 'PATCH',
            body: JSON.stringify({ requestId, status: nextStatus, resolutionNote: 'Reviewed in Sellify Settings' }),
          });
          if (config.chatId !== requestChatId || config.sessionToken !== requestSessionToken) return;
          await loadComplianceRequests();
        } catch (error) {
          if (config.chatId === requestChatId && config.sessionToken === requestSessionToken) {
            buttons.forEach(control => { control.disabled = false; });
            showComplianceError(error);
          }
        }
      };
    });
  } catch (error) {
    // Never leave previously loaded compliance decisions visible after a
    // failed refresh; the backend is the authority and stale approvals are
    // unsafe to present as current state.
    list.innerHTML = '';
    showComplianceError(error);
  }
}

async function exportCompliance(subjectType, subjectId = null) {
  if (!allowed()) throw new Error('Compliance management permission required.');
  const requestChatId = config.chatId;
  const requestSessionToken = config.sessionToken;
  const path = subjectId
    ? `/tenants/${encodeURIComponent(requestChatId)}/compliance/export/${encodeURIComponent(subjectType)}/${encodeURIComponent(subjectId)}`
    : `/tenants/${encodeURIComponent(requestChatId)}/compliance/export/${encodeURIComponent(subjectType)}`;
  const data = await request(path);
  if (config.chatId !== requestChatId || config.sessionToken !== requestSessionToken) return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sellify-compliance-${subjectType}-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  const status = document.getElementById('complianceStatus');
  if (status) status.textContent = 'Compliance export generated and audited.';
  if (auditAllowed()) loadAuditEvents().catch(() => {});
}

function showComplianceError(error) {
  const status = document.getElementById('complianceStatus');
  if (status) status.textContent = error?.message || 'Compliance operation failed.';
}

export function bindCompliancePanel() {}
