// P1-IMPLEMENTATION-08 — IAM certification and trace matrix.
// Read-only certification evidence composed from the existing canonical
// authorization, Pack-role reconciliation, scope, approval and audit contracts.
// This module never creates or evaluates authorization decisions.
import { config, currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';
import { PACK_ROLE_RECONCILIATION } from './role-reconciliation.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}

function statusFor(row) {
  if (row.status === 'MAP') return 'MAPPED_TO_CANONICAL_ROLE';
  if (row.status === 'EXISTING') return 'CANONICAL_ROLE';
  if (row.status === 'EXTEND') return 'REQUIRES_CANONICAL_POLICY_EXTENSION';
  if (row.status === 'NEW') return 'REQUIRES_NEW_CANONICAL_ROLE';
  return 'DEFERRED';
}

export async function renderIamCertificationPanel(containerId = 'iamCertificationPanel') {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!config.sessionToken || !config.chatId) {
    container.innerHTML = '<div class="hint">UNKNOWN — an authenticated tenant session is required to load IAM certification evidence.</div>';
    return;
  }
  if (!hasPermission(currentStaff?.role || '', 'settings:configure')) {
    container.innerHTML = '<div class="hint">PERMISSION_DENIED — IAM certification evidence is restricted to an authorized administrator.</div>';
    return;
  }
  container.innerHTML = '<div class="hint">LOADING — reading canonical IAM trace evidence…</div>';
  try {
    const base = String(config.syncUrl || '').replace(/\/$/, '');
    const response = await fetch(`${base}/tenants/${encodeURIComponent(config.chatId)}/authorization/iam-certification`, {
      headers: { Authorization: `Bearer ${config.sessionToken}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `HTTP ${response.status}`);
    const rows = Array.isArray(data.rows) ? data.rows : [];
    const counts = rows.reduce((acc, row) => { acc[row.status] = (acc[row.status] || 0) + 1; return acc; }, {});
    container.innerHTML = `
      <div class="settings-section-label" style="margin-top:16px;">IAM certification &amp; trace matrix</div>
      <div class="hint">Read-only conformance evidence. The canonical server authorization path remains the only authorization authority.</div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
        ${['EXISTING','MAP','EXTEND','NEW','DEFERRED'].map(s => `<span class="status-badge">${esc(s)} · ${Number(counts[s] || 0)}</span>`).join('')}
      </div>
      <div style="overflow:auto;margin-top:10px;">
        <table style="width:100%;border-collapse:collapse;min-width:1250px;">
          <thead><tr>
            <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Pack</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Role</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Status</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Canonical role</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Permission evidence</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Scope</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Conditions / approval</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">UI affordance</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Server enforcement</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Audit / event</th>
          </tr></thead>
          <tbody>${rows.map(row => `<tr>
            <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${esc(row.pack)}</td>
            <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);"><strong>${esc(row.role)}</strong></td>
            <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);"><span class="status-badge">${esc(row.status)}</span><div class="hint">${esc(statusFor(row))}</div></td>
            <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${esc(row.canonicalRole || '—')}</td>
            <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${esc(row.permissionEvidence)}</td>
            <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${esc(row.scope)}</td>
            <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${esc(row.conditionsApproval)}</td>
            <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${esc(row.uiAffordance)}</td>
            <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${esc(row.serverEnforcement)}</td>
            <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${esc(row.auditEvent)}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
      <div class="hint" style="margin-top:10px;">Certification rule: Role → Permission → Scope → Condition/Approval → UI affordance → Server enforcement → Audit/event. A target role is not executable merely because it appears in the product model.</div>
      <div class="hint" style="margin-top:6px;">${esc(data.membershipRoleChangeGap)}</div>
      <div class="hint" style="margin-top:6px;">Authority: ${esc(data.authority)} · persistence: ${esc(data.persistence)} · evaluator: ${esc(data.evaluator)}</div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="hint">FAILURE — ${esc(error?.message || 'Unable to load IAM certification evidence.')}</div>`;
  }
}

export { PACK_ROLE_RECONCILIATION };
