// config/currency.js
// Phase 3 extraction (see modularization plan §5): currency symbol
// resolution, moved out of main.js unchanged.
import { config } from '../state.js';
import { CURRENCY_SYMBOLS } from '../constants.js';

// ---------- Currency ----------
// (CURRENCY_SYMBOLS now comes from constants.js.)
export function CS() {
  if (config && config.currencySymbol) return config.currencySymbol;
  return CURRENCY_SYMBOLS[(config && config.currencyCode) || 'INR'] || '₹';
}
