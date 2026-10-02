// Phase 16.13.15 — Logistics provider execution runtime binding.
//
// Deployment wiring only. This module does not introduce a provider registry.
// It binds deployment-supplied executor functions to the existing canonical
// Platform Adapter execution delegates.
//
// Flow:
// active Platform Adapter → deployment executor → provider execution service.
//
// Credentials, transport, persistence, authorization and domain mutation
// remain owned by their existing boundaries.

import {
  getPlatformAdapter,
  registerPlatformAdapterExecution,
} from '../../../app/src/platform/adapter-framework.js';

function invalid(message, code = 'LOGISTICS_PROVIDER_RUNTIME_INVALID') {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} must be a non-empty string`);
  return value.trim().toLowerCase();
}

export function bindLogisticsProviderExecutionAdapter(adapterId, executor) {
  const id = text(adapterId, 'adapterId');
  if (typeof executor !== 'function') {
    invalid('executor must be a function', 'LOGISTICS_PROVIDER_EXECUTOR_REQUIRED');
  }

  const adapter = getPlatformAdapter(id);
  if (!adapter) {
    invalid(`unknown platform adapter: ${id}`, 'PLATFORM_ADAPTER_UNKNOWN');
  }
  if (adapter.capability !== 'logistics.operations') {
    invalid(`adapter ${id} is not a Logistics adapter`, 'LOGISTICS_PROVIDER_ADAPTER_CAPABILITY_MISMATCH');
  }
  if (adapter.status !== 'active') {
    invalid(`adapter ${id} is not active`, 'PLATFORM_ADAPTER_NOT_ACTIVE');
  }

  registerPlatformAdapterExecution(id, executor);

  return Object.freeze({
    adapter_id: id,
    provider_id: adapter.provider,
    capability: adapter.capability,
    execution: 'deployment_supplied_process_local_delegate',
    credential_storage: false,
    transport_ownership: false,
    persistence: 'none',
    domain_mutation: 'existing_domain_transaction',
  });
}

export function logisticsProviderExecutionRuntimeContract() {
  return Object.freeze({
    version: '1.0',
    phase: '16.13.15',
    purpose: 'bind deployment-supplied Logistics provider executors to existing Platform Adapter delegates',
    adapter_registry: 'existing_platform_adapter_registry',
    execution_registry: 'existing_platform_adapter_execution_delegate_map',
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
