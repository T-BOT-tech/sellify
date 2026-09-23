// FUX-2C / P1-05 — canonical scope and context administration surface.
// The backend remains the authority for organization/location scope and for
// location-management permission. This module only presents and selects the
// existing canonical context; it does not create a second scope authority.
import { config, setConfig } from '../state.js';
import { saveJSON } from '../storage/json.js';
import { STORAGE_KEYS } from '../constants.js';
import { selectOrganizationLocation } from '../warehouse/locations.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function baseUrl() { return String(config.syncUrl || '').replace(/\/$/, ''); }

async function readContext() {
  const response = await fetch(`${baseUrl()}/tenants/${encodeURIComponent(config.chatId)}/authorization/scope-context`, {
    headers: { Authorization: `Bearer ${config.sessionToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `HTTP ${response.status}`);
  return data;
}

function renderStatus(container, message) {
  container.innerHTML = `<div class="hint">${escapeHtml(message)}</div>`;
}

export async function renderScopeContextPanel(containerId = 'scopeContextPanel') {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!config.sessionToken || !config.chatId) {
    renderStatus(container, 'UNKNOWN — an authenticated tenant session is required to load scope context.');
    return;
  }
  renderStatus(container, 'LOADING — reading canonical organization and location context…');
  try {
    const data = await readContext();
    const locations = Array.isArray(data.locations) ? data.locations : [];
    const current = data.context?.location || null;
    const selectedId = data.context?.locationId || config.locationId || '';
    const canManage = !!data.capabilities?.manageLocations;

    container.innerHTML = `
      <div class="settings-section-label" style="margin-top:16px;">Scope &amp; context</div>
      <div class="hint">Canonical scope comes from the authenticated session, organization mapping, and existing location registry. Selecting a location changes client context; it does not grant authorization.</div>
      <div style="margin-top:10px;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2, var(--surface));">
        <div><strong>Organization</strong>: ${escapeHtml(data.organization?.id || 'UNKNOWN')}</div>
        <div style="margin-top:4px;"><strong>Actor role</strong>: ${escapeHtml(data.actor?.role || 'UNKNOWN')}</div>
        <div style="margin-top:4px;"><strong>Current location</strong>: ${escapeHtml(current?.name || selectedId || 'Organization-wide')}</div>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <label for="scopeContextLocation"><strong>Active location context</strong></label>
        <select id="scopeContextLocation" style="min-width:220px;max-width:100%;margin:0;">
          <option value="">Organization-wide / none</option>
          ${locations.filter(l => l.status === 'active').map(l => `<option value="${escapeHtml(l.id)}" ${String(l.id) === String(selectedId) ? 'selected' : ''}>${escapeHtml(l.name)} · ${escapeHtml(l.code)}</option>`).join('')}
        </select>
        <button type="button" class="btn-secondary" style="width:auto;margin:0;padding:8px 12px;" id="scopeContextApply">Use location</button>
      </div>
      <div class="hint" style="margin-top:8px;">${locations.length} canonical location record(s) visible. ${canManage ? 'This session may manage the location registry through the existing server capability.' : 'Location registry management is not authorized for this session.'}</div>
      <div style="overflow:auto;margin-top:10px;">
        <table style="width:100%;border-collapse:collapse;min-width:620px;">
          <thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Code</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Name</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Type</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Status</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Context</th></tr></thead>
          <tbody>${locations.map(l => `<tr><td style="padding:8px;border-bottom:1px solid var(--line);">${escapeHtml(l.code)}</td><td style="padding:8px;border-bottom:1px solid var(--line);">${escapeHtml(l.name)}</td><td style="padding:8px;border-bottom:1px solid var(--line);">${escapeHtml(l.type)}</td><td style="padding:8px;border-bottom:1px solid var(--line);">${escapeHtml(l.status)}</td><td style="padding:8px;border-bottom:1px solid var(--line);">${String(l.id) === String(selectedId) ? 'ACTIVE CONTEXT' : '—'}</td></tr>`).join('')}</tbody>
        </table>
      </div>
      ${canManage ? '<div class="hint" style="margin-top:8px;">Management uses the existing <code>/locations</code> endpoints and canonical <code>locations:manage</code> server authorization; this panel does not duplicate that authority.</div>' : ''}
    `;

    document.getElementById('scopeContextApply')?.addEventListener('click', () => {
      const value = document.getElementById('scopeContextLocation')?.value || '';
      if (!value) {
        const next = { ...config, locationId: '' };
        setConfig(next); saveJSON(STORAGE_KEYS.config, next);
        renderScopeContextPanel(containerId).catch(() => {});
        return;
      }
      const selected = selectOrganizationLocation(value);
      if (!selected) {
        renderStatus(container, 'FAILURE — that location is not an active canonical organization location.');
        return;
      }
      renderScopeContextPanel(containerId).catch(() => {});
    });
  } catch (error) {
    renderStatus(container, `FAILURE — ${error.message || 'scope context unavailable'}`);
  }
}
