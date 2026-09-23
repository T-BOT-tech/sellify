// utils/money.js
// Phase 4 (data integrity in money and reporting): every monetary value in
// this app — product price, cart/order line price, order total, cash
// tendered, change due — is stored as an integer number of minor currency
// units (e.g. cents/paise/kobo), never as a float. Floats can't represent
// most decimal amounts exactly (0.1 + 0.2 !== 0.3 in IEEE754), and that
// error compounds across a cart with several line items, a volume/tier
// discount, and a queue of thousands of orders — the kind of silent
// off-by-a-fraction-of-a-cent drift that's invisible until someone
// reconciles a day's till against the app's own total. Integer minor
// units make every add/multiply exact.
//
// Only two kinds of place ever see a major-unit (decimal) value: a form
// input the user is typing into, and a string being displayed. Both
// convert at the boundary via the functions below; everything stored and
// every calculation in between stays integer.

// Minor-unit decimal places per currency code. Every currency this app
// currently ships support for (see constants.js's CURRENCY_SYMBOLS) uses
// 2 decimal places, so this map is a no-op today — it exists so that a
// future 0-decimal currency (e.g. JPY, KRW) or 3-decimal currency (e.g.
// KWD, BHD) is a one-line addition here instead of a silent mispricing,
// rather than the previous hardcoded "* 100 / .toFixed(2) everywhere"
// which had no such extension point. Deliberately NOT changing this for
// any currency already listed in CURRENCY_SYMBOLS (like XOF, which in
// real-world usage has no minor unit) — retroactively changing the
// scale factor for a currency tenants may already have stored data
// under would corrupt existing amounts without a migration, which is a
// separate, deliberate change this fix does not make.
const DECIMAL_PLACES = {
  INR: 2, USD: 2, EUR: 2, GBP: 2, KES: 2, ETB: 2, NGN: 2, GHS: 2, TZS: 2, ZAR: 2,
  // Existing XOF storage remains at 2 decimals for backward compatibility.
  XOF: 2,
  // New regional/future currencies can use their canonical minor-unit scale.
  XAF: 0, BIF: 0, RWF: 0, UGX: 0,
  CDF: 2, SOS: 2, SSP: 2, ZMW: 2,
};
const DEFAULT_DECIMAL_PLACES = 2;

function decimalPlacesFor(currencyCode) {
  if (currencyCode && Object.prototype.hasOwnProperty.call(DECIMAL_PLACES, currencyCode)) {
    return DECIMAL_PLACES[currencyCode];
  }
  return DEFAULT_DECIMAL_PLACES;
}

// Major-unit input (e.g. "19.99" from a price field, or a raw legacy
// float loaded from pre-migration storage) -> integer minor units.
// Rounds rather than truncates, since a float major-unit value can land
// a hair off (1998.9999999...) before snapping to the nearest integer.
export function toMinorUnits(major, currencyCode) {
  const n = Number(major);
  if (!Number.isFinite(n)) return 0;
  const scale = 10 ** decimalPlacesFor(currencyCode);
  return Math.round(n * scale);
}

// Integer minor units -> major-unit number, for re-populating an editable
// form field (never for display text — use formatMoney for that).
export function fromMinorUnits(minor, currencyCode) {
  const n = Number(minor);
  const scale = 10 ** decimalPlacesFor(currencyCode);
  return (Number.isFinite(n) ? n : 0) / scale;
}

// The one place that turns a minor-unit integer into the string shown in
// the UI, so every screen gets the same currency-appropriate formatting
// instead of each call site rolling its own toFixed()/rounding. Callers
// prepend the currency symbol (CS()) themselves.
export function formatMoney(minor, currencyCode) {
  return fromMinorUnits(minor, currencyCode).toFixed(decimalPlacesFor(currencyCode));
}

// Sum of already-integer minor-unit values. A named helper (over a bare
// .reduce) so every money total in the app goes through the same "these
// are all integers, plain + is exact" assumption in one place.
export function sumMinor(values) {
  return values.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
}

// Applies a percentage discount to a minor-unit amount, rounding to the
// nearest whole minor unit (never a fractional cent). Used by
// b2b/pricing.js's effectiveUnitPrice for both tier and volume discounts.
export function applyPercentDiscount(minorAmount, pct) {
  if (!pct) return minorAmount;
  return Math.max(0, Math.round(minorAmount * (1 - pct / 100)));
}
