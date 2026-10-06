// GAP-6 — Canonical Pack lifecycle client.
// UI code calls intent-based commands; lifecycle truth remains server-owned.
import { config } from '../state.js';
import { authHeaders } from '../auth/tenant.js';

function baseUrl() {
  return (config.syncUrl || window.location.origin).replace(/\/$/, '');
}

function tenantId() {
  const value = String(config.chatId || config.tenantId || '').trim();
  if (!value) throw new Error('Active tenant is required for Pack lifecycle operations');
  return value;
}

async function request(packId, action, extra = {}) {
  const normalizedPackId = String(packId || '').trim();
  if (!normalizedPackId) throw new Error('Pack id is required');

  const res = await fetch(
    `${baseUrl()}/tenants/${encodeURIComponent(tenantId())}/packs/${encodeURIComponent(normalizedPackId)}/lifecycle`,
    {
      method: action === 'VIEW' ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      ...(action === 'VIEW' ? {} : { body: JSON.stringify({ action, ...extra }) }),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data?.error?.message || `Pack lifecycle request failed (${res.status})`);
    error.code = data?.error?.code || '';
    error.status = res.status;
    throw error;
  }
  return data.lifecycle || null;
}

export async function getPackLifecycle(packId) {
  const normalizedPackId = String(packId || '').trim();
  if (!normalizedPackId) throw new Error('Pack id is required');
  const res = await fetch(
    `${baseUrl()}/tenants/${encodeURIComponent(tenantId())}/packs/${encodeURIComponent(normalizedPackId)}/lifecycle`,
    { method: 'GET', headers: { 'Content-Type': 'application/json', ...authHeaders() } },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data?.error?.message || `Pack lifecycle request failed (${res.status})`);
    error.code = data?.error?.code || '';
    error.status = res.status;
    throw error;
  }
  return data.lifecycle || null;
}

export async function getPackLifecycleSnapshot(packId) {
  const normalizedPackId = String(packId || '').trim();
  if (!normalizedPackId) throw new Error('Pack id is required');
  const res = await fetch(
    `${baseUrl()}/tenants/${encodeURIComponent(tenantId())}/packs/${encodeURIComponent(normalizedPackId)}/lifecycle`,
    { method: 'GET', headers: { 'Content-Type': 'application/json', ...authHeaders() } },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data?.error?.message || `Pack lifecycle request failed (${res.status})`);
    error.code = data?.error?.code || '';
    error.status = res.status;
    throw error;
  }
  return Object.freeze({ lifecycle: data.lifecycle || null, readiness: data.readiness || null });
}

export function installPack(packId, options = {}) {
  return request(packId, 'INSTALL', options);
}

export function activatePack(packId, options = {}) {
  return request(packId, 'ACTIVATE', options);
}

export function deactivatePack(packId, options = {}) {
  return request(packId, 'DEACTIVATE', options);
}

export function upgradePack(packId, options = {}) {
  return request(packId, 'UPGRADE', options);
}

export const packLifecycleClient = Object.freeze({
  get: getPackLifecycle,
  getSnapshot: getPackLifecycleSnapshot,
  install: installPack,
  activate: activatePack,
  deactivate: deactivatePack,
  upgrade: upgradePack,
});
