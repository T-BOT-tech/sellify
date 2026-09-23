// Phase 19.6 — unified discovery market context.
// Normalizes shared discovery filters without becoming a country, currency,
// inventory, pricing, FX, or geography authority.
import { getCountryPack } from '../../../app/src/country-pack-contract.js';
import { getCurrencyMetadata } from '../../../app/src/currency-money-contract.js';

const COMMERCIAL_MODES = Object.freeze(['RETAIL', 'WHOLESALE', 'BULK', 'B2B', 'PROCUREMENT', 'SERVICES']);

function clean(value, max = 200) {
  return String(value == null ? '' : value).trim().slice(0, max);
}
function optionalPositiveNumber(value, field) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw Object.assign(new Error(`${field} must be a positive number`), { code: 'DISCOVERY_MARKET_CONTEXT_INVALID', statusCode: 400 });
  return n;
}
function optionalInteger(value, field) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw Object.assign(new Error(`${field} must be a non-negative integer`), { code: 'DISCOVERY_MARKET_CONTEXT_INVALID', statusCode: 400 });
  return n;
}

export function normalizeDiscoveryMarketContext(input = {}) {
  const countryRaw = clean(input.countryCode ?? input.country, 20);
  const currencyRaw = clean(input.currency, 10).toUpperCase();
  let countryCode = countryRaw ? countryRaw.toUpperCase() : null;
  let countryPack = null;
  if (countryCode) {
    try { countryPack = getCountryPack(countryCode); countryCode = countryPack.countryCode; }
    catch (error) {
      if (error?.code !== 'COUNTRY_PACK_UNKNOWN') throw error;
      countryCode = countryCode.toUpperCase();
      if (!/^[A-Z]{2}$/.test(countryCode)) throw Object.assign(new Error(`countryCode must be ISO-3166-1 alpha-2 shape`), { code: 'DISCOVERY_MARKET_CONTEXT_INVALID', statusCode: 400 });
    }
  }

  let currency = currencyRaw || null;
  if (currency) {
    if (!/^[A-Z]{3}$/.test(currency)) throw Object.assign(new Error(`currency must be ISO-4217 shape`), { code: 'DISCOVERY_MARKET_CONTEXT_INVALID', statusCode: 400 });
    try { currency = getCurrencyMetadata(currency).code; }
    catch (error) { if (error?.code !== 'CURRENCY_METADATA_UNKNOWN') throw error; }
  }
  if (!currency && countryPack) currency = countryPack.currency;

  const commercialMode = clean(input.commercialMode ?? input.commercial_mode ?? '', 40).toUpperCase() || null;
  if (commercialMode && !COMMERCIAL_MODES.includes(commercialMode)) {
    throw Object.assign(new Error(`Unsupported commercialMode: ${commercialMode}`), { code: 'DISCOVERY_MARKET_CONTEXT_INVALID', statusCode: 400 });
  }

  const quantity = optionalPositiveNumber(input.quantity, 'quantity');
  const minimumQuantity = optionalPositiveNumber(input.minimumQuantity ?? input.minimum_quantity, 'minimumQuantity');
  const limit = optionalInteger(input.limit, 'limit');
  const wholesale = input.wholesale == null || input.wholesale === '' ? null : Boolean(input.wholesale === true || input.wholesale === 1 || String(input.wholesale).toLowerCase() === 'true');
  const bulkOrder = input.bulkOrder == null || input.bulkOrder === '' ? null : Boolean(input.bulkOrder === true || input.bulkOrder === 1 || String(input.bulkOrder).toLowerCase() === 'true');

  return Object.freeze({
    search: clean(input.search ?? input.q ?? input.object, 300) || null,
    object: clean(input.object, 200) || null,
    category: clean(input.category, 120) || null,
    productId: clean(input.productId ?? input.product_id, 200) || null,
    capabilityCode: clean(input.capabilityCode ?? input.capability_code, 120) || null,
    countryCode,
    geoCode: clean(input.geoCode ?? input.geo_code, 200) || null,
    currency,
    quantity,
    unit: clean(input.unit, 50) || null,
    minimumQuantity,
    commercialMode,
    wholesale,
    bulkOrder,
    qualificationType: clean(input.qualificationType ?? input.qualification_type, 120) || null,
    availabilityFrom: clean(input.availabilityFrom ?? input.availability_from, 80) || null,
    availabilityTo: clean(input.availabilityTo ?? input.availability_to, 80) || null,
    seller: clean(input.seller, 200) || null,
    limit,
  });
}

export function discoveryMarketContextContract() {
  return Object.freeze({
    version: '1.0',
    authority: 'discovery_market_context_contract',
    persistence: 'none',
    countryAuthority: 'country_pack_contract',
    currencyAuthority: 'currency_metadata_contract',
    geographyAuthority: 'provider_or_country_pack',
    inventoryAuthority: 'inventory',
    pricingAuthority: 'source_domain',
    exchangeRateAuthority: 'external_adapter_only',
    fields: Object.freeze(['search','object','category','productId','capabilityCode','countryCode','geoCode','currency','quantity','unit','minimumQuantity','commercialMode','wholesale','bulkOrder','qualificationType','availabilityFrom','availabilityTo','seller','limit']),
    commercialModes: [...COMMERCIAL_MODES],
    migrationRequired: false,
  });
}
