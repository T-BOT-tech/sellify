// b2b/pricing.js
// Phase 6 extraction (see modularization plan §5): pricing-tier and
// volume-discount lookups plus effectiveUnitPrice() — the function
// products/render.js, orders/cart.js, and orders/checkout.js all call on
// every render/checkout — moved out of main.js unchanged. pricingTiers and
// volumeDiscountTiers themselves already live in state.js (Phase 2).
import { STORAGE_KEYS } from '../constants.js';
import { config, pricingTiers, volumeDiscountTiers } from '../state.js';
import { saveJSON } from '../storage/json.js';
import { applyPercentDiscount } from '../utils/money.js';
import { isWholesaleEnabled, selectedB2BAccountId, getB2BAccountById } from './accounts.js';

export function isVolumeDiscountEnabled() {
  return !!config.volumeDiscountEnabled;
}
export function getPricingTierById(id) {
  return pricingTiers.find(tier => tier.id === id);
}
export function savePricingTiers() {
  saveJSON(STORAGE_KEYS.pricingTiers, pricingTiers);
}
export function saveVolumeDiscountTiers() {
  saveJSON(STORAGE_KEYS.volumeDiscounts, volumeDiscountTiers);
}
// The single best-matching break for this quantity — the highest minQty the
// quantity still clears. Returns null if none apply (or the feature is off).
export function getVolumeDiscountForQty(qty) {
  if (!isVolumeDiscountEnabled()) return null;
  let best = null;
  for (const tier of volumeDiscountTiers) {
    if (qty >= tier.minQty && (!best || tier.minQty > best.minQty)) best = tier;
  }
  return best;
}
// Returns what this product should cost right now, given the currently selected
// B2B account's pricing tier and how many units of it are in the order — both
// discounts apply together (tier % first, then volume % on the result).
// Phase 4: p.price is an integer minor-unit amount (see utils/money.js) —
// discounts are applied and rounded in integer minor units the whole way
// through (applyPercentDiscount), never as an intermediate float, so a
// tier-then-volume discount chain can't drift by a fractional cent.
export function effectiveUnitPrice(p, qty) {
  let price = p.price;
  if (isWholesaleEnabled() && selectedB2BAccountId) {
    const account = getB2BAccountById(selectedB2BAccountId);
    const tier = account ? getPricingTierById(account.pricing_tier_id) : null;
    if (tier && tier.discountPct) price = applyPercentDiscount(price, tier.discountPct);
  }
  const volumeDiscount = getVolumeDiscountForQty(qty || 0);
  if (volumeDiscount) price = applyPercentDiscount(price, volumeDiscount.discountPct);
  return Math.max(0, price);
}
