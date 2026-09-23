// P1-20 — Pack Experimentation UX.
// Read-only experimentation readiness evidence. The current source does not
// establish a canonical experimentation service, assignment store, variant
// evaluator, or rollout authority, so this surface never assigns variants or
// changes production behavior.
import { config, currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';
import { getVerticalPackConfiguration } from '../verticals/configuration.js';
import { AGRICULTURE_PACK } from '../verticals/agriculture/pack.js';
import { RESTAURANT_PACK } from '../verticals/restaurant/pack.js';
import { WAREHOUSE_PACK } from '../verticals/warehouse/pack.js';
import { LOGISTICS_PACK } from '../verticals/logistics/pack.js';

const PACKS = Object.freeze([AGRICULTURE_PACK, RESTAURANT_PACK, WAREHOUSE_PACK, LOGISTICS_PACK]);
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

export function renderPackExperimentationPanel(containerId = 'packExperimentationPanel') {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!config.sessionToken || !config.chatId) {
    el.innerHTML = '<div class="settings-section-label">Pack experimentation</div><div class="status">UNKNOWN — an authenticated tenant session is required.</div>';
    return;
  }
  if (!hasPermission(currentStaff?.role || '', 'settings:configure')) {
    el.innerHTML = '<div class="settings-section-label">Pack experimentation</div><div class="status">PERMISSION_DENIED — experimentation readiness is restricted to an authorized administrator.</div>';
    return;
  }

  const rows = PACKS.map(pack => {
    const resolved = getVerticalPackConfiguration({
      packId: pack.pack_id,
      config,
      organizationId: config.organizationId || null,
      locationId: config.locationId || null,
    });
    return { pack, resolved };
  });

  el.innerHTML = `
    <div class="settings-section-label">Pack experimentation</div>
    <div class="hint">Read-only readiness evidence. The current source does not define a canonical experimentation service, experiment assignment store, variant evaluator, or rollout authority. No experiment is assigned or activated here.</div>
    <div style="overflow:auto;margin-top:10px;">
      <table style="width:100%;border-collapse:collapse;min-width:900px;">
        <thead><tr>
          <th scope="col" style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Pack</th>
          <th scope="col" style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Current configuration</th>
          <th scope="col" style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Experiment service</th>
          <th scope="col" style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Assignment</th>
          <th scope="col" style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Production mutation</th>
        </tr></thead>
        <tbody>${rows.map(({ pack, resolved }) => `<tr>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);"><strong>${esc(pack.name)}</strong><div class="hint">${esc(pack.pack_id)}</div></td>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${esc(resolved.enabled ? 'ACTIVE_BY_EXISTING_CONFIG' : 'INACTIVE_BY_EXISTING_CONFIG')}</td>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);"><span class="status-badge">NOT_ESTABLISHED</span><div class="hint">No canonical experimentation authority is declared by the current source.</div></td>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">NOT_ASSIGNED</td>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">BLOCKED_BY_BOUNDARY</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="hint" style="margin-top:10px;"><strong>Boundary:</strong> analytics observes outcomes; experimentation would require an explicit canonical assignment/rollout authority. Existing Pack configuration is not silently reinterpreted as experimentation.</div>
    <div class="hint" style="margin-top:6px;">To introduce experimentation later, the canonical contract must define experiment identity, eligibility, assignment, variant, rollout, persistence, audit/evidence, rollback, and server enforcement before this UX becomes executable.</div>
  `;
}
