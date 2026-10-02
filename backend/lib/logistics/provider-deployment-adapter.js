// Phase 16.13.16 — Logistics provider deployment adapter contract.
//
// Binds one concrete deployment executor to an already-registered Logistics
// Platform Adapter. This is deployment wiring, not a provider registry,
// credential store, transport owner, retry engine, or domain authority.
//
// Flow:
// defined Logistics adapter -> active Platform Adapter -> deployment executor
// -> existing provider execution bridge/service.

import { defineLogisticsProviderAdapter } from '../../../app/src/verticals/logistics/provider-adapter-contract.js';
import { registerPlatformAdapter } from '../../../app/src/platform/adapter-framework.js';
import { bindLogisticsProviderExecutionAdapter } from './provider-execution-runtime.js';

export const LOGISTICS_PROVIDER_DEPLOYMENT_ADAPTER_CONTRACT_VERSION = '1.0';

function invalid(message, code = 'LOGISTICS_PROVIDER_DEPLOYMENT_ADAPTER_INVALID') {
  const error = new Error(message);
  error.code = code;
  throw error;
}

export function defineLogisticsProviderDeploymentAdapter(input, { replace = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    invalid('deployment adapter must be an object');
  }
  if (typeof input.executor !== 'function') {
    invalid('executor must be a function', 'LOGISTICS_PROVIDER_EXECUTOR_REQUIRED');
  }

  const adapter = defineLogisticsProviderAdapter({
    ...input,
    status: input.status ?? 'active',
  });

  if (adapter.status !== 'active') {
    invalid('deployment adapter must be active', 'PLATFORM_ADAPTER_NOT_ACTIVE');
  }

  registerPlatformAdapter(adapter, { replace });

  const binding = bindLogisticsProviderExecutionAdapter(adapter.id, input.executor);

  return Object.freeze({
    contract_version: LOGISTICS_PROVIDER_DEPLOYMENT_ADAPTER_CONTRACT_VERSION,
    adapter,
    binding,
    deployment_execution: 'process_local_executor_delegate',
    credential_storage: false,
    transport_ownership: false,
    persistence: 'none',
    authorization: 'existing_authorization',
    domain_mutation: 'existing_domain_transaction',
  });
}

export function logisticsProviderDeploymentAdapterContract() {
  return Object.freeze({
    version: LOGISTICS_PROVIDER_DEPLOYMENT_ADAPTER_CONTRACT_VERSION,
    phase: '16.13.16',
    purpose: 'bind a concrete deployment executor to an existing Logistics Platform Adapter',
    adapter_authority: 'existing_platform_adapter_registry',
    execution_authority: 'existing_platform_adapter_execution_delegate_map',
    provider_registry: false,
    credential_storage: false,
    transport_ownership: false,
    persistence: 'none',
    authorization: 'existing_authorization',
    transaction_authority: 'existing_domain_transaction',
    fulfillment_authority: 'backend/lib/store-sqlite.js',
    routing_authority: false,
    callback_store: false,
    retry_engine: false,
    duplicate_fulfillment_authority: false,
    duplicate_inventory_authority: false,
  });
}
