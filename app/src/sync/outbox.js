// Phase 10.7 / P0-04 — durable offline outbox.
// The existing outbox remains the single local persistence authority for
// offline work. It carries both domain events and canonical API commands;
// command delivery never becomes a second business-data authority.
import { STORAGE_KEYS } from '../constants.js';
import { config, outboxEvents, setOutboxEvents } from '../state.js';
import { saveJSON } from '../storage/json.js';
import { authHeaders } from '../auth/tenant.js';

function persist() { saveJSON(STORAGE_KEYS.outboxEvents, outboxEvents); }

function commandHeaders(idempotencyKey) {
  return {
    'Content-Type': 'application/json',
    ...authHeaders(),
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  };
}
function baseUrl() { return (config.syncUrl || window.location.origin).replace(/\/$/, ''); }

export function enqueueEvent(eventType, payload, { aggregateType = '', aggregateId = null, eventId = null, occurredAt = null } = {}) {
  if (!eventType || !payload || typeof payload !== 'object') return null;
  const id = String(eventId || `${eventType}:${Date.now()}:${crypto.randomUUID()}`);
  if (outboxEvents.some(e => e.eventId === id)) return outboxEvents.find(e => e.eventId === id);
  const event = { eventId: id, eventType, aggregateType, aggregateId, payload, occurredAt: occurredAt || new Date().toISOString(), attempts: 0, status: 'pending' };
  setOutboxEvents([event, ...outboxEvents]);
  persist();
  return event;
}


export function enqueueCommand({ commandType, endpoint, method = 'POST', payload = {}, idempotencyKey, aggregateType = '', aggregateId = null } = {}) {
  if (!commandType || !endpoint || !idempotencyKey || !payload || typeof payload !== 'object') return null;
  const existing = outboxEvents.find(e => e.kind === 'command' && e.idempotencyKey === String(idempotencyKey));
  if (existing) return existing;
  const command = {
    kind: 'command',
    eventId: `command:${commandType}:${crypto.randomUUID()}`,
    commandType,
    endpoint,
    method,
    payload,
    idempotencyKey: String(idempotencyKey),
    aggregateType,
    aggregateId,
    occurredAt: new Date().toISOString(),
    attempts: 0,
    status: 'pending',
    lastError: null,
    lastAttemptAt: null,
  };
  setOutboxEvents([command, ...outboxEvents]);
  persist();
  return command;
}

export function getPendingCommands(commandType = '') {
  return outboxEvents.filter(event => event.kind === 'command' && event.status === 'pending' && (!commandType || event.commandType === commandType));
}

export function getFailedCommands(commandType = '') {
  return outboxEvents.filter(event => event.kind === 'command' && event.status === 'failed' && (!commandType || event.commandType === commandType));
}

async function flushCommand(command) {
  const response = await fetch(`${baseUrl()}${command.endpoint}`, {
    method: command.method || 'POST',
    headers: commandHeaders(command.idempotencyKey),
    body: JSON.stringify(command.payload || {}),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message || `Command failed (${response.status})`);
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }
  return body;
}

export async function flushCommandOutbox(commandType = '') {
  if (!config.chatId || !config.sessionToken || !navigator.onLine) {
    return { processed: 0, pending: getPendingCommands(commandType).length, failed: getFailedCommands(commandType).length, skipped: true };
  }
  const pending = getPendingCommands(commandType).slice(0, 50);
  let processed = 0;
  let failed = 0;
  for (const command of pending) {
    try {
      await flushCommand(command);
      setOutboxEvents(outboxEvents.filter(event => event.eventId !== command.eventId));
      persist();
      processed += 1;
    } catch (error) {
      const retryable = !error.status || error.status >= 500;
      setOutboxEvents(outboxEvents.map(event => event.eventId === command.eventId ? {
        ...event,
        status: retryable ? 'pending' : 'failed',
        attempts: (event.attempts || 0) + 1,
        lastAttemptAt: Date.now(),
        lastError: error.message,
      } : event));
      persist();
      failed += 1;
    }
  }
  return { processed, pending: getPendingCommands(commandType).length, failed: getFailedCommands(commandType).length, attemptedFailures: failed };
}

export function retryCommand(eventId) {
  const existing = outboxEvents.find(event => event.eventId === String(eventId) && event.kind === 'command');
  if (!existing) return null;
  const next = outboxEvents.map(event => event.eventId === existing.eventId ? { ...event, status: 'pending', lastError: null } : event);
  setOutboxEvents(next);
  persist();
  return next.find(event => event.eventId === existing.eventId);
}

export async function flushOutbox() {
  const commandResult = await flushCommandOutbox();
  if (!config.chatId || !config.sessionToken || !navigator.onLine || !outboxEvents.length) {
    return { ...commandResult, processed: commandResult.processed || 0, pending: commandResult.pending ?? outboxEvents.length };
  }
  const pending = outboxEvents.filter(e => !e.kind && e.status !== 'synced' && e.status !== 'rejected').slice(0, 100);
  if (!pending.length) return { processed: 0, pending: 0 };
  try {
    const res = await fetch(`${baseUrl()}/events/${encodeURIComponent(config.chatId)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ events: pending }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `Event sync failed (${res.status})`);
    const resultMap = new Map((data.results || []).map(r => [String(r.eventId), r]));
    const next = outboxEvents.map(event => {
      const result = resultMap.get(String(event.eventId));
      if (!result) return event;
      return { ...event, status: result.status === 'processed' ? 'synced' : 'rejected', syncError: result.error || null, attempts: (event.attempts || 0) + 1, lastAttemptAt: Date.now() };
    }).filter(event => event.status !== 'synced');
    const processed = outboxEvents.length - next.length;
    setOutboxEvents(next);
    persist();
    return { processed: processed + (commandResult.processed || 0), pending: next.length + (commandResult.pending || 0) };
  } catch (error) {
    setOutboxEvents(outboxEvents.map(event => pending.some(p => p.eventId === event.eventId) ? { ...event, attempts: (event.attempts || 0) + 1, lastAttemptAt: Date.now(), lastError: error.message } : event));
    persist();
    return { processed: commandResult.processed || 0, pending: next.length + (commandResult.pending || 0), error: error.message };
  }
}
