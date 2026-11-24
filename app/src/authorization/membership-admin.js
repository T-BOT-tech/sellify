// P1-09 — canonical membership and contextual-role administration.
// Membership, contextual grants, scope validation and authorization remain
// server-owned. This module is only the administration surface.
import { config, currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';
import { authHeaders } from '../auth/tenant.js';

const ROLE_OPTIONS = Object.freeze(['owner','manager','cashier','staff','buyer','viewer']);
const MANAGER_ASSIGNABLE_ROLES = Object.freeze(['cashier','staff','viewer']);
const CONTEXTUAL_ROLE_OPTIONS = Object.freeze([
  ['restaurant_waiter', 'Restaurant · Waiter'],
  ['restaurant_kitchen_staff', 'Restaurant · Kitchen staff'],
  ['retail_cashier', 'Retail / POS · Cashier'],
  ['retail_stock_staff', 'Retail / POS · Stock staff'],
  ['warehouse_receiving', 'Warehouse · Receiving'],
  ['warehouse_picker_packer', 'Warehouse · Picker / packer'],
  ['warehouse_inventory_staff', 'Warehouse · Inventory staff'],
  ['logistics_manager', 'Logistics · Manager'],
  ['logistics_dispatcher', 'Logistics · Dispatcher'],
  ['logistics_courier', 'Logistics · Courier'],
  ['logistics_viewer', 'Logistics · Viewer'],
  ['agriculture_farm_manager', 'Agriculture · Farm manager'],
  ['agriculture_field_staff', 'Agriculture · Field staff'],
  ['procurement_buyer_requester', 'Procurement · Buyer / requester'],
  ['procurement_approver', 'Procurement · Approver'],
  ['supplier_network_admin', 'Supplier Network · Admin'],
  ['supplier_network_staff', 'Supplier Network · Staff'],
  ['marketplace_seller_admin', 'Marketplace · Seller admin'],
  ['marketplace_seller_staff', 'Marketplace · Seller staff'],
]);
const CONTEXTUAL_ROLE_LABELS = new Map(CONTEXTUAL_ROLE_OPTIONS);
function assignableRoles(actorRole) {
  return String(actorRole || '').toLowerCase() === 'manager' ? MANAGER_ASSIGNABLE_ROLES : ROLE_OPTIONS;
}
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
async function request(path, options = {}) {
  const base = String(config.syncUrl || '').replace(/\/$/, '');
  if (!base) throw new Error('Sync server URL is not configured');
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Request failed (${res.status})`);
  return data;
}
function contextualScopeLabel(grant, locations) {
  if (grant.scopeType === 'ORGANIZATION') return 'Organization';
  if (grant.scopeType === 'LOCATION') {
    const location = locations.find(item => String(item.id) === String(grant.scopeId));
    return `Location · ${location?.name || grant.scopeId || 'unknown'}`;
  }
  return `${grant.scopeType || 'Unknown'} · ${grant.scopeId || 'unknown'}`;
}
function contextualGrantMarkup(membership, locations) {
  const grants = Array.isArray(membership.contextualRoles) ? membership.contextualRoles : [];
  if (!grants.length) return '<div class="hint">No contextual role grants recorded.</div>';
  return grants.map(grant => {
    const active = grant.status === 'active';
    const label = CONTEXTUAL_ROLE_LABELS.get(grant.role) || grant.role;
    return `<div style="padding:8px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
      <div>
        <strong>${esc(label)}</strong>
        <div class="hint">${esc(contextualScopeLabel(grant, locations))} · ${esc(grant.status || 'unknown')}</div>
        <div class="hint">Source: ${esc(grant.source || 'unknown')} · Granted: ${esc(grant.grantedAt || 'unknown')}${grant.revokedAt ? ` · Revoked: ${esc(grant.revokedAt)}` : ''}</div>
      </div>
      ${active ? `<button type="button" class="btn-secondary" data-revoke-contextual="${esc(membership.id)}" data-role="${esc(grant.role)}" data-scope-type="${esc(grant.scopeType)}" data-scope-id="${esc(grant.scopeId || '')}">Revoke</button>` : '<span class="hint">Historical</span>'}
    </div>`;
  }).join('');
}

export async function renderMembershipAdministration(containerId = 'membershipAdministrationPanel', notice = '') {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!config.sessionToken || !config.chatId) {
    el.innerHTML = '<div class="hint">UNKNOWN — no authenticated membership context.</div>';
    return;
  }
  if (!hasPermission(currentStaff?.role || config.tenantRole || 'owner', 'membership:role:manage')) {
    el.innerHTML = '<div class="hint">PERMISSION_DENIED — membership administration is not available to this role.</div>';
    return;
  }

  const requestChatId = config.chatId;
  const requestSessionToken = config.sessionToken;
  el.innerHTML = '<div class="settings-section-label">Membership administration</div><div class="hint">Loading canonical memberships and contextual grants…</div>';
  try {
    const [data, locationData] = await Promise.all([
      request(`/tenants/${encodeURIComponent(requestChatId)}/memberships`),
      request(`/tenants/${encodeURIComponent(requestChatId)}/locations`).catch(() => ({ locations: [] })),
    ]);
    if (config.chatId !== requestChatId || config.sessionToken !== requestSessionToken) return;
    const memberships = Array.isArray(data.memberships) ? data.memberships : [];
    const locations = Array.isArray(locationData.locations)
      ? locationData.locations.filter(location => location.status === 'active')
      : [];
    const actorRole = String(currentStaff?.role || config.tenantRole || 'owner').toLowerCase();
    const roles = assignableRoles(actorRole);
    const actorId = String(currentStaff?.userId || currentStaff?.id || '');

    el.innerHTML = `<div class="settings-section-label">Membership administration</div>
      <div class="hint">Role changes and contextual grants are server-authorized and audited. UI visibility is not authorization.</div>
      ${notice ? `<div class="hint" role="status" style="margin-top:8px;">${esc(notice)}</div>` : ''}
      ${locations.length ? '' : '<div class="hint" style="margin-top:8px;">Location scopes are unavailable until canonical locations can be loaded. Organization-scoped grants remain available.</div>'}
      ${memberships.length ? memberships.map(m => {
        const canEdit = m.id && m.role !== 'owner' && m.userId !== actorId;
        return `<div style="padding:10px;border:1px solid var(--line);border-radius:8px;margin-top:8px;">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;"><strong>${esc(m.displayName || 'Member')}</strong><span class="status-badge">${esc(m.role)}</span></div>
          <div class="hint">Membership: ${esc(m.id || 'unknown')}</div>
          ${canEdit ? `<div style="display:flex;gap:8px;margin-top:8px;">
            <select data-membership-role="${esc(m.id)}">${roles.map(r => `<option value="${r}" ${r===m.role?'selected':''}>${r}</option>`).join('')}</select>
            <button type="button" data-save-membership="${esc(m.id)}">Save role</button>
          </div>` : '<div class="hint" style="margin-top:6px;">Generic role editing is protected for this membership.</div>'}
          <div style="margin-top:12px;">
            <strong>Contextual roles and scopes</strong>
            ${contextualGrantMarkup(m, locations)}
          </div>
          ${canEdit ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:10px;">
            <select data-contextual-role="${esc(m.id)}" aria-label="Contextual role">${CONTEXTUAL_ROLE_OPTIONS.map(([id,label]) => `<option value="${esc(id)}">${esc(label)}</option>`).join('')}</select>
            <select data-contextual-scope="${esc(m.id)}" aria-label="Contextual role scope">
              <option value="ORGANIZATION">Organization scope</option>
              <option value="LOCATION" ${locations.length ? '' : 'disabled'}>Location scope</option>
            </select>
            <select data-contextual-location="${esc(m.id)}" aria-label="Location scope" disabled>
              ${locations.length ? locations.map(location => `<option value="${esc(location.id)}">${esc(location.name)} · ${esc(location.type)}</option>`).join('') : '<option value="">No active locations</option>'}
            </select>
            <button type="button" data-grant-contextual="${esc(m.id)}">Grant contextual role</button>
          </div>
          <div class="hint" data-contextual-status="${esc(m.id)}" role="status"></div>` : ''}
        </div>`;
      }).join('') : '<div class="hint">No memberships found for this business.</div>'}`;

    el.querySelectorAll('[data-save-membership]').forEach(btn => btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-save-membership');
      const select = el.querySelector(`[data-membership-role="${CSS.escape(id)}"]`);
      const nextRole = select?.value;
      if (!id || !roles.includes(nextRole)) { btn.textContent = 'Invalid role'; return; }
      btn.disabled = true;
      const mutationChatId = config.chatId;
      const mutationSessionToken = config.sessionToken;
      try {
        await request('/auth/membership-role', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ membershipId: id, role: nextRole }),
        });
        if (config.chatId !== mutationChatId || config.sessionToken !== mutationSessionToken) return;
        await renderMembershipAdministration(containerId, 'Generic membership role change confirmed by the server.');
      } catch (error) {
        if (config.chatId !== mutationChatId || config.sessionToken !== mutationSessionToken) return;
        btn.disabled = false;
        btn.textContent = error.message || 'Failed';
      }
    }));

    el.querySelectorAll('[data-contextual-scope]').forEach(select => select.addEventListener('change', () => {
      const id = select.getAttribute('data-contextual-scope');
      const locationSelect = el.querySelector(`[data-contextual-location="${CSS.escape(id)}"]`);
      if (!locationSelect) return;
      const locationScoped = select.value === 'LOCATION';
      locationSelect.disabled = !locationScoped || locations.length === 0;
    }));

    el.querySelectorAll('[data-grant-contextual]').forEach(btn => btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-grant-contextual');
      const role = el.querySelector(`[data-contextual-role="${CSS.escape(id)}"]`)?.value;
      const scopeType = el.querySelector(`[data-contextual-scope="${CSS.escape(id)}"]`)?.value || 'ORGANIZATION';
      const scopeId = scopeType === 'LOCATION'
        ? el.querySelector(`[data-contextual-location="${CSS.escape(id)}"]`)?.value || null
        : null;
      const status = el.querySelector(`[data-contextual-status="${CSS.escape(id)}"]`);
      if (!role || (scopeType === 'LOCATION' && !scopeId)) {
        if (status) status.textContent = 'Select an active location for location-scoped grants.';
        return;
      }
      btn.disabled = true;
      try {
        await request('/auth/membership-contextual-role', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ membershipId: id, role, scopeType, scopeId }),
        });
        if (config.chatId !== requestChatId || config.sessionToken !== requestSessionToken) return;
        await renderMembershipAdministration(containerId, 'Contextual role grant confirmed by the server.');
      } catch (error) {
        if (config.chatId !== requestChatId || config.sessionToken !== requestSessionToken) return;
        btn.disabled = false;
        if (status) status.textContent = error.message || 'Contextual role grant failed.';
      }
    }));

    el.querySelectorAll('[data-revoke-contextual]').forEach(btn => btn.addEventListener('click', async () => {
      const membershipId = btn.getAttribute('data-revoke-contextual');
      const role = btn.getAttribute('data-role');
      const scopeType = btn.getAttribute('data-scope-type');
      const scopeId = btn.getAttribute('data-scope-id') || null;
      btn.disabled = true;
      try {
        await request('/auth/membership-contextual-role/revoke', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ membershipId, role, scopeType, scopeId }),
        });
        if (config.chatId !== requestChatId || config.sessionToken !== requestSessionToken) return;
        await renderMembershipAdministration(containerId, 'Contextual role revocation confirmed by the server.');
      } catch (error) {
        if (config.chatId !== requestChatId || config.sessionToken !== requestSessionToken) return;
        btn.disabled = false;
        btn.textContent = error.message || 'Revoke failed';
      }
    }));
  } catch (error) {
    el.innerHTML = `<div class="settings-section-label">Membership administration</div><div class="hint">UNKNOWN — ${esc(error.message || 'Could not load memberships.')}</div>`;
  }
}
