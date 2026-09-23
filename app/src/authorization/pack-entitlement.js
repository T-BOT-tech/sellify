// P1-10 — Pack activation & role-entitlement UX.
// Read-only productization of existing Pack manifests/configuration and the
// canonical IAM reconciliation. It does not create Pack activation state,
// entitlement state, or a second authorization authority.
import { config, currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';
import { getVerticalPackConfiguration } from '../verticals/configuration.js';
import { AGRICULTURE_PACK } from '../verticals/agriculture/pack.js';
import { RESTAURANT_PACK } from '../verticals/restaurant/pack.js';
import { WAREHOUSE_PACK } from '../verticals/warehouse/pack.js';
import { LOGISTICS_PACK } from '../verticals/logistics/pack.js';
import { PACK_ROLE_RECONCILIATION } from './role-reconciliation.js';

const PACKS = Object.freeze([AGRICULTURE_PACK, RESTAURANT_PACK, WAREHOUSE_PACK, LOGISTICS_PACK]);
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function activationLabel(packId, result) {
  if (packId === 'agriculture') return 'DECLARATIVE_ONLY';
  return result.enabled ? 'ACTIVE_BY_EXISTING_CONFIG' : 'INACTIVE_BY_EXISTING_CONFIG';
}
function roleRows(packId) {
  return PACK_ROLE_RECONCILIATION.filter(row => String(row.pack || '').toLowerCase().replace(/\s*\/\s*pos/i, '').replace(/\s+/g, '-') === packId);
}

export function renderPackEntitlementPanel(containerId = 'packEntitlementPanel') {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!config.sessionToken || !config.chatId) { el.innerHTML = '<div class="hint">UNKNOWN — an authenticated tenant session is required.</div>'; return; }
  if (!hasPermission(currentStaff?.role || '', 'settings:configure')) { el.innerHTML = '<div class="hint">PERMISSION_DENIED — Pack entitlement evidence is restricted to an authorized administrator.</div>'; return; }

  const verticals = PACKS.map(pack => {
    const resolved = getVerticalPackConfiguration({
      packId: pack.pack_id,
      config,
      organizationId: config.organizationId || null,
      locationId: config.locationId || null,
    });
    return { pack, resolved, roles: roleRows(pack.pack_id) };
  });

  el.innerHTML = `
    <div class="settings-section-label" style="margin-top:16px;">Pack activation &amp; role entitlement</div>
    <div class="hint">Read-only composition evidence. Pack configuration does not grant user authorization; canonical server authorization remains authoritative.</div>
    <div style="overflow:auto;margin-top:10px;">
      <table style="width:100%;border-collapse:collapse;min-width:1100px;">
        <thead><tr>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Pack</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Version</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Activation/config state</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Capabilities</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Pack permissions</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Target roles</th>
        </tr></thead>
        <tbody>${verticals.map(({ pack, resolved, roles }) => `<tr>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);"><strong>${esc(pack.name)}</strong><div class="hint">${esc(pack.pack_id)}</div></td>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${esc(pack.version)}</td>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);"><span class="status-badge">${esc(activationLabel(pack.pack_id, resolved))}</span><div class="hint">enabled=${esc(String(resolved.enabled))}</div><div class="hint">authority=${esc(resolved.authority)}</div></td>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${pack.capabilities.map(esc).join(', ') || '—'}</td>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${pack.permissions.map(esc).join(', ') || '—'}</td>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${roles.map(row => `<div><strong>${esc(row.role)}</strong> · ${esc(row.status)}${row.canonicalRole ? ` → ${esc(row.canonicalRole)}` : ''}</div>`).join('') || '—'}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="hint" style="margin-top:10px;"><strong>Authorization boundary:</strong> Pack configured/available ≠ organization entitlement ≠ user authorization. The user action path remains: Pack state → capability availability → canonical role/permission → scope/conditions → server enforcement.</div>
    <div class="hint" style="margin-top:6px;">No executable Pack install/activate/deactivate control is exposed here because the current source does not establish a canonical Pack lifecycle store/API. Existing business-model and feature-flag configuration remains the configuration authority.</div>
  `;
}
