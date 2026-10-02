// Phase 20.8 — Cross-Border Logistics Feasibility.
// Derived composition over existing Commerce/Fulfillment/Logistics contracts.
// This module does not own shipment, courier, routing, dispatch, persistence,
// provider state, authorization, or provider execution. It answers whether
// the currently observed logistics capabilities are sufficient for a
// cross-border plan and, when supplied, composes the existing verified
// provider-selection boundary.

import { buildUnifiedFulfillmentContext } from './logistics/unified-fulfillment-contract.js';
import { logisticsShipmentTrackingContract } from './verticals/logistics/shipment-tracking-contract.js';
import { logisticsCourierAssignmentContract } from './verticals/logistics/courier-assignment-contract.js';
import { evaluateLogisticsProviderSelection } from './verticals/logistics/provider-selection-contract.js';

const VERSION = '1.1';
const RESULTS = new Set(['FEASIBLE', 'CONDITIONALLY_FEASIBLE', 'NOT_FEASIBLE', 'UNKNOWN']);
const MODES = new Set(['pickup', 'delivery']);

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Cross-Border Logistics ${field} must be a non-empty string`);
  return result;
}

function optionalText(value) {
  if (value == null || value === '') return null;
  return String(value).trim() || null;
}

function capability(status, reason, source) {
  return Object.freeze({ status, reason, source });
}

function buildProviderSelection({ mode, providerCandidates, providerRequirements, selectedProviderId }) {
  if (!Array.isArray(providerCandidates) || providerCandidates.length === 0) return null;

  const requirements = providerRequirements == null
    ? { capabilities: ['cross_border', mode] }
    : { ...providerRequirements };

  if (!Array.isArray(requirements.capabilities)) {
    throw new TypeError('providerRequirements.capabilities must be an array');
  }

  const requiredCapabilities = [...new Set([
    'cross_border',
    mode,
    ...requirements.capabilities.map((value) => String(value).trim().toLowerCase()),
  ])];

  return evaluateLogisticsProviderSelection({
    requirements: { ...requirements, capabilities: requiredCapabilities },
    candidates: providerCandidates,
    selected_provider_id: selectedProviderId,
  });
}

/**
 * Compose logistics feasibility from existing Core Fulfillment/Logistics
 * observations. No route or shipment is created and no provider is called.
 *
 * When providerCandidates are supplied, provider feasibility/selection is
 * evaluated through the existing Logistics provider capability + verification
 * + selection boundary. Selection remains explicit and never authorizes or
 * executes the provider.
 */
export function evaluateCrossBorderLogistics({
  order,
  origin,
  destination,
  deliveryMode,
  shipment = null,
  courier = null,
  carrierCapability = null,
  providerCandidates = [],
  providerRequirements = null,
  selectedProviderId = null,
} = {}) {
  if (!order || typeof order !== 'object') throw new TypeError('Core Order is required');
  const originId = text(origin, 'origin');
  const destinationId = text(destination, 'destination');
  const mode = text(deliveryMode ?? order.fulfillment_type, 'deliveryMode').toLowerCase();
  if (!MODES.has(mode)) throw new TypeError(`Unsupported deliveryMode: ${mode}`);

  const fulfillment = buildUnifiedFulfillmentContext({ order });
  if (fulfillment.fulfillment.type !== mode) {
    throw new TypeError('Cross-Border Logistics delivery mode conflicts with Core Fulfillment');
  }

  const shipmentContract = logisticsShipmentTrackingContract();
  const courierContract = logisticsCourierAssignmentContract();
  const providerSelection = buildProviderSelection({
    mode,
    providerCandidates,
    providerRequirements,
    selectedProviderId,
  });

  const capabilities = [];
  capabilities.push(mode === 'delivery'
    ? capability('AVAILABLE', 'Core delivery fulfillment exists', fulfillment.fulfillment.authority)
    : capability('AVAILABLE', 'Core pickup fulfillment exists', fulfillment.fulfillment.authority));

  if (providerSelection) {
    const selected = providerSelection.selected_provider_id;
    const feasible = providerSelection.feasible_provider_ids.length > 0;
    const selectionStatus = selected
      ? 'AVAILABLE'
      : feasible
        ? 'REVIEW_REQUIRED'
        : 'BLOCKED';
    capabilities.push(capability(
      selectionStatus,
      selected
        ? `Selected provider ${selected} is verified feasible for cross-border ${mode}`
        : feasible
          ? 'Verified-feasible cross-border providers exist; explicit provider selection is still required'
          : 'No verified-feasible cross-border provider satisfies the required capabilities',
      'logistics-provider-selection-contract',
    ));
  } else if (carrierCapability == null) {
    capabilities.push(capability('UNKNOWN', 'No carrier capability evidence supplied', 'external_provider_or_adapter'));
  } else {
    const carrierStatus = String(carrierCapability.status ?? '').trim().toUpperCase();
    if (!['AVAILABLE', 'REVIEW_REQUIRED', 'BLOCKED'].includes(carrierStatus)) {
      throw new TypeError('Unsupported carrier capability status');
    }
    capabilities.push(capability(
      carrierStatus === 'AVAILABLE' ? 'AVAILABLE' : carrierStatus,
      optionalText(carrierCapability.reason) ?? `Carrier capability is ${carrierStatus}`,
      optionalText(carrierCapability.source) ?? 'external_provider_or_adapter',
    ));
  }

  if (mode === 'delivery' && courier != null) {
    const courierStatus = String(courier.status ?? '').trim().toUpperCase();
    if (!['AVAILABLE', 'REVIEW_REQUIRED', 'BLOCKED'].includes(courierStatus)) {
      throw new TypeError('Unsupported courier capability status');
    }
    capabilities.push(capability(
      courierStatus === 'AVAILABLE' ? 'AVAILABLE' : courierStatus,
      optionalText(courier.reason) ?? `Courier capability is ${courierStatus}`,
      optionalText(courier.source) ?? courierContract.courier_authority,
    ));
  }

  const blocked = capabilities.filter((item) => item.status === 'BLOCKED');
  const unknown = capabilities.filter((item) => item.status === 'UNKNOWN');
  const review = capabilities.filter((item) => item.status === 'REVIEW_REQUIRED');
  const result = blocked.length
    ? 'NOT_FEASIBLE'
    : unknown.length
      ? 'UNKNOWN'
      : review.length
        ? 'CONDITIONALLY_FEASIBLE'
        : 'FEASIBLE';

  return Object.freeze({
    version: VERSION,
    origin: originId,
    destination: destinationId,
    delivery_mode: mode,
    result,
    capabilities: Object.freeze(capabilities),
    fulfillment: Object.freeze({
      order_id: fulfillment.order.order_id,
      type: fulfillment.fulfillment.type,
      status: fulfillment.fulfillment.status,
      authority: fulfillment.fulfillment.authority,
    }),
    shipment: Object.freeze({
      provided: shipment != null,
      authority: shipmentContract.shipment_authority,
      execution: false,
    }),
    courier: Object.freeze({
      provided: courier != null,
      authority: courierContract.courier_authority,
      execution: false,
    }),
    provider_selection: providerSelection,
    provider_selection_authority: providerSelection
      ? 'app/src/verticals/logistics/provider-selection-contract.js'
      : null,
    authorization_required: providerSelection?.authorization_required ?? false,
    authorization_granted: false,
    route_execution: false,
    dispatch_execution: false,
    provider_execution: false,
    persistence: 'none',
    authority: 'phase20-derived-logistics-feasibility',
    reconciliation: 'Core Order/Fulfillment remains authoritative; external capability conflicts require review or blocking, never silent overwrite',
  });
}

export function isCrossBorderLogisticsFeasibility(value) {
  return Boolean(value && typeof value === 'object' &&
    (value.version === '1.0' || value.version === VERSION) &&
    typeof value.origin === 'string' &&
    typeof value.destination === 'string' &&
    MODES.has(value.delivery_mode) &&
    RESULTS.has(value.result) &&
    Array.isArray(value.capabilities) &&
    value.route_execution === false &&
    value.dispatch_execution === false &&
    value.provider_execution === false &&
    value.persistence === 'none' &&
    value.authority === 'phase20-derived-logistics-feasibility');
}

export function crossBorderLogisticsFeasibilityContract() {
  return Object.freeze({
    version: VERSION,
    owner: 'Phase 20 derived coordination only',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    shipment_authority: 'commerce_order',
    courier_authority: 'logistics-pack',
    provider_capability_authority: 'app/src/verticals/logistics/provider-capability-contract.js',
    provider_verification_authority: 'app/src/verticals/logistics/provider-verification-contract.js',
    provider_selection_authority: 'app/src/verticals/logistics/provider-selection-contract.js',
    route_authority: null,
    dispatch_authority: null,
    external_provider_authority: 'external_provider_where_external',
    results: Object.freeze([...RESULTS]),
    persistence: 'none',
    route_execution: false,
    dispatch_execution: false,
    provider_execution: false,
    authorization: 'existing_authorization',
    duplicate_shipment_store: false,
    duplicate_courier_registry: false,
    duplicate_fulfillment_authority: false,
    duplicate_provider_selection_authority: false,
    adapter_boundary: 'Canonical Contract → Adapter → Provider',
  });
}

export const CROSS_BORDER_LOGISTICS_FEASIBILITY_CONTRACT = crossBorderLogisticsFeasibilityContract();
