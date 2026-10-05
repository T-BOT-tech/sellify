// Central authorization policy for Sellify Phase 10.3.
//
// This module deliberately contains policy only. Authentication/session
// resolution remains in store-sqlite.js/server.js, and UI permission checks
// remain a presentation concern. Route handlers call authorize() after the
// authenticated session has been established.

export const AUTHZ = Object.freeze({
  ALLOW: 'ALLOW',
  DENY: 'DENY',
  REQUIRES_APPROVAL: 'REQUIRES_APPROVAL',
});

export const ROLES = Object.freeze([
  'owner',
  'manager',
  'cashier',
  'staff',
  'buyer',
  'viewer',
]);

// Keep this matrix aligned with the existing server behavior first. New
// permissions should be introduced deliberately rather than broadening a
// role merely because a UI control exists.
const ROLE_PERMISSIONS = Object.freeze({
  owner: new Set(['*']),
  manager: new Set([
    'orders:create', 'orders:view', 'orders:delete', 'fulfillment:view', 'fulfillment:update',
    'payments:accept', 'payments:view_proof', 'payments:view', 'payments:manage', 'payments:reconcile', 'payments:settlement:view', 'payments:settlement:allocate', 'payments:route',
    'inventory:add', 'inventory:edit', 'sync:manual',
    'settings:configure', 'paymethods:manage',
    'tables:manage', 'tables:status', 'kitchen:manage',
    'b2b:manage', 'b2b:invoice:view', 'b2b:invoice:create', 'b2b:invoice:manage', 'b2b:ar:view', 'b2b:ar:create', 'b2b:ar:manage', 'b2b:ar:allocate', 'b2b:pricing:view', 'b2b:pricing:manage', 'b2b:quotes:view', 'b2b:quotes:manage', 'b2b:po:view', 'b2b:po:create', 'b2b:po:approve', 'b2b:credit:view', 'b2b:credit:create', 'b2b:credit:manage', 'b2b:credit:approve', 'devices:manage',
    'locations:view', 'locations:manage', 'audit:view',
    'pack:lifecycle:view', 'pack:lifecycle:install', 'pack:lifecycle:activate', 'pack:lifecycle:deactivate', 'pack:lifecycle:upgrade', 'membership:role:manage',
    'marketplace_orders:view', 'marketplace_orders:update',
    'customers:view', 'customers:manage',
    'inventory:view', 'compliance:manage',
    'supplier-network:view', 'supplier-network:manage', 'supplier-network:publish', 'supplier-network:suspend', 'supplier-network:capability:view', 'supplier-network:capability:manage', 'supplier-network:capability:activate', 'supplier-network:capability:deactivate', 'supplier-network:catalog:view', 'supplier-network:catalog:manage', 'supplier-network:catalog:activate', 'supplier-network:catalog:deactivate', 'supplier-network:service-area:view', 'supplier-network:service-area:manage', 'supplier-network:service-area:activate', 'supplier-network:service-area:deactivate', 'supplier-network:commercial:view', 'supplier-network:commercial:manage', 'supplier-network:commercial:activate', 'supplier-network:commercial:deactivate', 'supplier-network:qualification:view', 'supplier-network:qualification:manage', 'supplier-network:qualification:document', 'supplier-network:qualification:verify', 'supplier-network:qualification:revoke', 'supplier-network:performance:view', 'supplier-network:performance:recalculate', 'supplier-network:trust:view', 'supplier-network:trust:refresh', 'supplier-network:discovery:discover', 'supplier-network:marketplace-integration:view',
    'procurement:demand:view', 'procurement:demand:create', 'procurement:demand:manage', 'procurement:demand:submit', 'procurement:demand:cancel', 'procurement:demand:sourcing', 'procurement:supplier:view', 'procurement:supplier:manage', 'procurement:supplier:discover', 'procurement:supplier:relationship:view', 'procurement:supplier:relationship:manage', 'procurement:rfq:view', 'procurement:rfq:create', 'procurement:rfq:manage', 'procurement:rfq:send', 'procurement:rfq:close', 'procurement:rfq:respond', 'procurement:comparison:view', 'procurement:comparison:create', 'procurement:award:view', 'procurement:award:create', 'procurement:award:confirm', 'procurement:award:cancel', 'procurement:award:execute', 'procurement:receipt:view', 'procurement:receipt:create', 'procurement:receipt:cancel', 'procurement:payment:create',
  ]),
  cashier: new Set([
    'orders:create', 'orders:view', 'fulfillment:view', 'fulfillment:update', 'payments:accept', 'payments:view',
    'tables:status', 'kitchen:manage', 'locations:view',
    'customers:view', 'customers:manage',
    'marketplace_orders:view', 'marketplace_orders:update',
    'inventory:view',
  ]),
  staff: new Set(['locations:view', 'customers:view', 'inventory:view', 'fulfillment:view']),
  buyer: new Set(['orders:create', 'b2b:po:view', 'b2b:po:create', 'supplier-network:trust:view', 'supplier-network:discovery:discover', 'supplier-network:marketplace-integration:view', 'procurement:demand:view', 'procurement:demand:create', 'procurement:demand:manage', 'procurement:demand:submit', 'procurement:demand:cancel', 'procurement:demand:sourcing', 'procurement:rfq:view', 'procurement:rfq:create', 'procurement:rfq:manage', 'procurement:rfq:send', 'procurement:rfq:close', 'procurement:comparison:view', 'procurement:comparison:create', 'procurement:award:execute', 'procurement:receipt:view', 'procurement:receipt:create']),
  viewer: new Set([]),
  // FUX-6 Restaurant contextual roles. These are executable only when the
  // Restaurant Pack is active; assignment is handled through membership_roles.
  restaurant_waiter: new Set([
    'orders:create', 'orders:view', 'tables:status', 'customers:view', 'locations:view',
  ]),
  restaurant_kitchen_staff: new Set([
    'orders:view', 'kitchen:manage', 'inventory:view', 'locations:view',
  ]),
  warehouse_receiving: new Set([
    'inventory:view', 'inventory:add', 'locations:view',
  ]),
  warehouse_picker_packer: new Set([
    'inventory:view', 'locations:view',
  ]),
  warehouse_inventory_staff: new Set([
    'inventory:view', 'inventory:add', 'inventory:edit', 'locations:view',
  ]),
  // FUX-2 Retail/POS contextual roles. Store Owner/Store Manager remain
  // reconciled to canonical owner/manager; only scoped operational roles
  // need explicit contextual IDs here.
  retail_cashier: new Set([
    'orders:create', 'orders:view', 'payments:accept', 'payments:view', 'inventory:view', 'locations:view', 'customers:view',
  ]),
  retail_stock_staff: new Set([
    'inventory:view', 'inventory:add', 'inventory:edit', 'orders:view', 'locations:view',
  ]),
  // FUX-2 Agriculture contextual roles. Agriculture remains a semantic/declarative
  // Pack in the current source; these roles do not create a second domain authority.
  agriculture_farm_manager: new Set([
    'agriculture:view', 'agriculture:manage', 'locations:view',
  ]),
  agriculture_field_staff: new Set([
    'agriculture:view', 'agriculture:manage', 'locations:view',
  ]),
  // FUX-2 Procurement contextual roles. Procurement Manager remains
  // reconciled to canonical manager; Buyer/Requester and Approver need
  // explicit scoped operational roles so preparation and approval/execution
  // are not collapsed into one canonical role.
  procurement_buyer_requester: new Set([
    'procurement:demand:view', 'procurement:demand:create', 'procurement:demand:manage',
    'procurement:demand:submit', 'procurement:demand:cancel', 'procurement:demand:sourcing',
    'procurement:supplier:view', 'procurement:supplier:discover',
    'procurement:rfq:view', 'procurement:rfq:create', 'procurement:rfq:manage',
    'procurement:rfq:send', 'procurement:rfq:close',
    'procurement:comparison:view', 'procurement:comparison:create',
    'procurement:award:view', 'b2b:po:view', 'b2b:po:create',
    'procurement:receipt:view', 'procurement:receipt:create', 'locations:view',
  ]),
  procurement_approver: new Set([
    'procurement:comparison:view', 'procurement:award:view',
    'procurement:award:confirm', 'procurement:award:cancel',
    'b2b:po:view', 'locations:view',
  ]),
  // FUX-2 Supplier Network contextual roles. Organization remains the
  // canonical identity; these roles only scope existing Supplier Network
  // capabilities. Qualification verification remains a separate governance
  // action and is intentionally not granted to supplier-side roles.
  supplier_network_admin: new Set([
    'supplier-network:view', 'supplier-network:manage', 'supplier-network:publish', 'supplier-network:suspend',
    'supplier-network:capability:view', 'supplier-network:capability:manage', 'supplier-network:capability:activate', 'supplier-network:capability:deactivate',
    'supplier-network:capacity:view', 'supplier-network:capacity:manage', 'supplier-network:capacity:activate', 'supplier-network:capacity:deactivate',
    'supplier-network:catalog:view', 'supplier-network:catalog:manage', 'supplier-network:catalog:activate', 'supplier-network:catalog:deactivate',
    'supplier-network:service-area:view', 'supplier-network:service-area:manage', 'supplier-network:service-area:activate', 'supplier-network:service-area:deactivate',
    'supplier-network:commercial:view', 'supplier-network:commercial:manage', 'supplier-network:commercial:activate', 'supplier-network:commercial:deactivate',
    'supplier-network:qualification:view', 'supplier-network:qualification:manage', 'supplier-network:qualification:document',
    'locations:view',
  ]),
  // FUX-2 Marketplace contextual seller roles. Marketplace Buyer maps to the
  // existing canonical buyer role; seller roles only expose existing
  // marketplace order operations and do not create catalog, payment, inventory,
  // fulfillment, or logistics authority.
  marketplace_seller_admin: new Set([
    'marketplace_orders:view', 'marketplace_orders:update',
    'locations:view',
  ]),
  marketplace_seller_staff: new Set([
    'marketplace_orders:view', 'marketplace_orders:update',
    'locations:view',
  ]),
  // GAP-2 foundation — Logistics contextual roles. Assignment ownership is
  // intentionally not implied by these permissions; courier mutation remains
  // gated until the canonical delivery-assignment authority is enforced.
  logistics_manager: new Set([
    'fulfillment:view', 'fulfillment:update', 'logistics:deliveries:view',
    'logistics:deliveries:assign', 'logistics:deliveries:reassign',
    'logistics:deliveries:update_assigned', 'locations:view', 'audit:view',
    'logistics:scheduling:view', 'logistics:scheduling:request',
    'logistics:scheduling:manage', 'logistics:scheduling:confirm',
    'logistics:scheduling:cancel',
  ]),
  logistics_dispatcher: new Set([
    'fulfillment:view', 'fulfillment:update', 'logistics:deliveries:view',
    'logistics:deliveries:assign', 'logistics:deliveries:reassign',
    'locations:view',
    'logistics:scheduling:view', 'logistics:scheduling:request',
    'logistics:scheduling:manage', 'logistics:scheduling:confirm',
    'logistics:scheduling:cancel',
  ]),
  logistics_courier: new Set([
    'fulfillment:view', 'logistics:deliveries:view',
    'logistics:deliveries:update_assigned', 'locations:view',
    'logistics:scheduling:view',
  ]),
  logistics_viewer: new Set([
    'fulfillment:view', 'logistics:deliveries:view', 'locations:view',
    'logistics:scheduling:view',
  ]),
  supplier_network_staff: new Set([
    'supplier-network:view', 'supplier-network:manage',
    'supplier-network:capability:view', 'supplier-network:capability:manage',
    'supplier-network:capacity:view', 'supplier-network:capacity:manage',
    'supplier-network:catalog:view', 'supplier-network:catalog:manage',
    'supplier-network:service-area:view', 'supplier-network:service-area:manage',
    'supplier-network:commercial:view', 'supplier-network:commercial:manage',
    'supplier-network:qualification:view', 'supplier-network:qualification:manage', 'supplier-network:qualification:document',
    'locations:view',
  ]),
});

const OWNER_ONLY_ACTIONS = new Set([
  'locations:manage',
]);

function cleanRole(role) {
  return String(role || '').trim().toLowerCase();
}

function cleanAction(action) {
  return String(action || '').trim().toLowerCase();
}

const CONTEXTUAL_ROLE_PACK_REQUIREMENTS = Object.freeze({
  restaurant_waiter: 'restaurant',
  restaurant_kitchen_staff: 'restaurant',
  warehouse_receiving: 'warehouse',
  warehouse_picker_packer: 'warehouse',
  warehouse_inventory_staff: 'warehouse',
  logistics_manager: 'logistics',
  logistics_dispatcher: 'logistics',
  logistics_courier: 'logistics',
  logistics_viewer: 'logistics',
});

export function requiredPackForRole(role) {
  return CONTEXTUAL_ROLE_PACK_REQUIREMENTS[cleanRole(role)] || null;
}

/**
 * Canonical policy contract:
 * authorize(actor, organization, location, resource, action)
 *   -> ALLOW | DENY | REQUIRES_APPROVAL
 *
 * actor is normally the authenticated session object. organization and
 * location may be objects or ids; only ids are used by this policy layer.
 */
export function authorize(actor, organization, location, resource, action) {
  if (!actor || !actor.userId) return AUTHZ.DENY;

  const role = cleanRole(actor.role);
  const permission = cleanAction(action);
  if (!role || !permission || !resource) return AUTHZ.DENY;

  // Contextual roles are scoped authorities, not tenant-wide role strings.
  // Only organization-scoped assignments are effective without an explicit
  // location/resource scope. Location assignments require the requested
  // location to match the assignment. Resource-scoped assignments remain
  // non-executable until a canonical resource-context contract is supplied.
  const contextualRoles = Array.isArray(actor.contextualRoles) ? actor.contextualRoles : [];
  const effectiveContextualRoles = contextualRoles
    .map(item => ({
      role: cleanRole(item?.role),
      scopeType: String(item?.scopeType || 'ORGANIZATION').trim().toUpperCase(),
      scopeId: item?.scopeId == null ? null : String(item.scopeId),
    }))
    .filter(item => {
      if (!item.role) return false;
      if (item.scopeType === 'ORGANIZATION') return true;
      if (item.scopeType === 'LOCATION') {
        const requestedLocationId = location && typeof location === 'object'
          ? location.id ?? location.locationId
          : location;
        return requestedLocationId != null && String(requestedLocationId) === item.scopeId;
      }
      return false;
    })
    .map(item => item.role);

  const actorRoles = Array.from(new Set([role, ...effectiveContextualRoles]));
  if (!actorRoles.length) return AUTHZ.DENY;

  // A tenant-scoped session is never allowed to operate on another
  // organization. This is intentionally checked even though legacy chat_id
  // boundaries are still enforced by requireSession().
  const actorOrganizationId = actor.organizationId == null ? null : String(actor.organizationId);
  const organizationId = organization == null
    ? null
    : String(typeof organization === 'object' ? organization.id ?? organization.organizationId : organization);
  if (organizationId && actorOrganizationId && actorOrganizationId !== organizationId) {
    return AUTHZ.DENY;
  }
  if (organizationId && !actorOrganizationId) return AUTHZ.DENY;

  // If a location is supplied, it must belong to the actor's organization.
  const locationOrganizationId = location && typeof location === 'object'
    ? location.organizationId ?? location.organization_id
    : null;
  if (locationOrganizationId && actorOrganizationId && String(locationOrganizationId) !== actorOrganizationId) {
    return AUTHZ.DENY;
  }

  if (OWNER_ONLY_ACTIONS.has(permission) && !actorRoles.includes('owner') && !actorRoles.includes('manager')) {
    return AUTHZ.DENY;
  }

  const permissions = actorRoles
    .filter(candidate => ROLE_PERMISSIONS[candidate])
    .map(candidate => ROLE_PERMISSIONS[candidate]);
  return permissions.some(set => set.has('*') || set.has(permission))
    ? AUTHZ.ALLOW
    : AUTHZ.DENY;
}

export function hasAuthorization(actor, organization, location, resource, action) {
  return authorize(actor, organization, location, resource, action) === AUTHZ.ALLOW;
}

export function logisticsSchedulingAuthorizationContract() {
  return Object.freeze({
    pack: 'logistics',
    capability: 'logistics-scheduling',
    authority: 'backend/lib/authorization.js',
    permissions: Object.freeze([
      'logistics:scheduling:view',
      'logistics:scheduling:request',
      'logistics:scheduling:manage',
      'logistics:scheduling:confirm',
      'logistics:scheduling:cancel',
    ]),
    roles: Object.freeze({
      logistics_manager: Object.freeze(['view', 'request', 'manage', 'confirm', 'cancel']),
      logistics_dispatcher: Object.freeze(['view', 'request', 'manage', 'confirm', 'cancel']),
      logistics_courier: Object.freeze(['view']),
      logistics_viewer: Object.freeze(['view']),
    }),
    enforcement: 'authorize(actor, organization, location, resource, action)',
    preparation_is_not_execution: true,
    feasibility_is_not_authorization: true,
  });
}

export function getRolePermissions(role) {
  const permissions = ROLE_PERMISSIONS[cleanRole(role)];
  return permissions ? [...permissions] : [];
}
