// Phase 13 — Shared declarative Pack manifest data.
// This module contains data only so both client experience code and server
// lifecycle enforcement consume the same Pack manifest without importing
// frontend modules into the backend.

export const VERTICAL_PACK_MANIFESTS = Object.freeze({
  agriculture: Object.freeze({
    pack_id: 'agriculture', name: 'Agriculture', version: '0.1.0',
    capabilities: Object.freeze(['farm-management','plot-management','season-management','crop-management','harvest-management','commodity-management','collection-center-management','buyer-management']),
    configuration: Object.freeze({ foundation: true, identity_bridge: 'phase13.3', inventory_bridge: 'phase13.5', commerce_bridge: 'phase13.6' }),
    permissions: Object.freeze(['agriculture:manage','agriculture:view']),
    domain_entities: Object.freeze(['Farmer','Farm','Plot','Season','Crop','Harvest','Supply','Commodity','CollectionCenter','Buyer']),
    core_dependencies: Object.freeze(['customers','locations','inventory','commerce','payments','fulfillment','audit']),
    routes: Object.freeze([]), ui_entry_points: Object.freeze([]),
    events: Object.freeze(['FARM_CREATED','PLOT_CREATED','SEASON_STARTED','CROP_PLANTED','HARVEST_RECORDED','COMMODITY_RECEIVED','COMMODITY_SOLD']),
  }),
  restaurant: Object.freeze({
    pack_id: 'restaurant', name: 'Restaurant', version: '0.1.0',
    capabilities: Object.freeze(['table-management','kitchen-management','restaurant-order-context']),
    configuration: Object.freeze({ implementation: 'existing', tables_module: 'app/src/restaurant/tables.js', kitchen_module: 'app/src/restaurant/kitchen.js', kitchen_bridge: 'app/src/verticals/restaurant/kitchen-integration.js', recipe_ingredient_bridge: 'app/src/verticals/restaurant/recipe-ingredient-bridge.js', inventory_consumption_bridge: 'app/src/verticals/restaurant/inventory-consumption.js', order_payment_bridge: 'app/src/verticals/restaurant/order-payment-compatibility.js', niche_switch: 'config.businessModel=restaurant' }),
    permissions: Object.freeze(['tables:manage','tables:status','kitchen:manage']),
    domain_entities: Object.freeze(['Table','KitchenTicket','Recipe','Preparation']),
    core_dependencies: Object.freeze(['commerce','inventory','payments','customers','locations','fulfillment','audit']),
    routes: Object.freeze([]), ui_entry_points: Object.freeze(['tables','kitchen']),
    events: Object.freeze(['TABLE_OPENED','KITCHEN_TICKET_CREATED','KITCHEN_ORDER_READY']),
  }),
  warehouse: Object.freeze({
    pack_id: 'warehouse', name: 'Warehouse', version: '0.1.0',
    capabilities: Object.freeze(['warehouse-inventory','warehouse-receiving','warehouse-storage','warehouse-transactions','warehouse-location-context','warehouse-stock-adjustment']),
    configuration: Object.freeze({ implementation: 'existing', inventory_module: 'app/src/warehouse/inventory.js', ledger_module: 'app/src/warehouse/ledger.js', locations_module: 'app/src/warehouse/locations.js', ui_module: 'app/src/warehouse/ui.js', fulfillment_module: 'app/src/logistics/fulfillment.js', niche_switch: 'config.warehouseEnabled=true' }),
    permissions: Object.freeze(['inventory:add','inventory:edit']),
    domain_entities: Object.freeze(['StorageBin','Receiving','StockAdjustment']),
    core_dependencies: Object.freeze(['commerce','inventory','customers','locations','fulfillment','audit']),
    routes: Object.freeze([]), ui_entry_points: Object.freeze(['inventory','receiving','transactions','locations']),
    events: Object.freeze(['STOCK_RECEIVED','STOCK_ADJUSTED']),
  }),
  logistics: Object.freeze({
    pack_id: 'logistics', name: 'Logistics', version: '0.1.0',
    capabilities: Object.freeze(['logistics-fulfillment','logistics-shipment','logistics-delivery','logistics-proof','logistics-returns','logistics-routes','logistics-courier','logistics-scheduling']),
    optional_capabilities: Object.freeze([]),
    roles: Object.freeze(['logistics_manager','logistics_dispatcher','logistics_courier','logistics_viewer']),
    navigation_contributions: Object.freeze(['logistics']),
    device_requirements: Object.freeze([]),
    offline_requirements: Object.freeze(['canonical-command-outbox','reconciliation']),
    localization_resources: Object.freeze(['logistics']),
    configuration: Object.freeze({ implementation: 'existing', fulfillment_module: 'app/src/logistics/fulfillment.js', physical_flow_module: 'app/src/logistics/physical-flow.js', ui_module: 'app/src/logistics/ui.js', niche_switch: 'config.logisticsEnabled=true' }),
    permissions: Object.freeze(['logistics:scheduling:view','logistics:scheduling:request','logistics:scheduling:manage','logistics:scheduling:confirm','logistics:scheduling:cancel']),
    domain_entities: Object.freeze(['Courier','Route','Shipment','Delivery','Proof','Return']),
    core_dependencies: Object.freeze(['commerce','inventory','customers','locations','fulfillment','audit']),
    routes: Object.freeze([]), ui_entry_points: Object.freeze(['logistics']),
    events: Object.freeze(['FULFILLMENT_CREATED','FULFILLMENT_SHIPPED','DELIVERY_COMPLETED','RETURN_REQUESTED']),
  }),
});

export const VERTICAL_PACK_MANIFEST_LIST = Object.freeze(Object.values(VERTICAL_PACK_MANIFESTS));
