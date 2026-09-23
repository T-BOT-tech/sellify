// P1-14 — Pack Recovery & Failure UX.
// Read-only recovery guidance over the existing Pack configuration/readiness
// authorities. This surface never mutates Pack state and never creates a
// second recovery, lifecycle, authorization, or business-data authority.
import { config, currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';
import { UI_STATES } from '../experience/state-contract.js';
import { getPackReadinessModel } from './pack-readiness.js';

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function recoveryFor(row, online) {
  if (!online) return Object.freeze({ state: UI_STATES.UNKNOWN, action: 'WAIT_FOR_CONNECTIVITY', reason: 'Transport state is uncertain while offline; no Pack transition is treated as confirmed.' });
  switch (row.readiness) {
    case 'DEPENDENCY_UNAVAILABLE':
      return Object.freeze({ state: UI_STATES.PROVIDER_UNAVAILABLE, action: 'CHECK_DEPENDENCY', reason: `Required Core dependency unavailable: ${row.missingDependencies.join(', ')}` });
    case 'CONFIGURATION_INACTIVE':
      return Object.freeze({ state: UI_STATES.FAILURE, action: 'CHECK_CONFIGURATION', reason: 'Existing Pack configuration is inactive; no activation is inferred or performed here.' });
    case 'DECLARATIVE_ONLY':
      return Object.freeze({ state: UI_STATES.PROVIDER_UNAVAILABLE, action: 'NO_EXECUTABLE_RECOVERY', reason: 'The Pack is declarative in the current source and has no executable activation transition.' });
    case 'JOURNEY_UNAVAILABLE':
      return Object.freeze({ state: UI_STATES.FAILURE, action: 'OPEN_AVAILABLE_WORKSPACE', reason: 'No executable Pack journey entry point is currently declared.' });
    default:
      return Object.freeze({ state: UI_STATES.SUCCESS, action: 'CONTINUE_TO_JOURNEY', reason: 'Readiness evidence is available; authorization is still evaluated by the canonical server.' });
  }
}

export function getPackRecoveryModel({ online = navigator.onLine } = {}) {
  return getPackReadinessModel().map(row => Object.freeze({
    ...row,
    recovery: recoveryFor(row, online),
    online: Boolean(online),
  }));
}

export function renderPackRecoveryPanel(containerId = 'packRecoveryPanel') {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!config.sessionToken || !config.chatId) {
    el.innerHTML = '<div class="hint">UNKNOWN — an authenticated tenant session is required before Pack recovery status can be assessed.</div>';
    return;
  }
  if (!hasPermission(currentStaff?.role || '', 'settings:configure')) {
    el.innerHTML = '<div class="hint">PERMISSION_DENIED — Pack recovery evidence is restricted to an authorized administrator.</div>';
    return;
  }
  const rows = getPackRecoveryModel();
  el.innerHTML = `
    <div class="settings-section-label" style="margin-top:16px;">Pack recovery &amp; failure handling</div>
    <div class="hint">Read-only recovery guidance. Retry/recovery never implies Pack activation, authorization, or canonical business success.</div>
    <div style="overflow:auto;margin-top:10px;">
      <table style="width:100%;border-collapse:collapse;min-width:1050px;">
        <thead><tr>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Pack</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Readiness</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Recovery state</th>
          <th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Recovery path</th>
        </tr></thead>
        <tbody>${rows.map(row => `<tr>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);"><strong>${esc(row.name)}</strong><div class="hint">${esc(row.packId)} · v${esc(row.version)}</div></td>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);"><span class="status-badge">${esc(row.readiness)}</span></td>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);"><span class="status-badge">${esc(row.recovery.state)}</span><div class="hint">online=${esc(String(row.online))}</div></td>
          <td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);"><strong>${esc(row.recovery.action)}</strong><div class="hint">${esc(row.recovery.reason)}</div></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="hint" style="margin-top:10px;"><strong>Boundary:</strong> configuration failure, dependency failure, offline/UNKNOWN, and authorization denial remain distinct. Canonical server confirmation is required before any business mutation is considered successful.</div>
  `;
}
