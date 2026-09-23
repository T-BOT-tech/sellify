// Phase 14.9 — country configuration projection.
// Declarative/runtime composition only. Existing organization identity and
// application config remain authoritative; this module does not persist,
// mutate, or replace Core configuration.

import { getCountryPack } from './country-pack-contract.js';
import { resolveEthiopiaIdentity } from './ethiopia-country-identity.js';
import { resolveCountryMoney } from './country-money-localization.js';
import { resolveCountryTaxBoundary } from './country-tax-boundary.js';
import { resolveCountryDocumentBoundary } from './country-document-boundary.js';
import { resolveCountryPhoneAddressRules } from './country-phone-address-rules.js';
import { resolveCountryPaymentAdapterMapping } from './country-payment-adapter-mapping.js';
import { resolveCountryComplianceBoundary } from './country-compliance-boundary.js';

export const COUNTRY_CONFIGURATION_CONTRACT = Object.freeze({
  phase: '14.9',
  version: '1.0',
  authority: 'existing organization identity + existing app configuration + country pack projections',
  persistence: 'none',
  mutation: 'none',
  ownsCountryState: false,
  ownsOrganizationIdentity: false,
  ownsApplicationConfig: false,
  ownsPaymentState: false,
  ownsTaxState: false,
  ownsDocumentState: false,
  ownsComplianceState: false,
});

function normalise(value) {
  return String(value || '').trim().toLowerCase();
}

export function resolveCountryConfiguration({ organization = null, config = null, timezone = '' } = {}) {
  const country = normalise(organization?.country || config?.country || '');
  if (!country) return Object.freeze({ active: false, countryCode: '', pack: null, identity: null, configuration: null });

  const countryCode = country === 'ethiopia' || country === 'et' ? 'ET' : country.toUpperCase();
  const pack = getCountryPack(countryCode);

  const identity = countryCode === 'ET'
    ? resolveEthiopiaIdentity({ organization, config, timezone })
    : null;
  const money = resolveCountryMoney(countryCode);
  const tax = resolveCountryTaxBoundary(countryCode);
  const documents = resolveCountryDocumentBoundary(countryCode);
  const phoneAddress = resolveCountryPhoneAddressRules(countryCode);
  const payments = resolveCountryPaymentAdapterMapping(countryCode);
  const compliance = resolveCountryComplianceBoundary(countryCode);

  return Object.freeze({
    active: true,
    countryCode,
    pack,
    identity,
    configuration: Object.freeze({
      currency: identity?.currency || organization?.currency || pack.currency,
      locale: identity?.locale || config?.lang || pack.locale,
      languages: [...pack.languages],
      timezone: identity?.timezone || organization?.timezone || timezone || '',
      money,
      tax,
      documents,
      phoneAddress,
      payments,
      compliance,
    }),
  });
}

export function countryConfigurationContract() {
  return COUNTRY_CONFIGURATION_CONTRACT;
}
