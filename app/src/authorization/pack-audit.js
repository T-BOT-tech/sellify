// P1-15 — Pack Audit & Observability UX.
// Read-only projection over the existing Core audit authority. This module
// never creates, mutates, or interprets a second audit/event store.
import { config, currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function requestAudit(limit = 200) {
  const response = await fetch(`/tenants/${encodeURIComponent(config.chatId)}/audit?limit=${limit}`, {
    headers: { Authorization: `Bearer ${config.sessionToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `HTTP ${response.status}`);
  return Array.isArray(payload.events) ? payload.events : [];
}

function isPackEvent(event) {
  const haystack = [event?.action, event?.entityType, event?.entityId, JSON.stringify(event?.metadata || {})].join(' ').toLowerCase();
  return /(pack|entitlement|readiness|capability)/.test(haystack);
}

export async function renderPackAuditPanel(containerId = 'packAuditPanel') {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = '<div class="settings-section-label">Pack audit &amp; observability</div><div class="hint">Loading canonical audit evidence…</div>';

  if (!config.sessionToken || !config.chatId) {
    wrap.innerHTML = '<div class="settings-section-label">Pack audit &amp; observability</div><div class="status">UNKNOWN — no authenticated business session.</div>';
    return;
  }
  if (!hasPermission(currentStaff.role, 'audit:view')) {
    wrap.innerHTML = '<div class="settings-section-label">Pack audit &amp; observability</div><div class="status">PERMISSION_DENIED — audit:view is required.</div>';
    return;
  }
  if (!navigator.onLine) {
    wrap.innerHTML = '<div class="settings-section-label">Pack audit &amp; observability</div><div class="status">UNKNOWN — audit evidence cannot be confirmed while offline.</div>';
    return;
  }

  let events;
  try {
    events = await requestAudit();
  } catch (error) {
    wrap.innerHTML = `<div class="settings-section-label">Pack audit &amp; observability</div><div class="status">PROVIDER_UNAVAILABLE — canonical audit authority could not be read.</div><div class="hint">${esc(error.message)}</div>`;
    return;
  }

  const packEvents = events.filter(isPackEvent);
  const rows = packEvents.slice(0, 30).map(event => `
    <tr>
      <td>${esc(event.createdAt ? new Date(event.createdAt).toLocaleString() : '—')}</td>
      <td>${esc(event.action || '—')}</td>
      <td>${esc(event.entityType || '—')}</td>
      <td>${esc(event.result || 'success')}</td>
      <td>${esc(event.locationId || '—')}</td>
      <td>${esc(event.reason || '—')}</td>
    </tr>`).join('');

  wrap.innerHTML = `
    <div class="settings-section-label">Pack audit &amp; observability</div>
    <div class="hint">Read-only evidence from the existing canonical <code>audit_events</code> authority. Audit evidence does not grant Pack entitlement or authorization.</div>
    <div class="status">SUCCESS — ${packEvents.length} Pack-related event${packEvents.length === 1 ? '' : 's'} found in the latest ${events.length} audit records.</div>
    ${packEvents.length ? `<div style="overflow:auto;margin-top:8px"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Result</th><th>Location</th><th>Reason</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="hint" style="margin-top:8px">No Pack lifecycle events are currently evidenced by the canonical audit stream. This UI does not invent Pack activation/deactivation events.</div>'}
    <div class="hint" style="margin-top:8px">Observability identifiers remain contextual evidence only; the existing audit/event authorities remain canonical.</div>`;
}
