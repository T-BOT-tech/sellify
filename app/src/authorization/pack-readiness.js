// P1-13 — Pack Dependency & Readiness UX.
// Read-only readiness model. It distinguishes Pack configuration state from
// dependency availability, authorization, and executable journey availability.
import { config, currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';
import { CORE_AUTHORITIES } from '../verticals/contract.js';
import { getVerticalPackConfiguration } from '../verticals/configuration.js';
import { AGRICULTURE_PACK } from '../verticals/agriculture/pack.js';
import { RESTAURANT_PACK } from '../verticals/restaurant/pack.js';
import { WAREHOUSE_PACK } from '../verticals/warehouse/pack.js';
import { LOGISTICS_PACK } from '../verticals/logistics/pack.js';

const PACKS = Object.freeze([AGRICULTURE_PACK, RESTAURANT_PACK, WAREHOUSE_PACK, LOGISTICS_PACK]);

function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function dependencyRows(pack) {
  return pack.core_dependencies.map(name => Object.freeze({
    name,
    available: CORE_AUTHORITIES.includes(String(name).toLowerCase()),
  }));
}

function readinessFor(pack, resolved) {
  const dependencies = dependencyRows(pack);
  const missingDependencies = dependencies.filter(item => !item.available);
  if (missingDependencies.length) return 'DEPENDENCY_UNAVAILABLE';
  if (resolved.enabled === null) return 'DECLARATIVE_ONLY';
  if (!resolved.enabled) return 'CONFIGURATION_INACTIVE';
  const executable = pack.ui_entry_points.length > 0;
  return executable ? 'READY' : 'JOURNEY_UNAVAILABLE';
}

export function getPackReadinessModel() {
  return PACKS.map(pack => {
    const resolved = getVerticalPackConfiguration({
      packId: pack.pack_id,
      config,
      organizationId: config.organizationId || null,
      locationId: config.locationId || null,
    });
    const dependencies = dependencyRows(pack);
    return Object.freeze({
      packId: pack.pack_id,
      name: pack.name,
      version: pack.version,
      configurationState: resolved.enabled === null ? 'DECLARATIVE_ONLY' : (resolved.enabled ? 'ACTIVE_BY_CONFIG' : 'INACTIVE_BY_CONFIG'),
      readiness: readinessFor(pack, resolved),
      dependencies: Object.freeze(dependencies),
      missingDependencies: Object.freeze(dependencies.filter(item => !item.available).map(item => item.name)),
      journeyAvailability: Object.freeze(pack.ui_entry_points.length ? pack.ui_entry_points.map(entry => ({ entry, status: 'ENTRY_DECLARED' })) : []),
      authority: resolved.authority,
      authorizationAuthority: 'backend/lib/authorization.js',
    });
  });
}

export function renderPackReadinessPanel(containerId = 'packReadinessPanel') {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!config.sessionToken || !config.chatId) {
    el.innerHTML = '<div class="hint">UNKNOWN — an authenticated tenant session is required.</div>';
    return;
  }
  if (!hasPermission(currentStaff?.role || '', 'settings:configure')) {
    el.innerHTML = '<div class="hint">PERMISSION_DENIED — Pack readiness evidence is restricted to an authorized administrator.</div>';
    return;
  }
  const rows = getPackReadinessModel();
  el.innerHTML = `
    <div class="settings-section-label" style="margin-top:16px;">Pack dependency &amp; readiness</div>
    <div class="hint">Read-only readiness evidence. Dependency availability, configuration state, authorization, and journey availability are separate concerns.</div>
    <div style="overflow:auto;margin-top:10px;">
      <table style="width:100%;border-collapse:collapse;min-width:1050px;">
        <thead><tr>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Pack</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Readiness</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Configuration</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Core dependencies</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Journey availability</th>
        </tr></thead>
        <tbody>${rows.map(row => `<tr>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);"><strong>${esc(row.name)}</strong><div class="hint">${esc(row.packId)} · v${esc(row.version)}</div></td>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);"><span class="status-badge">${esc(row.readiness)}</span></td>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${esc(row.configurationState)}<div class="hint">authority=${esc(row.authority)}</div></td>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${row.dependencies.map(dep => `<div>${esc(dep.name)} · ${dep.available ? 'AVAILABLE' : 'UNAVAILABLE'}</div>`).join('')}</td>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${row.journeyAvailability.map(j => `<div><strong>${esc(j.entry)}</strong> · ${esc(j.status)}</div>`).join('') || 'No executable Pack entry declared.'}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="hint" style="margin-top:10px;"><strong>Boundary:</strong> readiness does not grant authorization. User access still follows canonical role → permission → scope/conditions → server enforcement.</div>
  `;
}
