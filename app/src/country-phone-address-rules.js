// Phase 15.14 — expanded country phone/address boundary.
// Declarative metadata only. This module does not persist, own, or replace
// customer/organization identity, address persistence, or geocoding.

const COUNTRY_RULES = Object.freeze({
  ET: Object.freeze({ countryCode: 'ET', callingCode: '+251', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'boundary_only' }), address: Object.freeze({ country: 'Ethiopia', hierarchy: Object.freeze(['region', 'zone', 'woreda', 'kebele']), postalCode: 'optional', implementation: 'boundary_only' }) }),
  KE: Object.freeze({ countryCode: 'KE', callingCode: '+254', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'boundary_only' }), address: Object.freeze({ country: 'Kenya', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'boundary_only' }) }),
  TZ: Object.freeze({ countryCode: 'TZ', callingCode: '+255', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'boundary_only' }), address: Object.freeze({ country: 'Tanzania', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'boundary_only' }) }),
  NG: Object.freeze({ countryCode: 'NG', callingCode: '+234', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'boundary_only' }), address: Object.freeze({ country: 'Nigeria', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'boundary_only' }) }),
  GH: Object.freeze({ countryCode: 'GH', callingCode: '+233', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'candidate_boundary_only' }), address: Object.freeze({ country: 'Ghana', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'candidate_boundary_only' }) }),
  ZM: Object.freeze({ countryCode: 'ZM', callingCode: '+260', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'candidate_boundary_only' }), address: Object.freeze({ country: 'Zambia', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'candidate_boundary_only' }) }),
  BI: Object.freeze({ countryCode: 'BI', callingCode: '+257', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'regional_country_boundary_only' }), address: Object.freeze({ country: 'Burundi', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'regional_country_boundary_only' }) }),
  CD: Object.freeze({ countryCode: 'CD', callingCode: '+243', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'regional_country_boundary_only' }), address: Object.freeze({ country: 'Democratic Republic of the Congo', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'regional_country_boundary_only' }) }),
  RW: Object.freeze({ countryCode: 'RW', callingCode: '+250', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'regional_country_boundary_only' }), address: Object.freeze({ country: 'Rwanda', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'regional_country_boundary_only' }) }),
  SO: Object.freeze({ countryCode: 'SO', callingCode: '+252', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'regional_country_boundary_only' }), address: Object.freeze({ country: 'Somalia', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'regional_country_boundary_only' }) }),
  SS: Object.freeze({ countryCode: 'SS', callingCode: '+211', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'regional_country_boundary_only' }), address: Object.freeze({ country: 'South Sudan', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'regional_country_boundary_only' }) }),
  UG: Object.freeze({ countryCode: 'UG', callingCode: '+256', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'regional_country_boundary_only' }), address: Object.freeze({ country: 'Uganda', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'regional_country_boundary_only' }) }),
  BJ: Object.freeze({ countryCode: 'BJ', callingCode: '+229', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'regional_country_boundary_only' }), address: Object.freeze({ country: 'Benin', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'regional_country_boundary_only' }) }),
  BF: Object.freeze({ countryCode: 'BF', callingCode: '+226', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'regional_country_boundary_only' }), address: Object.freeze({ country: 'Burkina Faso', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'regional_country_boundary_only' }) }),
  CI: Object.freeze({ countryCode: 'CI', callingCode: '+225', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'regional_country_boundary_only' }), address: Object.freeze({ country: "Côte d'Ivoire", hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'regional_country_boundary_only' }) }),
  GW: Object.freeze({ countryCode: 'GW', callingCode: '+245', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'regional_country_boundary_only' }), address: Object.freeze({ country: 'Guinea-Bissau', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'regional_country_boundary_only' }) }),
  ML: Object.freeze({ countryCode: 'ML', callingCode: '+223', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'regional_country_boundary_only' }), address: Object.freeze({ country: 'Mali', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'regional_country_boundary_only' }) }),
  NE: Object.freeze({ countryCode: 'NE', callingCode: '+227', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'regional_country_boundary_only' }), address: Object.freeze({ country: 'Niger', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'regional_country_boundary_only' }) }),
  SN: Object.freeze({ countryCode: 'SN', callingCode: '+221', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'regional_country_boundary_only' }), address: Object.freeze({ country: 'Senegal', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'regional_country_boundary_only' }) }),
  TG: Object.freeze({ countryCode: 'TG', callingCode: '+228', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'regional_country_boundary_only' }), address: Object.freeze({ country: 'Togo', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'regional_country_boundary_only' }) }),
  CM: Object.freeze({ countryCode: 'CM', callingCode: '+237', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'regional_country_boundary_only' }), address: Object.freeze({ country: 'Cameroon', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'regional_country_boundary_only' }) }),
  CF: Object.freeze({ countryCode: 'CF', callingCode: '+236', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'regional_country_boundary_only' }), address: Object.freeze({ country: 'Central African Republic', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'regional_country_boundary_only' }) }),
  TD: Object.freeze({ countryCode: 'TD', callingCode: '+235', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'regional_country_boundary_only' }), address: Object.freeze({ country: 'Chad', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'regional_country_boundary_only' }) }),
  CG: Object.freeze({ countryCode: 'CG', callingCode: '+242', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'regional_country_boundary_only' }), address: Object.freeze({ country: 'Congo', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'regional_country_boundary_only' }) }),
  GQ: Object.freeze({ countryCode: 'GQ', callingCode: '+240', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'regional_country_boundary_only' }), address: Object.freeze({ country: 'Equatorial Guinea', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'regional_country_boundary_only' }) }),
  GA: Object.freeze({ countryCode: 'GA', callingCode: '+241', phone: Object.freeze({ format: 'E.164', nationalPrefix: '0', implementation: 'regional_country_boundary_only' }), address: Object.freeze({ country: 'Gabon', hierarchy: 'country_defined', postalCode: 'country_defined', implementation: 'regional_country_boundary_only' }) })
});

const ALIASES = Object.freeze({
  ethiopia: 'ET', kenya: 'KE', tanzania: 'TZ', nigeria: 'NG', ghana: 'GH', zambia: 'ZM',
  burundi: 'BI', 'democratic republic of the congo': 'CD', rwanda: 'RW', somalia: 'SO', 'south sudan': 'SS', uganda: 'UG',
  benin: 'BJ', 'burkina faso': 'BF', "côte d'ivoire": 'CI', 'cote d\'ivoire': 'CI', 'guinea-bissau': 'GW', mali: 'ML', niger: 'NE', senegal: 'SN', togo: 'TG',
  cameroon: 'CM', 'central african republic': 'CF', chad: 'TD', congo: 'CG', 'equatorial guinea': 'GQ', gabon: 'GA'
});

export function resolveCountryPhoneAddressRules(countryCode = 'ET') {
  const key = String(countryCode || '').trim().toUpperCase();
  const resolved = COUNTRY_RULES[key] || COUNTRY_RULES[ALIASES[String(countryCode || '').trim().toLowerCase()]];
  if (!resolved) throw Object.assign(new Error(`Unsupported country: ${countryCode}`), { code: 'COUNTRY_PHONE_ADDRESS_UNSUPPORTED', statusCode: 400 });
  return resolved;
}

export function listCountryPhoneAddressRules() { return Object.keys(COUNTRY_RULES); }

export const countryPhoneAddressContract = Object.freeze({
  phase: '15.14',
  authority: 'country_phone_address_boundary',
  persistence: 'none',
  customerAuthority: 'existing_customer_authority',
  organizationAuthority: 'existing_organization_authority',
  ownsCustomerIdentity: false,
  ownsAddressPersistence: false,
  ownsPhonePersistence: false,
  ownsGeocoding: false,
  validationEngine: 'deferred_country_specific_boundary',
  regionalStrategy: 'regional_signal_plus_country_overlay',
  countryOverlayRequired: true
});
