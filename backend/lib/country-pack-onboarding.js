// First Experience country onboarding is a projection over existing authorities.
// Country packs describe local configuration; security expansion decides whether
// that country is active. This module owns neither registry nor persistence.
import {
  assertCountryPack,
  countryPackContract,
  getCountryPack,
} from '../../app/src/country-pack-contract.js';
import {
  countrySecurityExpansionContract,
  countrySecurityExpansionStatus,
} from './country-security-expansion.js';

const ACTIVE_COUNTRY_STATUS = 'active_country_pack';

function countryError(code, message, statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode });
}

function displayName(countryCode) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) || countryCode;
  } catch {
    return countryCode;
  }
}

export function resolveOnboardingCountry(value) {
  const input = String(value ?? '').trim();
  if (!input) throw countryError('COUNTRY_PACK_REQUIRED', 'Select a country with an active country pack.');

  let pack;
  try {
    pack = getCountryPack(input);
  } catch {
    const status = countrySecurityExpansionStatus(input);
    if (status !== 'unknown') {
      throw countryError('COUNTRY_PACK_INACTIVE', `Country ${input.toUpperCase()} is not active for onboarding.`);
    }
    throw countryError('COUNTRY_PACK_UNKNOWN', 'The selected country does not have an active country pack.');
  }

  assertCountryPack(pack);
  const status = countrySecurityExpansionStatus(pack.countryCode);
  if (status !== ACTIVE_COUNTRY_STATUS) {
    throw countryError('COUNTRY_PACK_INACTIVE', `Country ${pack.countryCode} is not active for onboarding.`);
  }

  return Object.freeze({
    countryCode: pack.countryCode,
    currency: pack.currency,
    locale: pack.locale,
    languages: Object.freeze([...pack.languages]),
    status,
    implementationStatus: countryPackContract().implementationStatus,
  });
}

export function listOnboardingCountryOptions() {
  const activeCodes = countrySecurityExpansionContract().activeCountrySecurity;
  const options = activeCodes.map((countryCode) => {
    try {
      return Object.freeze({ ...resolveOnboardingCountry(countryCode), displayName: displayName(countryCode) });
    } catch (error) {
      throw Object.assign(
        new Error(`Active country ${countryCode} has no valid country-pack contract.`),
        { code: 'COUNTRY_PACK_REGISTRY_MISMATCH', statusCode: 500, cause: error },
      );
    }
  });
  return options.sort((a, b) => a.countryCode.localeCompare(b.countryCode));
}
