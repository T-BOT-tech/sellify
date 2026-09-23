// Phase 13.8.1 — Restaurant Pack Boundary.
//
// Formalizes the boundary around the existing Restaurant implementation without
// moving or rewriting tables.js / kitchen.js. Restaurant-specific behavior stays
// in those existing modules; shared authorities remain Core.
import { defineVerticalPack } from '../contract.js';
import { VERTICAL_PACK_MANIFESTS } from '../../../../shared/vertical-pack-manifests.js';

export const RESTAURANT_PACK = defineVerticalPack(VERTICAL_PACK_MANIFESTS.restaurant);

export const RESTAURANT_BOUNDARY = Object.freeze({
  pack_id: RESTAURANT_PACK.pack_id,
  existing_modules: Object.freeze({
    tables: 'app/src/restaurant/tables.js',
    kitchen: 'app/src/restaurant/kitchen.js',
  }),
  owns: Object.freeze([
    'Table',
    'KitchenTicket',
    'Recipe',
    'Preparation',
  ]),
  bridges_to_core: Object.freeze({
    order: 'commerce',
    menu_product: 'commerce',
    modifier_definition: 'commerce',
    ingredient_stock: 'inventory',
    customer: 'customers',
    restaurant_location: 'locations',
    fulfillment: 'fulfillment',
    payment: 'payments',
    audit: 'audit',
  }),
  forbidden_parallel_authorities: Object.freeze([
    'RestaurantOrder',
    'RestaurantInventory',
    'RestaurantPayment',
    'RestaurantCustomer',
    'RestaurantLocation',
    'RestaurantFulfillment',
  ]),
});

export function isRestaurantPack(value = RESTAURANT_PACK) {
  return value === RESTAURANT_PACK || value?.pack_id === RESTAURANT_PACK.pack_id;
}
