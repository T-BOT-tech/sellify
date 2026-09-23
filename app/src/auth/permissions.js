// auth/permissions.js
// Phase 3 extraction (see modularization plan §5): fine-grained role
// permissions, moved out of main.js unchanged.

// ---------- Fine-grained role permissions (Phase 10.3 canonical roles) ----------
// Phase 3 additions (see modularization plan §5, Phase 3 / audit "Real
// authorization, not UI-only"): 'tables:manage', 'tables:status',
// 'kitchen:manage', and 'b2b:manage' close the gap where table/kitchen
// transitions and B2B settings had no permission check anywhere — only
// applyRolePermissions() hiding the nav/buttons, which a modified client
// (or a console call to the underlying function) could bypass entirely.
// - tables:manage  — add/edit/remove a table (structural, manager+)
// - tables:status  — seat/free/transfer an existing table (day-to-day
//   front-of-house work, so cashier gets this even without tables:manage)
// - kitchen:manage — advance/undo a kitchen ticket's status or priority
//   (also front-of-house-adjacent on a small install, cashier gets it)
// - b2b:manage     — B2B account CRUD, pricing tiers, volume discounts
const PERMISSIONS = {
  owner: ['*'],
  manager: [
    'orders:create', 'orders:view', 'orders:delete', 'payments:accept',
    'payments:view_proof', 'inventory:add', 'inventory:edit', 'sync:manual',
    'settings:configure', 'paymethods:manage',
    'tables:manage', 'tables:status', 'kitchen:manage', 'b2b:manage', 'devices:manage'
  ],
  cashier: ['orders:create', 'orders:view', 'payments:accept', 'tables:status', 'kitchen:manage'],
  staff: ['locations:view'],
  buyer: ['orders:create'],
  viewer: []
};
export function hasPermission(role, action) {
  const r = (role || 'owner').toLowerCase();
  const perms = PERMISSIONS[r];
  if (!perms) return false;
  return perms.includes('*') || perms.includes(action);
}

export function applyRolePermissions(role) {
  const roleClean = (role || 'owner').toLowerCase();
  const badge = document.getElementById('staffBadgeBtn');
  if (badge) {
    const roleIcons = { owner: 'i-crown', manager: 'i-tie', cashier: 'i-receipt', staff: 'i-user', buyer: 'i-cart', viewer: 'i-user' };
    const roleIcon = roleIcons[roleClean] || 'i-user';
    badge.innerHTML = `<span class="ico-lbl"><svg class="icon icon-sm"><use href="#${roleIcon}"/></svg> ${roleClean.toUpperCase()}</span>`;
  }

  const catalogForm = document.querySelector('.catalog-form-wrap');
  if (catalogForm) {
    catalogForm.style.display = hasPermission(roleClean, 'inventory:add') ? 'block' : 'none';
  }

  const summaryContainer = document.getElementById('dailySummaryContainer');
  if (summaryContainer) {
    summaryContainer.style.display = (roleClean === 'cashier') ? 'none' : 'block';
  }

  const syncUrlInput = document.getElementById('setSyncUrl');
  if (syncUrlInput) syncUrlInput.disabled = !hasPermission(roleClean, 'settings:configure');

  const gearBtn = document.getElementById('gearSettingsBtn');
  if (gearBtn) gearBtn.style.display = hasPermission(roleClean, 'settings:configure') ? '' : 'none';
}
