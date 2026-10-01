// GAP-1.18D provider HTTP transport.
// Provider-neutral: HTTP mechanics only. Authentication is supplied by the
// provider adapter. Retries are bounded and apply only to explicitly retryable
// responses; provider semantics remain outside this transport.

import { ProviderNetworkError, ProviderTimeoutError } from './provider-errors.js';

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function retryDelay(attempt, retryAfter, backoffBaseMs, backoffMaxMs) {
  const retryAfterMs = Number.isFinite(Number(retryAfter))
    ? Math.max(0, Number(retryAfter) * 1000)
    : 0;
  const exponential = Math.min(
    backoffMaxMs,
    Math.max(0, backoffBaseMs) * (2 ** Math.max(0, attempt - 1)),
  );
  return Math.min(backoffMaxMs, Math.max(retryAfterMs, exponential));
}

export async function requestProviderProbe({
  baseUrl,
  path = '/',
  method = 'GET',
  timeoutMs = 5000,
  headers = {},
  body,
  fetchImpl = globalThis.fetch,
  maxRetries = 2,
  backoffBaseMs = 250,
  backoffMaxMs = 2000,
}) {
  if (!baseUrl) {
    const error = new Error('Provider endpoint is not configured');
    error.code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
    throw error;
  }
  if (typeof fetchImpl !== 'function') {
    const error = new Error('Fetch transport unavailable');
    error.code = 'PAYMENT_PROVIDER_TRANSPORT_UNAVAILABLE';
    throw error;
  }

  const attempts = Math.max(0, Number(maxRetries) || 0) + 1;
  let lastResponse = null;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(250, Number(timeoutMs) || 5000));

    try {
      const url = new URL(path, baseUrl).toString();
      const response = await fetchImpl(url, {
        method,
        headers: { accept: 'application/json', ...headers },
        body: body == null ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await response.text();
      let payload = {};
      try { payload = text ? JSON.parse(text) : {}; } catch { payload = { responseText: text.slice(0, 4096) }; }
      lastResponse = { ok: response.ok, statusCode: response.status, payload };

      if (!RETRYABLE_STATUS.has(response.status) || attempt === attempts) {
        return lastResponse;
      }

      const retryAfter = response.headers?.get?.('retry-after');
      await sleep(retryDelay(attempt, retryAfter, backoffBaseMs, backoffMaxMs));
    } catch (error) {
      if (error?.name === 'AbortError') {
        lastError = new ProviderTimeoutError(null, 'probeCapability', error);
      } else {
        lastError = new ProviderNetworkError(null, 'probeCapability', error);
      }
      if (attempt === attempts) throw lastError;
      await sleep(retryDelay(attempt, null, backoffBaseMs, backoffMaxMs));
    } finally {
      clearTimeout(timeout);
    }
  }

  return lastResponse;
}
