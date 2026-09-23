// config/niche.js
// Phase 3 extraction (see modularization plan §5): retail-niche presets and
// business-model taxonomy, moved out of main.js unchanged.
import { config } from '../state.js';

// ---------- Business-type taxonomy presets (from the Retail Niche Switcher) ----------
// Selecting a business type here seeds category pills, per-product unit choices,
// and optional compliance/context tags throughout the app.
export const NICHE_PRESETS = {
  Grocery: {
    title: "Grocery / FMCG",
    categories: ["Grains & Pulses", "Cooking Oils", "Spices", "Dairy", "Snacks", "Cleaning Supplies"],
    units: ["kg", "g", "liter", "sachet", "piece"],
    tags: ["Fractional-Sale", "High-Turnover", "Price-Sensitive", "Local-Supplier"]
  },
  Electronics: {
    title: "Electronics & Mobile",
    categories: ["Smart Feature Phones", "Solar Power", "Audio", "Chargers & Cables", "Spare Parts"],
    units: ["piece", "set", "unit"],
    tags: ["IMEI-Tracked", "Refurbished", "Solar-Compatible", "Loadshedding-Ready"]
  },
  Boutique: {
    title: "Boutique & Apparel",
    categories: ["Traditional Wear", "Casual Wear", "Footwear", "Tailoring Fabrics", "Accessories"],
    units: ["piece", "meter", "yard", "set"],
    tags: ["Bespoke-Custom", "Imported", "Seasonal-Festival", "Bundle-Eligible"]
  },
  Hardware: {
    title: "Hardware & Building Supplies",
    categories: ["Plumbing", "Electrical", "Fasteners", "Paints", "Hand Tools", "Roofing & Cement"],
    units: ["piece", "meter", "kg", "bag", "tin"],
    tags: ["Bulk-Tiered", "Contractor-Grade", "Heavy-Freight", "Credit-Eligible"]
  },
  AgriRetail: {
    title: "Agri-Retail & Feeds",
    categories: ["Seeds", "Fertilizers", "Animal Feed", "Crop Protection", "Hand Implements"],
    units: ["kg", "50kg-bag", "liter", "sachet", "pack"],
    tags: ["Expiry-Sensitive", "Seasonal-Crop", "Batch-Tracked", "Government-Subsidized"]
  },
  Pharmacy: {
    title: "Pharmacy & Health",
    categories: ["OTC Relief", "Antibiotics", "Supplements", "Infant Care", "First Aid"],
    units: ["strip", "tablet", "bottle", "box", "sachet"],
    tags: ["Rx-Required", "Batch-Tracked", "Cold-Chain", "Single-Dose"]
  }
};
export function getNichePreset() {
  return (config && config.niche) ? NICHE_PRESETS[config.niche] : null;
}

// ---------- Business model: what kind of business this is (orthogonal to niche) ----------
// Niche (Grocery/Pharmacy/etc.) only applies within Retail — Restaurant uses menu/table/kitchen instead.
export const BUSINESS_MODELS = {
  retail: {
    label: '���� Retail Store',
    catalogNav: 'Catalog',
    catalogHeading: 'Your products',
    itemNamePlaceholder: 'Product name',
    showNiche: true,
    extraTabs: []
  },
  restaurant: {
    label: '🍳 Restaurant / Cafe',
    catalogNav: 'Menu',
    catalogHeading: 'Your menu',
    itemNamePlaceholder: 'Menu item name',
    showNiche: false,
    extraTabs: ['tables', 'kitchen']
  }
};
export function getBusinessModel() {
  return BUSINESS_MODELS[config.businessModel] || BUSINESS_MODELS.retail;
}
export function isRestaurant() {
  return config.businessModel === 'restaurant';
}

// (RESTAURANT_COURSES now comes from constants.js.)
