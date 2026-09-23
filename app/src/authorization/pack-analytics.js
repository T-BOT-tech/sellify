// P1-19 — Pack Analytics & Product Telemetry UX.
// Read-only analytical projection over the existing canonical audit stream.
// This module does not create telemetry records, analytics tables, event types,
// or a second measurement authority.
import { config, currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function requestAudit(limit = 500) {
  const response = await fetch(`/tenants/${encodeURIComponent(config.chatId)}/audit?limit=${limit}`, {
    headers: { Authorization: `Bearer ${config.sessionToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `HTTP ${response.status}`);
  return Array.isArray(payload.events) ? payload.events : [];
}

function isPackSignal(event) {
  const haystack = [event?.action, event?.entityType, event?.entityId, JSON.stringify(event?.metadata || {})].join(' ').toLowerCase();
  return /(pack|entitlement|readiness|capability)/.test(haystack);
}

function outcome(event) {
  const result = String(event?.result || 'success').toLowerCase();
  if (result === 'failure' || result === 'denied') return 'FAILURE';
  if (result === 'unknown') return 'UNKNOWN';
  return 'SUCCESS';
}

export async function renderPackAnalyticsPanel(containerId = 'packAnalyticsPanel') {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = '<div class="settings-section-label">Pack analytics &amp; product telemetry</div><div class="hint">Loading canonical evidence…</div>';

  if (!config.sessionToken || !config.chatId) {
    wrap.innerHTML = '<div class="settings-section-label">Pack analytics &amp; product telemetry</div><div class="status">UNKNOWN — no authenticated business session.</div>';
    return;
  }
  if (!hasPermission(currentStaff.role, 'audit:view')) {
    wrap.innerHTML = '<div class="settings-section-label">Pack analytics &amp; product telemetry</div><div class="status">PERMISSION_DENIED — audit:view is required.</div>';
    return;
  }
  if (!navigator.onLine) {
    wrap.innerHTML = '<div class="settings-section-label">Pack analytics &amp; product telemetry</div><div class="status">UNKNOWN — canonical evidence cannot be confirmed while offline.</div>';
    return;
  }

  let events;
  try {
    events = await requestAudit();
  } catch (error) {
    wrap.innerHTML = `<div class="settings-section-label">Pack analytics &amp; product telemetry</div><div class="status">PROVIDER_UNAVAILABLE — canonical evidence could not be read.</div><div class="hint">${esc(error.message)}</div>`;
    return;
  }

  const signals = events.filter(isPackSignal);
  const counts = { SUCCESS: 0, FAILURE: 0, UNKNOWN: 0 };
  const actions = new Map();
  signals.forEach(event => {
    const state = outcome(event);
    counts[state] += 1;
    const action = String(event.action || 'unknown');
    actions.set(action, (actions.get(action) || 0) + 1);
  });
  const topActions = [...actions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  wrap.innerHTML = `
    <div class="settings-section-label">Pack analytics &amp; product telemetry</div>
    <div class="hint">Read-only product evidence derived from the existing canonical audit stream. This surface measures observed outcomes; it does not create telemetry, authorize actions, or become a transaction/event authority.</div>
    <div class="status">SUCCESS — ${signals.length} Pack/IAM-related signal${signals.length === 1 ? '' : 's'} observed in the latest ${events.length} canonical audit records.</div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px">
      <div class="card"><strong>${counts.SUCCESS}</strong><div class="hint">Successful outcomes</div></div>
      <div class="card"><strong>${counts.FAILURE}</strong><div class="hint">Failed/denied outcomes</div></div>
      <div class="card"><strong>${counts.UNKNOWN}</strong><div class="hint">Unknown outcomes</div></div>
    </div>
    <div style="margin-top:12px"><strong>Observed actions</strong>${topActions.length ? `<ul>${topActions.map(([action,count]) => `<li><code>${esc(action)}</code> — ${count}</li>`).join('')}</ul>` : '<div class="hint" style="margin-top:6px">No Pack/IAM analytics evidence is currently present. No synthetic telemetry is generated.</div>'}</div>
    <div class="hint" style="margin-top:8px">Counts are descriptive evidence from the current audit window, not performance guarantees, authorization decisions, or business KPIs.</div>`;
}
