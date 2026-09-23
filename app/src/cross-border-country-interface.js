// Phase 20.4 — Cross-Border Country Pack Interface.
// Composition-only interface over the existing Country Pack and its country
// boundary modules. This does not create country authority, payment state,
// tax state, document state, compliance state, or provider execution.

import { getCountryPack } from './country-pack-contract.js';
import { resolveCountryPaymentAdapterMapping } from './country-payment-adapter-mapping.js';
import { crossBorderContract } from './cross-border-contract.js';

export const CROSS_BORDER_COUNTRY_INTERFACE_VERSION = '1.0';

export const CROSS_BORDER_COUNTRY_INTERFACE = Object.freeze({
  version: CROSS_BORDER_COUNTRY_INTERFACE_VERSION,
  authority: 'existing_country_pack_and_country_boundaries',
  persistence: 'none',
  mutation: 'none',
  ownsCountryState: false,
  ownsPaymentState: false,
  ownsTaxState: false,
  ownsDocumentState: false,
  ownsComplianceState: false,
  executesProviders: false,
  providerBoundary: 'Existing Country Contract → Existing Core Capability → Adapter → Provider',
  failClosed: true,
});

const normalize = (value, field) => {
  const raw = String(value ?? '').trim();
  if (!raw) {
    throw Object.assign(new TypeError(`${field} must be a non-empty country code or country name`), {
      code: 'CROSS_BORDER_COUNTRY_INTERFACE_INVALID',
    });
  }
  // Reuse the existing Country Pack alias/validation authority rather than
  // creating a second country-name registry here.
  return getCountryPack(raw).countryCode;
};

function buildCountryView(countryCode) {
  const code = normalize(countryCode, 'countryCode');
  const pack = getCountryPack(code);
  const payment = resolveCountryPaymentAdapterMapping(code);

  return Object.freeze({
    countryCode: pack.countryCode,
    currency: pack.currency,
    locale: pack.locale,
    languages: Object.freeze([...pack.languages]),
    tax: Object.freeze({ ...pack.tax }),
    documents: Object.freeze({ ...pack.documents }),
    phoneRules: Object.freeze({ ...pack.phoneRules }),
    addressRules: Object.freeze({ ...pack.addressRules }),
    compliance: Object.freeze({ ...pack.compliance }),
    money: Object.freeze({
      currencyCode: pack.currency,
      authority: 'existing_money_authority',
      persistence: 'none',
    }),
    payment: Object.freeze({
      providers: Object.freeze([...payment.providers]),
      channels: Object.freeze([...payment.channels]),
      providerMetadata: Object.freeze(payment.providerMetadata.map((item) => Object.freeze({ ...item }))),
      channelMetadata: Object.freeze(payment.channelMetadata.map((item) => Object.freeze({ ...item }))),
      execution: 'existing_payment_authority_only',
    }),
    sourceAuthority: 'country_pack_contract',
    persistent: false,
    authoritative: false,
  });
}

export function resolveCrossBorderCountryInterface({ origin, destination } = {}) {
  const from = normalize(origin, 'origin');
  const to = normalize(destination, 'destination');
  if (from === to) {
    throw Object.assign(new Error('Cross-border country interface requires different countries'), {
      code: 'CROSS_BORDER_SAME_COUNTRY',
    });
  }

  // Assert the Phase 20 constitution remains available and authoritative for
  // the coordination boundary. Country-specific authority stays elsewhere.
  const constitution = crossBorderContract();
  if (constitution.duplicateAuthority || constitution.persistence !== 'none') {
    throw new Error('Invalid cross-border constitution for country interface');
  }

  return Object.freeze({
    contractVersion: CROSS_BORDER_COUNTRY_INTERFACE_VERSION,
    origin: buildCountryView(from),
    destination: buildCountryView(to),
    countryBoundary: 'existing_country_pack_authority',
    taxExecution: 'country_overlay_only',
    documentExecution: 'existing_document_authority_only',
    complianceExecution: 'existing_compliance_authority_only',
    paymentExecution: 'existing_payment_authority_only',
    persistence: 'none',
    mutation: 'none',
    provenance: Object.freeze({
      origin: 'country-pack-contract',
      money: 'country-pack-contract',
      payment: 'country-payment-adapter-mapping',
    }),
  });
}

export function assertCrossBorderCountryInterface(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('country interface must be an object');
  }
  if (value.persistence !== 'none' || value.mutation !== 'none') {
    throw new Error('Cross-border country interface must remain persistence-free and mutation-free');
  }
  if (value.paymentExecution !== 'existing_payment_authority_only') {
    throw new Error('Cross-border country interface cannot own payment execution');
  }
  if (value.taxExecution !== 'country_overlay_only') {
    throw new Error('Cross-border country interface cannot own global tax execution');
  }
  if (value.documentExecution !== 'existing_document_authority_only') {
    throw new Error('Cross-border country interface cannot own document execution');
  }
  if (value.complianceExecution !== 'existing_compliance_authority_only') {
    throw new Error('Cross-border country interface cannot own compliance execution');
  }
  return true;
}
