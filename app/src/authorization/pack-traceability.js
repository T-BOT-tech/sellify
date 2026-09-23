// P1-21 — Pack Design / Engineering QA & Traceability.
// Read-only certification trace across the current Pack productization surfaces.
// This registry does not authorize, persist, execute, or replace any domain authority.

import { config, currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';

export const PACK_TRACEABILITY_VERSION = '1.0';

const ROWS = Object.freeze([
  {
    pack: 'All Packs',
    component: 'Pack entitlement panel',
    screen: 'Settings',
    journey: 'Pack state → capability → role entitlement',
    capability: 'Pack configuration / role reconciliation',
    authority: 'app/src/verticals/configuration.js + backend/lib/authorization.js',
    evidence: 'app/src/authorization/pack-entitlement.js',
  },
  {
    pack: 'All Packs',
    component: 'Pack readiness panel',
    screen: 'Settings',
    journey: 'Dependency check → readiness → journey availability',
    capability: 'Pack dependency/readiness',
    authority: 'app/src/verticals/configuration.js + app/src/verticals/contract.js',
    evidence: 'app/src/authorization/pack-readiness.js',
  },
  {
    pack: 'All Packs',
    component: 'Pack recovery panel',
    screen: 'Settings',
    journey: 'Failure/offline → recovery state → canonical retry boundary',
    capability: 'Pack recovery UX',
    authority: 'Existing Pack configuration + canonical domain authorities',
    evidence: 'app/src/authorization/pack-recovery.js',
  },
  {
    pack: 'All Packs',
    component: 'Pack audit panel',
    screen: 'Settings',
    journey: 'Pack evidence → canonical audit history',
    capability: 'Audit / observability',
    authority: 'Existing audit authority (/tenants/:chatId/audit)',
    evidence: 'app/src/authorization/pack-audit.js',
  },
  {
    pack: 'All Packs',
    component: 'Pack security panel',
    screen: 'Settings',
    journey: 'Sensitive action → permission/approval boundary',
    capability: 'Security UX',
    authority: 'backend/lib/authorization.js + backend/lib/vertical-approval-boundary.js',
    evidence: 'app/src/authorization/pack-security.js',
  },
  {
    pack: 'All Packs',
    component: 'Pack accessibility/localization panel',
    screen: 'Settings',
    journey: 'Pack surface → accessible/localized presentation',
    capability: 'Accessibility / localization',
    authority: 'Existing i18n/design-system foundations',
    evidence: 'app/src/authorization/pack-accessibility-localization.js',
  },
  {
    pack: 'All Packs',
    component: 'Pack analytics panel',
    screen: 'Settings',
    journey: 'Canonical audit evidence → read-only analytical projection',
    capability: 'Product telemetry evidence',
    authority: 'Existing audit authority',
    evidence: 'app/src/authorization/pack-analytics.js',
  },
  {
    pack: 'All Packs',
    component: 'Pack experimentation panel',
    screen: 'Settings',
    journey: 'Experiment readiness → canonical service boundary',
    capability: 'Experimentation readiness',
    authority: 'No canonical experimentation authority established in current source',
    evidence: 'app/src/authorization/pack-experimentation.js',
  },
  {
    pack: 'Restaurant',
    component: 'Restaurant Pack boundary',
    screen: 'Restaurant workspace',
    journey: 'Restaurant configuration → tables/kitchen entry points',
    capability: 'table-management / kitchen-management',
    authority: 'app/src/restaurant/tables.js + app/src/restaurant/kitchen.js',
    evidence: 'app/src/verticals/restaurant/pack.js',
  },
  {
    pack: 'Warehouse',
    component: 'Warehouse Pack boundary',
    screen: 'Warehouse workspace',
    journey: 'Warehouse configuration → inventory/receiving/storage',
    capability: 'warehouse-inventory / warehouse-receiving',
    authority: 'app/src/warehouse/inventory.js + app/src/warehouse/ledger.js',
    evidence: 'app/src/verticals/warehouse/pack.js',
  },
  {
    pack: 'Logistics',
    component: 'Logistics Pack boundary',
    screen: 'Logistics workspace',
    journey: 'Logistics configuration → fulfillment/shipment/delivery',
    capability: 'logistics-fulfillment / logistics-delivery',
    authority: 'app/src/logistics/fulfillment.js + app/src/logistics/physical-flow.js',
    evidence: 'app/src/verticals/logistics/pack.js',
  },
  {
    pack: 'Agriculture',
    component: 'Agriculture Pack foundation',
    screen: 'Pack workspace / declarative surface',
    journey: 'Agriculture vocabulary → Core dependency bridge',
    capability: 'farm/plot/season/crop/harvest management',
    authority: 'Existing Core authorities; Agriculture has no executable UI entry points',
    evidence: 'app/src/verticals/agriculture/pack.js',
  },
]);

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

export function getPackTraceabilityRows() {
  return ROWS.map(row => Object.freeze({ ...row }));
}

export function packTraceabilityContract() {
  return Object.freeze({
    version: PACK_TRACEABILITY_VERSION,
    authority: 'current source traceability registry',
    execution: 'read_only',
    persistence: 'none',
    authorization: 'backend/lib/authorization.js',
    duplicateAuthority: false,
    duplicatePersistence: false,
    requiredTrace: 'Component → Screen → Journey → API/Capability → Canonical Authority',
    rows: ROWS.length,
  });
}

export function renderPackTraceabilityPanel(containerId = 'packTraceabilityPanel') {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!config.sessionToken || !config.chatId) {
    el.innerHTML = '<div class="settings-section-label">Pack design / engineering QA</div><div class="status">UNKNOWN — an authenticated tenant session is required.</div>';
    return;
  }
  if (!hasPermission(currentStaff?.role || '', 'settings:configure')) {
    el.innerHTML = '<div class="settings-section-label">Pack design / engineering QA</div><div class="status">PERMISSION_DENIED — QA traceability is restricted to an authorized administrator.</div>';
    return;
  }

  const rows = getPackTraceabilityRows();
  el.innerHTML = `
    <div class="settings-section-label" style="margin-top:16px;">Pack design / engineering QA &amp; traceability</div>
    <div class="hint">Read-only certification trace from the current source. A trace row does not grant authorization, create persistence, or replace a canonical domain authority.</div>
    <div class="status">SUCCESS — ${rows.length} current Pack trace rows registered.</div>
    <div style="overflow:auto;margin-top:10px;">
      <table style="width:100%;border-collapse:collapse;min-width:1500px;font-size:12px;">
        <thead><tr>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Pack</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Component</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Screen</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Journey</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">API / Capability</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Canonical authority</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Evidence</th>
        </tr></thead>
        <tbody>${rows.map(row => `<tr>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);"><strong>${esc(row.pack)}</strong></td>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${esc(row.component)}</td>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${esc(row.screen)}</td>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${esc(row.journey)}</td>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${esc(row.capability)}</td>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${esc(row.authority)}</td>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);"><code>${esc(row.evidence)}</code></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="hint" style="margin-top:10px;"><strong>Certification boundary:</strong> Component → Screen → Journey → API/Capability → Canonical Authority. Authorization remains server-side; configuration/readiness/analytics/experimentation surfaces are evidence only.</div>
  `;
}
