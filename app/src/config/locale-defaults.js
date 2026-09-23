// config/locale-defaults.js
// Rough timezone -> {country, currency} guess used to prefill Step 2/3 of
// the onboarding wizard. Deliberately coarse and best-effort: it only needs
// to save a tap for the common case, never to be authoritative. Country
// stays a free-text input and currency stays a normal <select>, so a wrong
// or missing guess costs the user nothing beyond typing/picking it
// themselves — this never blocks or overrides an explicit answer.
const TZ_DEFAULTS = {
  'Africa/Addis_Ababa': { country: 'Ethiopia', currency: 'ETB' },
  'Africa/Nairobi': { country: 'Kenya', currency: 'KES' },
  'Africa/Lagos': { country: 'Nigeria', currency: 'NGN' },
  'Africa/Accra': { country: 'Ghana', currency: 'GHS' },
  'Africa/Dar_es_Salaam': { country: 'Tanzania', currency: 'TZS' },
  'Africa/Kampala': { country: 'Uganda', currency: 'UGX' },
  'Africa/Johannesburg': { country: 'South Africa', currency: 'ZAR' },
  'Africa/Abidjan': { country: 'Ivory Coast', currency: 'XOF' },
  'Africa/Dakar': { country: 'Senegal', currency: 'XOF' },
  'Africa/Bamako': { country: 'Mali', currency: 'XOF' },
  'Asia/Kolkata': { country: 'India', currency: 'INR' },
  'Asia/Calcutta': { country: 'India', currency: 'INR' },
  'Europe/London': { country: 'United Kingdom', currency: 'GBP' },
  'Europe/Dublin': { country: 'Ireland', currency: 'EUR' },
  'Europe/Paris': { country: 'France', currency: 'EUR' },
  'Europe/Berlin': { country: 'Germany', currency: 'EUR' },
  'Europe/Madrid': { country: 'Spain', currency: 'EUR' },
  'Europe/Rome': { country: 'Italy', currency: 'EUR' },
  'America/New_York': { country: 'United States', currency: 'USD' },
  'America/Chicago': { country: 'United States', currency: 'USD' },
  'America/Denver': { country: 'United States', currency: 'USD' },
  'America/Los_Angeles': { country: 'United States', currency: 'USD' },
};

// Region-only fallback for timezones not in the table above (e.g. a city in
// Europe we didn't list by name) — currency only, no country guess, since a
// region alone isn't enough to name one.
const REGION_CURRENCY = { Europe: 'EUR', Asia: 'INR', America: 'USD' };

export function guessLocationDefaults() {
  let tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch (e) {
    return { country: '', currency: '' };
  }
  if (TZ_DEFAULTS[tz]) return TZ_DEFAULTS[tz];
  const region = tz.split('/')[0];
  return { country: '', currency: REGION_CURRENCY[region] || '' };
}
