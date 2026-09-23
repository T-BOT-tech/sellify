// Phase 15.5 — regional cluster contract.
// Declarative composition boundary. A regional cluster never becomes a
// second commerce, inventory, payment, identity, authorization, audit,
// persistence, or event authority.

export const REGIONAL_CLUSTER_CONTRACT_VERSION = '1.0';

export const REGIONAL_CLUSTER_FIELDS = Object.freeze([
  'regionCode',
  'name',
  'countries',
  'sharedLanguages',
  'currencyStrategy',
  'tradeFramework',
  'taxStrategy',
  'paymentStrategy',
  'countryOverlayRequired',
  'implementationStatus'
]);

export const REGIONAL_CLUSTER_FORBIDDEN_AUTHORITIES = Object.freeze([
  'persistence',
  'commerce',
  'inventory',
  'payments',
  'identity',
  'authorization',
  'audit',
  'events',
  'taxLedger',
  'invoiceAuthority'
]);

const REGION_CODE = /^[A-Z0-9_-]{2,12}$/;
const COUNTRY_CODE = /^[A-Z]{2}$/;
const LANGUAGE_CODE = /^[a-z]{2,3}$/;

const EAC = Object.freeze({
  regionCode: 'EAC',
  name: 'East African Community',
  countries: Object.freeze(['BI', 'CD', 'KE', 'RW', 'SO', 'SS', 'TZ', 'UG']),
  sharedLanguages: Object.freeze(['en', 'sw']),
  currencyStrategy: Object.freeze({
    mode: 'country_currency',
    commonCurrency: null,
    implementation: 'regional_contract_only'
  }),
  tradeFramework: Object.freeze({
    customsUnion: true,
    commonMarket: true,
    singleCustomsTerritory: true,
    implementation: 'regional_contract_only'
  }),
  taxStrategy: Object.freeze({
    mode: 'regional_harmonization_plus_country_overlay',
    countryCalculation: 'country_overlay',
    implementation: 'regional_contract_only'
  }),
  paymentStrategy: Object.freeze({
    mode: 'country_adapter_plus_regional_rail_when_available',
    execution: 'existing_payment_authority_only',
    implementation: 'regional_contract_only'
  }),
  countryOverlayRequired: true,
  implementationStatus: 'contract_only'
});


const WAEMU = Object.freeze({
  regionCode: 'WAEMU',
  name: 'West African Economic and Monetary Union',
  countries: Object.freeze(['BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG']),
  sharedLanguages: Object.freeze(['fr']),
  currencyStrategy: Object.freeze({
    mode: 'shared_currency',
    commonCurrency: 'XOF',
    implementation: 'regional_contract_only'
  }),
  tradeFramework: Object.freeze({
    customsUnion: true,
    commonMarket: true,
    singleCustomsTerritory: false,
    implementation: 'regional_contract_only'
  }),
  taxStrategy: Object.freeze({
    mode: 'regional_harmonization_plus_country_overlay',
    countryCalculation: 'country_overlay',
    implementation: 'regional_contract_only'
  }),
  paymentStrategy: Object.freeze({
    mode: 'country_adapter_plus_regional_rail_when_available',
    execution: 'existing_payment_authority_only',
    implementation: 'regional_contract_only'
  }),
  countryOverlayRequired: true,
  implementationStatus: 'contract_only'
});


const CEMAC = Object.freeze({
  regionCode: 'CEMAC',
  name: 'Central African Economic and Monetary Community',
  countries: Object.freeze(['CM', 'CF', 'TD', 'CG', 'GQ', 'GA']),
  sharedLanguages: Object.freeze(['fr']),
  currencyStrategy: Object.freeze({
    mode: 'shared_currency',
    commonCurrency: 'XAF',
    implementation: 'regional_contract_only'
  }),
  tradeFramework: Object.freeze({
    customsUnion: true,
    commonMarket: true,
    singleCustomsTerritory: false,
    implementation: 'regional_contract_only'
  }),
  taxStrategy: Object.freeze({
    mode: 'regional_harmonization_plus_country_overlay',
    countryCalculation: 'country_overlay',
    implementation: 'regional_contract_only'
  }),
  paymentStrategy: Object.freeze({
    mode: 'country_adapter_plus_regional_rail_when_available',
    execution: 'existing_payment_authority_only',
    implementation: 'regional_contract_only'
  }),
  countryOverlayRequired: true,
  implementationStatus: 'contract_only'
});

const CLUSTERS = Object.freeze({ eac: EAC, waemu: WAEMU, cemac: CEMAC });

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export function listRegionalClusters() {
  return Object.keys(CLUSTERS);
}

export function getRegionalCluster(regionCode) {
  const key = String(regionCode || '').trim().toLowerCase();
  const cluster = CLUSTERS[key];
  if (!cluster) {
    throw Object.assign(new Error(`Unknown regional cluster: ${regionCode}`), {
      code: 'REGIONAL_CLUSTER_UNKNOWN'
    });
  }
  return cluster;
}

export function validateRegionalCluster(cluster) {
  const errors = [];
  if (!cluster || typeof cluster !== 'object' || Array.isArray(cluster)) {
    return { valid: false, errors: ['cluster must be an object'] };
  }

  for (const field of REGIONAL_CLUSTER_FIELDS) {
    if (!hasOwn(cluster, field)) errors.push(`missing:${field}`);
  }

  if (!REGION_CODE.test(cluster.regionCode || '')) errors.push('regionCode must use stable uppercase regional shape');
  if (typeof cluster.name !== 'string' || !cluster.name.trim()) errors.push('name must be non-empty');

  if (!Array.isArray(cluster.countries) || cluster.countries.length === 0) {
    errors.push('countries must be non-empty');
  } else {
    if (cluster.countries.some((code) => !COUNTRY_CODE.test(code))) errors.push('countries must use ISO-like alpha-2 shapes');
    if (new Set(cluster.countries).size !== cluster.countries.length) errors.push('countries must be unique');
  }

  if (!Array.isArray(cluster.sharedLanguages)) {
    errors.push('sharedLanguages must be an array');
  } else {
    if (cluster.sharedLanguages.some((code) => !LANGUAGE_CODE.test(code))) errors.push('sharedLanguages must use lowercase ISO-like language codes');
    if (new Set(cluster.sharedLanguages).size !== cluster.sharedLanguages.length) errors.push('sharedLanguages must be unique');
  }

  for (const field of ['currencyStrategy', 'tradeFramework', 'taxStrategy', 'paymentStrategy']) {
    if (!cluster[field] || typeof cluster[field] !== 'object' || Array.isArray(cluster[field])) {
      errors.push(`${field} must be an object`);
    }
  }

  if (cluster.countryOverlayRequired !== true) errors.push('countryOverlayRequired must be true');
  if (cluster.implementationStatus !== 'contract_only') errors.push('implementationStatus must be contract_only');

  // Regional clusters compose country/Core capabilities; they cannot claim
  // ownership of any authority.
  for (const authority of REGIONAL_CLUSTER_FORBIDDEN_AUTHORITIES) {
    const property = `owns${authority[0].toUpperCase()}${authority.slice(1)}`;
    if (hasOwn(cluster, property)) errors.push(`forbidden:${property}`);
  }

  return { valid: errors.length === 0, errors };
}

export function assertRegionalCluster(cluster) {
  const validation = validateRegionalCluster(cluster);
  if (!validation.valid) {
    const error = new Error(`Invalid regional cluster: ${validation.errors.join(', ')}`);
    error.code = 'REGIONAL_CLUSTER_INVALID';
    error.errors = validation.errors;
    throw error;
  }
  return cluster;
}

export function regionalClusterContract() {
  return Object.freeze({
    version: REGIONAL_CLUSTER_CONTRACT_VERSION,
    fields: [...REGIONAL_CLUSTER_FIELDS],
    authority: 'regional_cluster_contract',
    persistence: 'none',
    ownsCoreCommerce: false,
    ownsInventory: false,
    ownsPayments: false,
    ownsIdentity: false,
    ownsAuthorization: false,
    ownsAudit: false,
    ownsEvents: false,
    ownsTaxLedger: false,
    ownsInvoiceAuthority: false,
    countryOverlayRequired: true,
    providerBoundary: 'Regional Cluster → Country Overlay / Existing Core Capability → Adapter → Provider',
    implementationStatus: 'contract_only'
  });
}
