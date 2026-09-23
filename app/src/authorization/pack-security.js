// P1-IMPLEMENTATION-16 — Pack Security & Sensitive-Action UX.
// Read-only security projection over the existing authorization, scope,
// conditions/approval, and audit authorities. This module never authorizes,
// mutates Pack state, creates approval evidence, or becomes a policy engine.
import { config, currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

const SENSITIVE_PACK_ACTIONS = Object.freeze([
  { id: 'pack_configuration', label: 'Pack configuration', permission: 'settings:configure', approval: 'Canonical conditions/approval boundary may apply to mutation.' },
  { id: 'location_management', label: 'Location management', permission: 'locations:manage', approval: 'Existing location policy and server enforcement apply.' },
  { id: 'purchase_order_approval', label: 'Procurement purchase-order approval', permission: 'b2b:po:approve', approval: 'Existing approval evidence contract: status, approvedBy, approvedAt.' },
  { id: 'audit_access', label: 'Audit evidence', permission: 'audit:view', approval: 'Read-only evidence; audit access does not grant Pack authority.' },
]);

export function packSecurityContract(role = currentStaff?.role || '') {
  const normalizedRole = String(role || '').toLowerCase();
  return {
    authority: 'backend/lib/authorization.js',
    scopeAuthority: 'existing organization/location/resource authorization boundaries',
    approvalAuthority: 'existing backend/lib/vertical-approval-boundary.js where applicable',
    auditAuthority: 'existing audit_events / recordAuditEvent()',
    uiIsNotAuthorization: true,
    sensitiveActions: SENSITIVE_PACK_ACTIONS.map(action => ({
      ...action,
      authorized: hasPermission(normalizedRole, action.permission),
    })),
    states: Object.freeze(['UNKNOWN', 'PERMISSION_DENIED', 'REQUIRES_APPROVAL', 'SUCCESS', 'FAILURE']),
  };
}

export function renderPackSecurityPanel(containerId = 'packSecurityPanel') {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;

  if (!config.sessionToken || !config.chatId) {
    wrap.innerHTML = '<div class="settings-section-label">Pack security &amp; sensitive actions</div><div class="status">UNKNOWN — an authenticated business session is required.</div>';
    return;
  }

  const contract = packSecurityContract();
  const rows = contract.sensitiveActions.map(action => `
    <tr>
      <td>${esc(action.label)}</td>
      <td><code>${esc(action.permission)}</code></td>
      <td>${action.authorized ? '<strong>AUTHORIZED BY CURRENT ROLE</strong>' : 'PERMISSION_DENIED'}</td>
      <td>${esc(action.approval)}</td>
    </tr>`).join('');

  wrap.innerHTML = `
    <div class="settings-section-label" style="margin-top:16px;">Pack security &amp; sensitive actions</div>
    <div class="hint">Read-only security evidence. The UI never grants authorization, creates approval evidence, or mutates Pack state.</div>
    <div class="status">SUCCESS — canonical security policy is <code>${esc(contract.authority)}</code>.</div>
    <div style="overflow:auto;margin-top:8px">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr><th>Action</th><th>Canonical permission</th><th>Current role</th><th>Boundary</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="hint" style="margin-top:10px"><strong>Sensitive-action rule:</strong> permission visibility is not execution authority. Scope, contextual conditions, approval requirements, canonical mutation, and audit evidence remain server-side.</div>
    <div class="hint" style="margin-top:6px">Offline or uncertain transport must remain <strong>UNKNOWN</strong>; it must never be rendered as successful authorization or execution.</div>
  `;
}
