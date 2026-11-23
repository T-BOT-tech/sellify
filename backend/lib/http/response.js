// Shared HTTP response serialization. Keep this module transport-agnostic:
// callers supply the configured CORS allowlist and the request/response objects.
export function corsOriginFor(req, allowedOrigins = []) {
  const origin = req.headers['origin'];
  if (allowedOrigins.length === 0) return '*';
  if (origin && allowedOrigins.includes(origin)) return origin;
  return null;
}

export function sendJSON(res, status, body, req, allowedOrigins = []) {
  const payload = JSON.stringify(body);
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    ...(req?._requestId ? { 'X-Request-Id': req._requestId } : {}),
  };
  const allowOrigin = req ? corsOriginFor(req, allowedOrigins) : '*';
  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin;
    headers['Vary'] = 'Origin';
  }
  res.writeHead(status, headers);
  res.end(payload);
}

// 5xx messages and internal error codes are intentionally redacted. Expected
// 4xx validation/domain messages and stable machine-readable codes are kept.
export function sendError(res, status, err, req, allowedOrigins = []) {
  const message = status >= 500 ? 'Internal error' : (err.message || 'Request error');
  if (status >= 500) console.error('[error]', err);
  const code = status < 500 && typeof err?.code === 'string' && /^[A-Z][A-Z0-9_]{1,79}$/.test(err.code)
    ? err.code
    : undefined;
  sendJSON(res, status, { error: { message, status, ...(code ? { code } : {}) } }, req, allowedOrigins);
}
