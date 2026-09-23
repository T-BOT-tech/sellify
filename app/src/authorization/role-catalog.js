// FUX-2A — Role catalogue and reconciliation presentation.
// This module is intentionally read-only: the backend central authorization
// policy and membership/session store remain authoritative. Target Pack role
// families are product-model metadata until a corresponding server role,
// permission, scope, and enforcement contract exists.
import { config } from '../state.js';
import { hasPermission } from '../auth/permissions.js';
import { PACK_ROLE_RECONCILIATION } from './role-reconciliation.js';

import { CANONICAL_ROLES } from './role-catalog-data.js';
export { CANONICAL_ROLES };
// Canonical role IDs remain: { id: 'owner' }, { id: 'manager' }, { id: 'cashier' }, { id: 'staff' }, { id: 'buyer' }, { id: 'viewer' }.

export const TARGET_PACK_ROLE_FAMILIES = Object.freeze([
  { pack: 'Core organization', roles: ['Owner', 'Admin', 'Manager', 'Staff', 'Viewer'], typicalScope: 'organization or assigned scope' },
  { pack: 'Restaurant', roles: ['Owner', 'Manager', 'Waiter / FOH', 'Chef / Kitchen Staff', 'Viewer'], typicalScope: 'FOH, kitchen, tables/orders, operations' },
  // Executable contextual IDs already established for Restaurant.
  { pack: 'Restaurant contextual', roles: ['restaurant_waiter', 'restaurant_kitchen_staff'], typicalScope: 'FOH or kitchen; organization/location/resource scope' },
  { pack: 'Retail / POS', roles: ['Store Owner', 'Store Manager', 'Cashier', 'Stock Staff', 'Viewer'], typicalScope: 'POS, catalog, stock, orders, reports' },
  // Executable contextual IDs established for the operational Retail/POS slice.
  { pack: 'Retail / POS contextual', roles: ['retail_cashier', 'retail_stock_staff'], typicalScope: 'POS/orders/payments or stock operations; organization/location/resource scope' },
  { pack: 'Warehouse', roles: ['Warehouse Manager', 'Receiving', 'Picker/Packer', 'Inventory Staff', 'Viewer'], typicalScope: 'receiving, fulfillment tasks, stock' },
  // Executable contextual IDs already established for Warehouse.
  { pack: 'Warehouse contextual', roles: ['warehouse_receiving', 'warehouse_picker_packer', 'warehouse_inventory_staff'], typicalScope: 'receiving, picking/packing, inventory; organization/location/resource scope' },
  { pack: 'Logistics', roles: ['Logistics Manager', 'Dispatcher/Coordinator', 'Courier', 'Viewer'], typicalScope: 'assignment, tracking, proof, coordination' },
  { pack: 'Agriculture', roles: ['Farm/Operations Manager', 'Field Staff', 'Buyer', 'Viewer'], typicalScope: 'farm, plot, season, supply context' },
  { pack: 'Agriculture contextual', roles: ['agriculture_farm_manager', 'agriculture_field_staff'], typicalScope: 'farm, plot, season, supply context; resource-scoped operational access' },
  { pack: 'Procurement', roles: ['Procurement Manager', 'Buyer/Requester', 'Approver', 'Viewer'], typicalScope: 'demand, RFQ, comparison, award, PO' },
  // Executable contextual IDs for the Procurement operational slice.
  { pack: 'Procurement contextual', roles: ['procurement_buyer_requester', 'procurement_approver'], typicalScope: 'demand, RFQ, comparison, award, PO; organization/resource scope' },
  { pack: 'Supplier Network', roles: ['Supplier Admin', 'Supplier Staff', 'Buyer Network User', 'Viewer'], typicalScope: 'profile, qualification, capacity, evidence' },
  { pack: 'Marketplace', roles: ['Seller Admin', 'Seller Staff', 'Buyer'], typicalScope: 'listings and buyer/seller workflows' },
  { pack: 'Marketplace contextual', roles: ['marketplace_seller_admin', 'marketplace_seller_staff'], typicalScope: 'seller-side marketplace order operations; organization/location/resource scope' },
]);


export function roleFamilyScopeContract() {
  return Object.freeze(TARGET_PACK_ROLE_FAMILIES.map(family => Object.freeze({
    pack: family.pack,
    roles: Object.freeze([...family.roles]),
    typicalScope: family.typicalScope,
    authority: 'backend/lib/authorization.js',
    assignability: 'ONLY_CANONICAL_ROLE_OR_EXPLICITLY_RECONCILED_ROLE',
  })));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function roleId() {
  return String(config.tenantRole || 'owner').toLowerCase();
}

function permissionSummary(role) {
  if (role === 'owner') return 'Wildcard policy (*): server authorization remains authoritative.';
  const permissions = CANONICAL_ROLES.find(item => item.id === role);
  return permissions ? `${role} uses the existing central permission matrix.` : 'No canonical role policy found.';
}

export function renderRoleAccessPanel(containerId = 'roleAccessPanel') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const role = roleId();
  const current = CANONICAL_ROLES.find(item => item.id === role);
  const canConfigure = hasPermission(role, 'settings:configure');
  const roleLabel = current?.name || role.toUpperCase();

  container.innerHTML = `
    <div class="settings-section-label">Roles &amp; access</div>
    <div class="hint">Your current security role is <strong>${escapeHtml(roleLabel)}</strong>. UI visibility is not authorization; the server policy remains the authority.</div>
    <div class="role-access-current" style="margin-top:10px;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2, var(--surface));">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
        <strong>${escapeHtml(roleLabel)}</strong>
        <span class="status-badge">${escapeHtml(current?.status || 'UNKNOWN')}</span>
      </div>
      <div class="hint" style="margin-top:6px;">${escapeHtml(permissionSummary(role))}</div>
      <div class="hint" style="margin-top:6px;">Role administration surface: ${canConfigure ? 'available to this role where a canonical server capability exists' : 'not available to this role'}.</div>
    </div>
    <div class="settings-section-label" style="margin-top:16px;">Canonical security roles</div>
    <div class="role-catalog-grid">
      ${CANONICAL_ROLES.map(item => `
        <div class="role-catalog-item" style="padding:10px;border-bottom:1px solid var(--line);">
          <div style="display:flex;justify-content:space-between;gap:8px;"><strong>${escapeHtml(item.name)}</strong><span class="hint">${escapeHtml(item.status)}</span></div>
          <div class="hint" style="margin-top:4px;">${escapeHtml(item.description)}</div>
        </div>`).join('')}
    </div>
    <div class="settings-section-label" style="margin-top:16px;">Pack role families — target product model</div>
    <div class="hint">These names come from FUX-2 Section 6. They are target role families, not additional server authorization roles until each is reconciled to permissions, scope, conditions, UI affordance, and server enforcement.</div>
    <div class="role-pack-grid" style="margin-top:8px;">
      ${TARGET_PACK_ROLE_FAMILIES.map(item => `
        <div class="role-pack-item" style="padding:10px;border:1px solid var(--line);border-radius:8px;margin-bottom:8px;">
          <strong>${escapeHtml(item.pack)}</strong>
          <div class="hint" style="margin-top:4px;">${item.roles.map(escapeHtml).join(' · ')}</div>
        </div>`).join('')}
    </div>
    <div class="hint" style="margin-top:10px;">Reconciliation status: EXISTING / MAP / EXTEND / NEW / DEFERRED. This surface does not create a second IAM store or evaluator.</div>
    <div class="settings-section-label" style="margin-top:16px;">Pack-role reconciliation</div>
    <div class="hint">Derived from the FUX-2 target catalogue plus the existing canonical authorization vocabulary. This is a read-only reconciliation register; it does not authorize or persist role assignments.</div>
    <div style="overflow:auto;margin-top:8px;">
      <table style="width:100%;border-collapse:collapse;min-width:760px;">
        <thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Pack</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Target role</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Status</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Canonical role</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Rationale</th></tr></thead>
        <tbody>${PACK_ROLE_RECONCILIATION.map(item => `<tr><td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${escapeHtml(item.pack)}</td><td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);"><strong>${escapeHtml(item.role)}</strong></td><td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);"><span class="status-badge">${escapeHtml(item.status)}</span></td><td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${escapeHtml(item.canonicalRole || '—')}</td><td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${escapeHtml(item.rationale)}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="hint" style="margin-top:10px;">MAP does not mean the target role is a new security role. EXTEND/NEW rows remain non-assignable until canonical permissions, scope, conditions, UI affordance, server enforcement, and audit behavior are deliberately established.</div>
  `;
}


export async function renderPermissionRoleScopeMatrix(containerId = 'rolePermissionMatrixPanel') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const role = roleId();
  if (!config.sessionToken || !config.chatId) {
    container.innerHTML = '<div class="hint">UNKNOWN — an authenticated tenant session is required to load the canonical permission matrix.</div>';
    return;
  }
  if (!hasPermission(role, 'settings:configure')) {
    container.innerHTML = '<div class="hint">PERMISSION_DENIED — the canonical server matrix is available only to an authorized administrator.</div>';
    return;
  }
  container.innerHTML = '<div class="hint">LOADING — reading the canonical server authorization matrix…</div>';
  try {
    const base = String(config.syncUrl || '').replace(/\/$/, '');
    const response = await fetch(`${base}/tenants/${encodeURIComponent(config.chatId)}/authorization/role-matrix`, {
      headers: { Authorization: `Bearer ${config.sessionToken}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `HTTP ${response.status}`);
    const roles = Array.isArray(data.roles) ? data.roles : [];
    container.innerHTML = `
      <div class="settings-section-label" style="margin-top:16px;">Permission × role × scope</div>
      <div class="hint">Source: canonical server authorization policy. This is a read-only product view; UI visibility never grants permission.</div>
      <div style="overflow:auto;margin-top:8px;">
        <table style="width:100%;border-collapse:collapse;min-width:620px;">
          <thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Role</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Permissions</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Scope</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--line);">Enforcement</th></tr></thead>
          <tbody>${roles.map(item => `<tr><td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);"><strong>${escapeHtml(item.id)}</strong></td><td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${item.permissions.length ? item.permissions.map(escapeHtml).join(', ') : '—'}</td><td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${item.scope.map(scope => `<div><strong>${escapeHtml(scope.label)}</strong>${scope.required ? ' · required' : ' · optional'}</div>`).join('')}</td><td style="vertical-align:top;padding:8px;border-bottom:1px solid var(--line);">${escapeHtml(item.enforcement)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
      <div class="hint" style="margin-top:10px;">Target Pack roles remain FUX-2 product-model metadata until each role is explicitly reconciled to canonical permissions, scope, conditions, UI affordance, and server enforcement.</div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="hint">FAILURE — ${escapeHtml(error?.message || 'Unable to load the canonical permission matrix.')}</div>`;
  }
}
