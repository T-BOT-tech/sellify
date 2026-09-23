// P1-IMPLEMENTATION-07 — Approval / Delegation UX.
// Productizes existing approval-capable business actions without creating a
// new approval workflow, delegation store, or authorization authority.
import { config, currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

async function request(path) {
  const base = String(config.syncUrl || '').replace(/\/$/, '');
  const response = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${config.sessionToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `HTTP ${response.status}`);
  return data;
}

export async function renderApprovalDelegationPanel(containerId = 'approvalDelegationPanel') {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!config.sessionToken || !config.chatId) {
    container.innerHTML = '<div class="hint">UNKNOWN — an authenticated tenant session is required.</div>';
    return;
  }

  const role = String(currentStaff?.role || '').toLowerCase();
  const canApprove = hasPermission(role, 'b2b:po:approve');
  container.innerHTML = '<div class="hint">LOADING — reading existing approval-capable work…</div>';

  try {
    const data = await request(`/tenants/${encodeURIComponent(config.chatId)}/b2b/purchase-orders?status=SUBMITTED&limit=100`);
    const purchaseOrders = Array.isArray(data.purchaseOrders) ? data.purchaseOrders : [];
    const procurementOrders = purchaseOrders.filter(po => String(po.sourceType || po.source_type || '').toUpperCase() === 'PROCUREMENT_AWARD');

    container.innerHTML = `
      <div class="settings-section-label" style="margin-top:16px;">Approval &amp; delegation</div>
      <div class="hint">This surface exposes existing approval-capable work. It does not create approval evidence, assign approvers, or grant authorization.</div>
      <div style="margin-top:8px;padding:10px;border:1px solid var(--line);border-radius:8px;">
        <strong>Current approval capability</strong>
        <div class="hint" style="margin-top:4px;">${canApprove ? 'This session has the canonical b2b:po:approve permission.' : 'This session does not have the canonical b2b:po:approve permission.'}</div>
      </div>
      <div style="margin-top:10px;">
        <strong>Submitted procurement purchase orders</strong>
        ${procurementOrders.length ? procurementOrders.map(po => `
          <div style="padding:9px;border-bottom:1px solid var(--line);">
            <div><strong>${esc(po.poNumber || po.id)}</strong> · ${esc(po.status || 'SUBMITTED')}</div>
            <div class="hint">Award ${esc(po.procurementAwardId || po.procurement_award_id || '—')} · ${esc(po.currency || '')} ${Number(po.totalMinor || 0).toLocaleString()}</div>
            ${canApprove ? `<div class="hint" style="margin-top:4px;">Approval action is available in the Procurement purchase-order workflow; server authorization remains authoritative.</div>` : ''}
          </div>`).join('') : '<div class="hint" style="margin-top:6px;">No submitted procurement purchase orders are currently visible.</div>'}
      </div>
      <div style="margin-top:10px;padding:10px;border:1px solid var(--line);border-radius:8px;">
        <strong>Delegation</strong>
        <div class="hint" style="margin-top:4px;">No canonical delegation workflow/store is established by the current source. Delegation is therefore not presented as an executable action.</div>
      </div>
      <div class="hint" style="margin-top:10px;">Approval evidence remains the existing boundary contract: status, approvedBy, approvedAt. UI state never substitutes for server authorization or canonical mutation.</div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="hint">FAILURE — ${esc(error?.message || 'Unable to load approval-capable work.')}</div>`;
  }
}
