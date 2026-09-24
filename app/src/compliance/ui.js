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

export async function renderCompliancePanel() {
  const panel = document.getElementById('compliancePanel');
  if (!panel) return;
  if (!allowed()) {
    panel.innerHTML = '';
    return;
  }
  panel.innerHTML = '<div class="settings-section-label">Compliance</div><div class="hint">Privacy requests, retention policy, and audited data exports are handled by the canonical backend.</div><div id="complianceStatus" class="hint">Loading…</div><div id="complianceRequests"></div><div style="display:flex;gap:8px;margin-top:8px;"><button type="button" class="btn-secondary" id="complianceNewRequest">New customer deletion request</button><button type="button" class="btn-secondary" id="complianceRefresh">Refresh</button><button type="button" class="btn-secondary" id="complianceExport">Export organization data</button></div>';
  document.getElementById('complianceRefresh').onclick = () => loadComplianceRequests();
  document.getElementById('complianceNewRequest').onclick = () => createComplianceRequest().catch(showComplianceError);
  document.getElementById('complianceExport').onclick = () => exportCompliance('organization').catch(showComplianceError);
  await loadComplianceRequests();
}

async function createComplianceRequest() {
  if (!allowed()) throw new Error('Compliance management permission required.');
  const customerId = window.prompt('Customer ID for the deletion request:');
  if (!customerId) return;
  await request(`/tenants/${encodeURIComponent(config.chatId)}/compliance/requests`, {
    method: 'POST',
    body: JSON.stringify({
      requestType: 'DELETION',
      subjectType: 'customer',
      subjectId: customerId.trim(),
      reason: 'Customer privacy request',
    }),
  });
  await loadComplianceRequests();
}

async function loadComplianceRequests() {
  const status = document.getElementById('complianceStatus');
  const list = document.getElementById('complianceRequests');
  if (!status || !list || !allowed()) return;
  status.textContent = 'Loading compliance requests…';
  try {
    const data = await request(`/tenants/${encodeURIComponent(config.chatId)}/compliance/requests?limit=100`);
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
        try {
          await request(`/tenants/${encodeURIComponent(config.chatId)}/compliance/requests`, {
            method: 'PATCH',
            body: JSON.stringify({ requestId: button.dataset.requestId, status: button.dataset.complianceStatus, resolutionNote: 'Reviewed in Sellify Settings' }),
          });
          await loadComplianceRequests();
        } catch (error) { showComplianceError(error); }
      };
    });
  } catch (error) { showComplianceError(error); }
}

async function exportCompliance(subjectType, subjectId = null) {
  const path = subjectId
    ? `/tenants/${encodeURIComponent(config.chatId)}/compliance/export/${encodeURIComponent(subjectType)}/${encodeURIComponent(subjectId)}`
    : `/tenants/${encodeURIComponent(config.chatId)}/compliance/export/${encodeURIComponent(subjectType)}`;
  const data = await request(path);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sellify-compliance-${subjectType}-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  const status = document.getElementById('complianceStatus');
  if (status) status.textContent = 'Compliance export generated and audited.';
}

function showComplianceError(error) {
  const status = document.getElementById('complianceStatus');
  if (status) status.textContent = error?.message || 'Compliance operation failed.';
}

export function bindCompliancePanel() {}
