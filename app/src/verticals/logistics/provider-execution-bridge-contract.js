// Phase 16.13.12 — Logistics provider execution bridge boundary.
//
// Composes the already-existing selection/authorization handoff, platform
// adapter boundary, provider result normalization, reliability evaluation,
// and canonical result application. The bridge owns no provider registry,
// credentials, persistence, retry engine, or domain state.
//
// The actual provider transport and canonical mutation are injected delegates:
// this module coordinates their boundaries but does not implement either.

import { defineLogisticsProviderExecutionHandoff } from './provider-execution-handoff-contract.js';
import { resolveLogisticsProviderAdapterBoundary } from './provider-adapter-contract.js';
import { normalizeLogisticsProviderExecutionResult, projectProviderExecutionResult } from './provider-execution-result-contract.js';
import { projectReliableProviderResult } from './provider-execution-reliability-contract.js';
import { executePlatformAdapter } from '../../platform/adapter-framework.js';

export const LOGISTICS_PROVIDER_EXECUTION_BRIDGE_CONTRACT_VERSION = '1.0';

function invalid(message, code = 'LOGISTICS_PROVIDER_EXECUTION_BRIDGE_INVALID') {
  const error = new Error(`Invalid logistics provider execution bridge: ${message}`);
  error.code = code;
  throw error;
}

function fn(value, field) {
  if (typeof value !== 'function') invalid(`${field} must be a function`);
  return value;
}

export async function executeLogisticsProviderExecutionBridge({
  handoff,
  currentStatus = null,
  processedCallbackIds = [],
  invokeProvider = null,
  applyCanonicalResult,
  timeoutMs = 30000,
} = {}) {
  const apply = fn(applyCanonicalResult, 'applyCanonicalResult');
  const normalizedHandoff = defineLogisticsProviderExecutionHandoff(handoff);

  const invoke = invokeProvider
    ? fn(invokeProvider, 'invokeProvider')
    : (input, context) => executePlatformAdapter(normalizedHandoff.adapter_id, input, context);

  const timeout = Number(timeoutMs);
  if (!Number.isFinite(timeout) || timeout < 1 || timeout > 300000) {
    invalid('timeoutMs must be between 1 and 300000 milliseconds');
  }

  const invokeWithTimeout = async (input, context) => {
    let timer;
    try {
      return await Promise.race([
        Promise.resolve(invoke(input, context)),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            const error = new Error('External provider execution timed out');
            error.code = 'LOGISTICS_PROVIDER_EXECUTION_TIMEOUT';
            reject(error);
          }, timeout);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  const adapterBoundary = resolveLogisticsProviderAdapterBoundary(normalizedHandoff.adapter_id);

  if (adapterBoundary.provider !== normalizedHandoff.selected_provider_id) {
    invalid('resolved adapter provider does not match selected provider', 'LOGISTICS_PROVIDER_SELECTION_MISMATCH');
  }
  if (!adapterBoundary.adapter.operations.includes(normalizedHandoff.operation)) {
    invalid('resolved adapter does not support the handoff operation', 'LOGISTICS_PROVIDER_OPERATION_UNSUPPORTED');
  }

  const providerInput = Object.freeze({
    operation: normalizedHandoff.operation,
    provider_id: normalizedHandoff.selected_provider_id,
    adapter_id: normalizedHandoff.adapter_id,
    transaction_reference: normalizedHandoff.transaction.reference,
    authorization_reference: normalizedHandoff.authorization.reference,
  });

  // The injected delegate is the external-provider boundary. No transport,
  // credentials, provider state, or network call is implemented here.
  const providerRawResult = await invokeWithTimeout(providerInput, Object.freeze({
    adapter: adapterBoundary,
    handoff: normalizedHandoff,
  })));

  const result = normalizeLogisticsProviderExecutionResult(providerRawResult);
  if (result.provider_id.toLowerCase() !== normalizedHandoff.selected_provider_id) {
    invalid('provider result does not match selected provider', 'LOGISTICS_PROVIDER_RESULT_PROVIDER_MISMATCH');
  }
  if (result.operation !== normalizedHandoff.operation) {
    invalid('provider result operation does not match handoff', 'LOGISTICS_PROVIDER_RESULT_OPERATION_MISMATCH');
  }

  const reliability = projectReliableProviderResult({
    result,
    currentStatus,
    processedCallbackIds,
  });

  if (reliability.apply) {
    const canonical = projectProviderExecutionResult(result);
    return Object.freeze({
      bridge_version: LOGISTICS_PROVIDER_EXECUTION_BRIDGE_CONTRACT_VERSION,
      disposition: 'APPLY',
      handoff: normalizedHandoff,
      adapter: adapterBoundary,
      provider_input: providerInput,
      provider_result: result,
      reliability,
      canonical_result: canonical,
      canonical_application: await Promise.resolve(apply(canonical)),
      external_execution: true,
      provider_execution_authority: 'injected_external_provider_delegate',
      mutation_authority: 'existing_domain_transaction',
      persistence: 'existing_domain_state_and_outbox_only',
    });
  }

  return Object.freeze({
    bridge_version: LOGISTICS_PROVIDER_EXECUTION_BRIDGE_CONTRACT_VERSION,
    disposition: reliability.disposition,
    handoff: normalizedHandoff,
    adapter: adapterBoundary,
    provider_input: providerInput,
    provider_result: result,
    reliability,
    canonical_result: null,
    canonical_application: null,
    external_execution: true,
    provider_execution_authority: 'injected_external_provider_delegate',
    mutation_authority: 'existing_domain_transaction',
    persistence: 'existing_domain_state_and_outbox_only',
  });
}

export function logisticsProviderExecutionBridgeContract() {
  return Object.freeze({
    version: LOGISTICS_PROVIDER_EXECUTION_BRIDGE_CONTRACT_VERSION,
    flow: 'authorized_handoff_to_existing_adapter_to_provider_result_to_reliability_to_existing_domain_transaction',
    provider_transport: 'injected_external_provider_delegate',
    canonical_mutation: 'injected_existing_domain_transaction_delegate',
    authorization: 'existing_authorization',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    event_boundary: 'app/src/events/event-boundary.js',
    persistence: 'existing_domain_state_and_outbox_only',
    credentials: 'external_provider_or_existing_secret_boundary',
    provider_registry: false,
    callback_store: false,
    retry_engine: false,
    routing_authority: false,
    duplicate_fulfillment_authority: false,
  });
}
