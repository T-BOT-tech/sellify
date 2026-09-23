// FUX-2A — shared read-only role catalogue data.
// Kept separate so role-catalog presentation and reconciliation metadata do not form a circular module dependency.
export const CANONICAL_ROLES = Object.freeze([
  { id: 'owner', name: 'Owner', status: 'EXISTING', description: 'Organization owner; unrestricted by the current central policy wildcard.' },
  { id: 'manager', name: 'Manager', status: 'EXISTING', description: 'Operational management role with the current central permission matrix.' },
  { id: 'cashier', name: 'Cashier', status: 'EXISTING', description: 'Frontline order, payment, table, and kitchen permissions.' },
  { id: 'staff', name: 'Staff', status: 'EXISTING', description: 'Limited operational access under the current central policy.' },
  { id: 'buyer', name: 'Buyer', status: 'EXISTING', description: 'Procurement-oriented role already recognized by the central policy.' },
  { id: 'viewer', name: 'Viewer', status: 'EXISTING', description: 'Read-only baseline role with no explicit permissions in the current policy.' },
  { id: 'restaurant_waiter', name: 'Waiter / FOH', status: 'EXISTING', description: 'Restaurant Pack role for front-of-house order/table operations.' },
  { id: 'restaurant_kitchen_staff', name: 'Chef / Kitchen Staff', status: 'EXISTING', description: 'Restaurant Pack role for kitchen operations without front-of-house payment authority.' },
  { id: 'warehouse_receiving', name: 'Receiving', status: 'EXISTING', description: 'Warehouse Pack role for receiving and inventory intake operations.' },
  { id: 'warehouse_picker_packer', name: 'Picker/Packer', status: 'EXISTING', description: 'Warehouse Pack role for fulfillment preparation without inventory adjustment authority.' },
  { id: 'warehouse_inventory_staff', name: 'Inventory Staff', status: 'EXISTING', description: 'Warehouse Pack role for inventory visibility and controlled inventory adjustments.' },
  { id: 'procurement_buyer_requester', name: 'Buyer / Requester', status: 'EXISTING', description: 'Procurement role for demand, sourcing, RFQ, comparison, and purchase-order preparation.' },
  { id: 'procurement_approver', name: 'Approver', status: 'EXISTING', description: 'Procurement role for award review and approval without award execution authority.' },
  { id: 'supplier_network_admin', name: 'Supplier Admin', status: 'EXISTING', description: 'Supplier Network role for profile, capability, capacity, catalog, service-area, commercial, and qualification preparation management.' },
  { id: 'supplier_network_staff', name: 'Supplier Staff', status: 'EXISTING', description: 'Supplier Network operational role for profile and network data maintenance without publish/suspend or qualification verification authority.' },
  { id: 'marketplace_seller_admin', name: 'Seller Admin', status: 'EXISTING', description: 'Marketplace seller-side operational role for marketplace order visibility and status operations; catalog, payment, inventory, fulfillment and logistics authority remain canonical.' },
  { id: 'marketplace_seller_staff', name: 'Seller Staff', status: 'EXISTING', description: 'Marketplace seller-side operational role for marketplace order visibility and status operations without independent payment, inventory, fulfillment or logistics authority.' },
]);
