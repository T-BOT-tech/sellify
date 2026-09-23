// P1-IMPLEMENTATION-06 — Conditions & Approval Boundaries.
// Read-only productization of the existing canonical enforcement contracts.
import { config, currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

export async function renderConditionsApprovalPanel(containerId = 'conditionsApprovalPanel') {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!config.sessionToken || !config.chatId) {
    container.innerHTML = '<div class="hint">UNKNOWN — an authenticated tenant session is required.</div>';
    return;
  }
  if (!hasPermission(currentStaff?.role || '', 'settings:configure')) {
    container.innerHTML = '<div class="hint">PERMISSION_DENIED — this contract is restricted to an authorized administrator.</div>';
    return;
  }
  container.innerHTML = '<div class="hint">LOADING — reading canonical conditions and approval boundaries…</div>';
  try {
    const base = String(config.syncUrl || '').replace(/\/$/, '');
    const response = await fetch(`${base}/tenants/${encodeURIComponent(config.chatId)}/authorization/conditions-contract`, {
      headers: { Authorization: `Bearer ${config.sessionToken}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `HTTP ${response.status}`);
    container.innerHTML = `
      <div class="settings-section-label" style="margin-top:16px;">Conditions &amp; approval boundaries</div>
      <div class="hint">Read-only contract view. Authorization remains canonical server policy; this surface never grants approval or permission.</div>
      <div style="margin-top:8px;">
        ${(data.conditionModel || []).map(item => `<div style="padding:9px;border-bottom:1px solid var(--line);"><strong>${esc(item.id)}</strong> · ${esc(item.status)}<div class="hint">Authority: ${esc(item.authority)}</div></div>`).join('')}
      </div>
      <div class="hint" style="margin-top:10px;">Decision vocabulary: ${(data.decisionVocabulary || []).map(esc).join(' · ')}</div>
      <div class="hint" style="margin-top:6px;">Approval authority: ${esc(data.approval?.approval_authority || '—')}</div>
      <div class="hint" style="margin-top:6px;">Approval evidence: ${(data.approval?.approval_evidence || []).map(esc).join(', ') || '—'}</div>
      <div class="hint" style="margin-top:6px;">Persistence: ${esc(data.approval?.persistence || '—')} · Approval store: ${esc(data.approval?.approval_store || '—')}</div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="hint">FAILURE — ${esc(error?.message || 'Unable to load conditions and approval boundaries.')}</div>`;
  }
}
