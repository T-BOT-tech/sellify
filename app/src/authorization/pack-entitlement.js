// P1-10 — Pack activation & role-entitlement UX.
// Read-only productization of existing Pack manifests/configuration and the
// canonical IAM reconciliation. It does not create Pack activation state,
// entitlement state, or a second authorization authority.
import { config, currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';
import { getPackLifecycleSnapshot } from '../experience/pack-lifecycle-client.js';
import { AGRICULTURE_PACK } from '../verticals/agriculture/pack.js';
import { RESTAURANT_PACK } from '../verticals/restaurant/pack.js';
import { WAREHOUSE_PACK } from '../verticals/warehouse/pack.js';
import { LOGISTICS_PACK } from '../verticals/logistics/pack.js';
import { PACK_ROLE_RECONCILIATION } from './role-reconciliation.js';

const PACKS = Object.freeze([AGRICULTURE_PACK, RESTAURANT_PACK, WAREHOUSE_PACK, LOGISTICS_PACK]);
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function activationLabel(lifecycle) {
  return String(lifecycle?.state || 'UNKNOWN').trim().toUpperCase() || 'UNKNOWN';
}
function roleRows(packId) {
  return PACK_ROLE_RECONCILIATION.filter(row => String(row.pack || '').toLowerCase().replace(/\s*\/\s*pos/i, '').replace(/\s+/g, '-') === packId);
}

export function renderPackEntitlementPanel(containerId = 'packEntitlementPanel') {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!config.sessionToken || !config.chatId) {
    el.innerHTML = '<div class="hint">UNKNOWN — an authenticated tenant session is required.</div>';
    return;
  }
  if (!hasPermission(currentStaff?.role || '', 'settings:configure')) {
    el.innerHTML = '<div class="hint">PERMISSION_DENIED — Pack entitlement evidence is restricted to an authorized administrator.</div>';
    return;
  }

  el.innerHTML = '<div class="settings-section-label" style="margin-top:16px;">Pack activation &amp; role entitlement</div><div class="hint">Loading canonical Pack lifecycle state…</div>';

  Promise.allSettled(PACKS.map(async pack => [pack.pack_id, await getPackLifecycleSnapshot(pack.pack_id)]))
    .then(results => {
      const lifecycles = new Map();
      results.forEach(result => {
        if (result.status === 'fulfilled') lifecycles.set(result.value[0], result.value[1]);
      });

      el.innerHTML = `
        <div class="settings-section-label" style="margin-top:16px;">Pack activation &amp; role entitlement</div>
        <div class="hint">Lifecycle state is read from the canonical server Pack lifecycle authority. Pack state does not grant user authorization.</div>
        <div style="overflow:auto;margin-top:10px;">
          <table style="width:100%;border-collapse:collapse;min-width:1100px;">
            <thead><tr>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Pack</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Version</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Lifecycle state</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Capabilities</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Pack permissions</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Target roles</th>
            </tr></thead>
            <tbody>${PACKS.map(pack => {
              const snapshot = lifecycles.get(pack.pack_id) || null;
              const lifecycle = snapshot?.lifecycle || null;
              const roles = roleRows(pack.pack_id);
              return `<tr>
                <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);"><strong>${esc(pack.name)}</strong><div class="hint">${esc(pack.pack_id)}</div></td>
                <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${esc(pack.version)}</td>
                <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);"><span class="status-badge">${esc(activationLabel(lifecycle))}</span><div class="hint">authority=backend/server.js#handlePackLifecycle</div></td>
                <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${pack.capabilities.map(esc).join(', ') || '—'}</td>
                <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${pack.permissions.map(esc).join(', ') || '—'}</td>
                <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${roles.map(row => `<div><strong>${esc(row.role)}</strong> · ${esc(row.status)}${row.canonicalRole ? ` → ${esc(row.canonicalRole)}` : ''}</div>`).join('') || '—'}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>
        <div class="hint" style="margin-top:10px;"><strong>Authorization boundary:</strong> Pack lifecycle state ≠ organization entitlement ≠ user authorization. The action path remains: Pack state → capability availability → canonical role/permission → scope/conditions → server enforcement.</div>
      `;
    })
    .catch(() => {
      el.innerHTML = '<div class="settings-section-label" style="margin-top:16px;">Pack activation &amp; role entitlement</div><div class="hint">UNKNOWN — canonical Pack lifecycle state could not be loaded.</div>';
    });
}
