// Stage 5 — Marketplace and ecosystem discovery composition.
// This is a read-only index over existing contracts and routes. It does not
// purchase, register sellers, activate capabilities/Packs, or connect channels.
import { currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';
import { discoverPlatformSurface } from '../platform/capability-discovery.js';
import { openAddSettings } from '../ui/add-menu.js';
import { escapeHtml } from '../utils/index.js';

export function buildEcosystemDiscoveryModel(surface = discoverPlatformSurface()) {
  const capabilities = (Array.isArray(surface?.capabilities) ? surface.capabilities : [])
    .map(item => ({
      capability: String(item.capability || ''),
      authority: String(item.authority || 'unknown'),
      status: String(item.status || 'unknown').toUpperCase(),
      actions: Array.isArray(item.actions) ? item.actions.map(String) : [],
    }))
    .filter(item => item.capability)
    .sort((a, b) => a.capability.localeCompare(b.capability));
  const integrations = (Array.isArray(surface?.integrations) ? surface.integrations : [])
    .map(item => ({
      id: String(item.id || ''),
      capability: String(item.capability || ''),
      status: String(item.status || 'unknown').toUpperCase(),
      operations: Array.isArray(item.operations) ? item.operations.map(String) : [],
    }))
    .filter(item => item.id)
    .sort((a, b) => a.id.localeCompare(b.id));
  return Object.freeze({
    capabilities: Object.freeze(capabilities.map(Object.freeze)),
    integrations: Object.freeze(integrations.map(Object.freeze)),
    sellerRegistration: 'UNAVAILABLE',
    execution: 'none',
    persistence: 'none',
    authority: 'existing_capability_contracts_and_domain_workflows',
  });
}

function renderCapabilityRows(rows) {
  if (!rows.length) return '<p class="hint">No capability declarations are available.</p>';
  return '<ul class="ecosystem-metadata-list">' + rows.map(item =>
    `<li><strong>${escapeHtml(item.capability)}</strong><span>${escapeHtml(item.status)} · ${escapeHtml(item.authority)} · operations: ${escapeHtml(item.actions.join(', ') || 'none declared')}</span></li>`
  ).join('') + '</ul>';
}

function renderIntegrationRows(rows) {
  if (!rows.length) return '<p class="hint">No integration declarations are available. This is not evidence that an external channel is connected.</p>';
  return '<ul class="ecosystem-metadata-list">' + rows.map(item =>
    `<li><strong>${escapeHtml(item.id)}</strong><span>${escapeHtml(item.status)} · ${escapeHtml(item.capability || 'capability unspecified')} · operations: ${escapeHtml(item.operations.join(', ') || 'none declared')}</span></li>`
  ).join('') + '</ul>';
}

export function renderEcosystemDiscovery(containerId = 'marketEcosystemDiscovery') {
  const root = document.getElementById(containerId);
  if (!root) return;
  const model = buildEcosystemDiscoveryModel();
  const canConfigure = hasPermission(currentStaff?.role || 'staff', 'settings:configure');
  root.innerHTML = `
    <section class="ecosystem-discovery" aria-labelledby="ecosystem-discovery-title">
      <header>
        <h3 id="ecosystem-discovery-title">Explore Sellify’s ecosystem</h3>
        <p>These destinations are distinct from products and services for sale below. Discovery is informational; it does not purchase, activate, configure, connect, or grant permission.</p>
      </header>
      <div class="ecosystem-discovery-grid">
        <article class="ecosystem-discovery-card">
          <h4>Marketplace offerings</h4>
          <p>Browse purchasable products and services. Cart and checkout remain in the existing Marketplace flow.</p>
          <button type="button" data-ecosystem-action="offerings">Browse offerings</button>
        </article>
        <article class="ecosystem-discovery-card">
          <h4>Capabilities</h4>
          <p>Read-only declarations from existing capability contracts. Status and actions describe metadata, not readiness or activation.</p>
          <details><summary>${model.capabilities.length} capability declarations</summary>${renderCapabilityRows(model.capabilities)}</details>
        </article>
        <article class="ecosystem-discovery-card">
          <h4>Packs</h4>
          <p>Review requirements and canonical lifecycle in Pack settings. Discovery does not configure or activate a Pack.</p>
          <button type="button" data-ecosystem-action="packs" ${canConfigure ? '' : 'disabled'}>Review Pack readiness</button>
          ${canConfigure ? '' : '<small>Settings access is not available for the current role.</small>'}
        </article>
        <article class="ecosystem-discovery-card">
          <h4>Channels &amp; integrations</h4>
          <p>Declarations below are not connection evidence. Connection and verification happen only in their existing settings workflow.</p>
          <details><summary>${model.integrations.length} integration declarations</summary>${renderIntegrationRows(model.integrations)}</details>
          <button type="button" data-ecosystem-action="channels" ${canConfigure ? '' : 'disabled'}>Review channel connections</button>
          ${canConfigure ? '' : '<small>Settings access is not available for the current role.</small>'}
        </article>
        <article class="ecosystem-discovery-card" data-lifecycle="business-setup">
          <h4>Start or open a business</h4>
          <p>Continue through Sellify’s existing secure onboarding. You’ll be asked to authenticate, then can create a business or select an existing one.</p>
          <button type="button" data-ecosystem-action="business">Start business setup</button>
          <p class="hint" data-ecosystem-status="business" role="status" aria-live="polite"></p>
        </article>
        <article class="ecosystem-discovery-card" data-lifecycle="seller-registration">
          <h4>Seller registration</h4>
          <p><strong>Unavailable here.</strong> No supported in-app seller-registration workflow is declared. Seller registration is not a purchase or Pack activation.</p>
        </article>
        <article class="ecosystem-discovery-card">
          <h4>Operating workspaces</h4>
          <p>Enter existing Pack workspaces from Home when their canonical lifecycle and role allow it.</p>
          <button type="button" data-ecosystem-action="workspaces">Open Home workspaces</button>
        </article>
      </div>
      <p class="hint">Authority boundary: capability declarations are metadata-only; domain workflows own configuration, activation, connection, registration, purchases, and resulting state.</p>
    </section>`;

  root.querySelector('[data-ecosystem-action="offerings"]')?.addEventListener('click', () => {
    document.getElementById('marketProductList')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  });
  root.querySelector('[data-ecosystem-action="packs"]')?.addEventListener('click', () => openAddSettings('configure-packs'));
  root.querySelector('[data-ecosystem-action="channels"]')?.addEventListener('click', () => openAddSettings('connect-sales-channels'));
  root.querySelector('[data-ecosystem-action="business"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const status = root.querySelector('[data-ecosystem-status="business"]');
    if (button) button.disabled = true;
    if (status) status.textContent = 'Checking your account…';
    try {
      const result = await window.bootstrapTenantAuth?.();
      if (result?.onboarding) {
        if (status) status.textContent = 'Continue in onboarding to create a business or select an existing business.';
      } else if (result?.authenticated) {
        if (status) status.textContent = 'Opening your authorized business workspace.';
        if (typeof window.switchTab === 'function') window.switchTab('home');
      } else if (result?.reason === 'no-telegram-identity') {
        if (status) status.textContent = 'Business setup requires a supported sign-in. Open Sellify from Telegram to continue.';
      } else {
        if (status) status.textContent = result?.error?.message || 'Could not verify your account. Try again from Sellify’s supported sign-in flow.';
      }
    } catch (error) {
      if (status) status.textContent = error?.message || 'Could not verify your account. Try again.';
    } finally {
      if (button) button.disabled = false;
    }
  });
  root.querySelector('[data-ecosystem-action="workspaces"]')?.addEventListener('click', () => {
    if (typeof window.switchTab === 'function') window.switchTab('home');
  });
}
