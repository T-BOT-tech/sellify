// FUX-2 Section 6 target role-family data shared by reconciliation.
export const TARGET_PACK_ROLE_FAMILIES = Object.freeze([
  { pack: 'Core organization', roles: ['Owner', 'Admin', 'Manager', 'Staff', 'Viewer'], typicalScope: 'organization or assigned scope' },
  { pack: 'Restaurant', roles: ['Owner', 'Manager', 'Waiter / FOH', 'Chef / Kitchen Staff', 'Viewer'], typicalScope: 'FOH, kitchen, tables/orders, operations' },
  { pack: 'Retail / POS', roles: ['Store Owner', 'Store Manager', 'Cashier', 'Stock Staff', 'Viewer'], typicalScope: 'POS, catalog, stock, orders, reports' },
  { pack: 'Warehouse', roles: ['Warehouse Manager', 'Receiving', 'Picker/Packer', 'Inventory Staff', 'Viewer'], typicalScope: 'receiving, fulfillment tasks, stock' },
  { pack: 'Logistics', roles: ['Logistics Manager', 'Dispatcher/Coordinator', 'Courier', 'Viewer'], typicalScope: 'assignment, tracking, proof, coordination' },
  { pack: 'Agriculture', roles: ['Farm/Operations Manager', 'Field Staff', 'Buyer', 'Viewer'], typicalScope: 'farm, plot, season, supply context' },
  { pack: 'Procurement', roles: ['Procurement Manager', 'Buyer/Requester', 'Approver', 'Viewer'], typicalScope: 'demand, RFQ, comparison, award, PO' },
  { pack: 'Supplier Network', roles: ['Supplier Admin', 'Supplier Staff', 'Buyer Network User', 'Viewer'], typicalScope: 'profile, qualification, capacity, evidence' },
  { pack: 'Marketplace', roles: ['Seller Admin', 'Seller Staff', 'Buyer'], typicalScope: 'listings and buyer/seller workflows' },
  { pack: 'Marketplace contextual', roles: ['marketplace_seller_admin', 'marketplace_seller_staff'], typicalScope: 'seller-side marketplace order operations; organization/location/resource scope' },
]);
