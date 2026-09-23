const baseUrl = (process.env.SELLIFY_DEPLOYMENT_URL || '').trim().replace(/\/$/, '');
const expectedEnv = process.env.SELLIFY_EXPECTED_ENV || 'production';
const backupToken = process.env.SELLIFY_BACKUP_TOKEN || '';

if (!baseUrl) {
  console.error('BLOCKED: set SELLIFY_DEPLOYMENT_URL to the deployed Sellify base URL.');
  process.exit(2);
}

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name} — ${detail}`);
}

async function get(path, options = {}) {
  const response = await fetch(baseUrl + path, {
    redirect: 'manual',
    ...options,
    headers: {
      accept: '*/*',
      ...(options.headers || {})
    }
  });
  const body = await response.text();
  return { response, body };
}

try {
  const health = await get('/health');
  let parsed;
  try { parsed = JSON.parse(health.body); } catch {}
  record(
    'health endpoint',
    health.response.status === 200 && parsed?.ok === true,
    `HTTP ${health.response.status}; ok=${String(parsed?.ok)}`
  );
  record(
    'production environment',
    health.response.status === 200 && parsed?.env === expectedEnv,
    `reported env=${String(parsed?.env)}; expected=${expectedEnv}`
  );

  const root = await get('/');
  const rootType = root.response.headers.get('content-type') || '';
  record(
    'PWA root',
    root.response.status === 200 && /text\\/(html|plain)/i.test(rootType),
    `HTTP ${root.response.status}; content-type=${rootType || 'missing'}`
  );

  const config = await get('/config.js');
  record(
    'runtime config',
    config.response.status === 200 && /application\\/javascript|text\\/javascript/i.test(config.response.headers.get('content-type') || ''),
    `HTTP ${config.response.status}; content-type=${config.response.headers.get('content-type') || 'missing'}`
  );

  if (backupToken) {
    const backup = await get('/admin/backup', {
      method: 'POST',
      headers: { authorization: `Bearer ${backupToken}` }
    });
    record(
      'backup endpoint',
      backup.response.status === 200 || backup.response.status === 201,
      `HTTP ${backup.response.status}`
    );
  } else {
    console.log('DEFERRED: backup endpoint — SELLIFY_BACKUP_TOKEN not supplied; validate backup separately with the deployment secret.');
  }
} catch (error) {
  console.error(`BLOCKED: deployment probe could not complete — ${error.message}`);
  process.exit(2);
}

const failed = results.filter((item) => !item.ok);
if (failed.length) {
  console.error(`DEPLOYMENT CERTIFICATION: BLOCKED (${failed.length} failed check(s))`);
  process.exit(1);
}

console.log('DEPLOYMENT CERTIFICATION: PUBLIC SMOKE PASS');
console.log('NOTE: tenant isolation, authenticated catalog/order flow, restart persistence, restore verification, Telegram live auth, and real payment-provider verification require controlled deployment credentials/data and are not inferred from public smoke checks.');
