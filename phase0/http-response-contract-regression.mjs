import assert from 'node:assert/strict';
import { sendError, sendJSON } from '../backend/lib/http/response.js';

function responseSink() {
  return {
    status: null,
    headers: null,
    payload: null,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(payload) {
      this.payload = payload;
    },
  };
}

{
  const res = responseSink();
  const req = { headers: { origin: 'https://admin.sellify.example' }, _requestId: 'request-123' };
  const body = { ok: true, value: 'Sellify' };
  sendJSON(res, 201, body, req, ['https://admin.sellify.example']);
  assert.equal(res.status, 201);
  assert.deepEqual(JSON.parse(res.payload), body);
  assert.equal(res.headers['Content-Type'], 'application/json');
  assert.equal(res.headers['Content-Length'], Buffer.byteLength(res.payload));
  assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://admin.sellify.example');
  assert.equal(res.headers.Vary, 'Origin');
  assert.equal(res.headers['X-Request-Id'], 'request-123');
}

{
  const res = responseSink();
  const req = { headers: { origin: 'https://untrusted.example' }, _requestId: 'request-456' };
  sendJSON(res, 200, { ok: true }, req, ['https://admin.sellify.example']);
  assert.equal(res.headers['Access-Control-Allow-Origin'], undefined);
  assert.equal(res.headers.Vary, undefined);
  assert.equal(res.headers['X-Request-Id'], 'request-456');
}

{
  const res = responseSink();
  sendJSON(res, 200, { ok: true }, { headers: {} }, []);
  assert.equal(res.headers['Access-Control-Allow-Origin'], '*',
    'empty development allowlist preserves wildcard fallback');
  assert.equal(res.headers.Vary, 'Origin');
}

{
  const res = responseSink();
  sendJSON(res, 200, { ok: true }, null, ['https://admin.sellify.example']);
  assert.equal(res.headers['Access-Control-Allow-Origin'], '*',
    'server-origin responses preserve wildcard behavior');
}

{
  const res = responseSink();
  const req = { headers: { origin: 'https://admin.sellify.example' }, _requestId: 'request-400' };
  sendError(res, 400, Object.assign(new Error('Invalid payment scope'), { code: 'INVALID_PAYMENT_SCOPE' }),
    req, ['https://admin.sellify.example']);
  assert.equal(res.status, 400);
  assert.deepEqual(JSON.parse(res.payload), {
    error: { message: 'Invalid payment scope', status: 400, code: 'INVALID_PAYMENT_SCOPE' },
  });
  assert.equal(res.headers['X-Request-Id'], 'request-400');
}

{
  const res = responseSink();
  const req = { headers: { origin: 'https://admin.sellify.example' }, _requestId: 'request-500' };
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    sendError(res, 500, Object.assign(new Error('database password leaked?'), { code: 'INTERNAL_SECRET' }),
      req, ['https://admin.sellify.example']);
  } finally {
    console.error = originalError;
  }
  assert.equal(res.status, 500);
  assert.deepEqual(JSON.parse(res.payload), { error: { message: 'Internal error', status: 500 } });
  assert.equal(res.payload.includes('database password'), false);
  assert.equal(res.payload.includes('INTERNAL_SECRET'), false);
  assert.equal(logged.length, 1, 'internal errors remain server-logged');
  assert.equal(res.headers['X-Request-Id'], 'request-500');
}

console.log('HTTP response serialization/CORS/error-redaction regression: PASS');
