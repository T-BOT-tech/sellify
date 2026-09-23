import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const server = fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'backend/package.json'), 'utf8'));
let pass = 0, fail = 0;
function check(name, ok, detail='') {
  if (ok) { pass++; console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`); }
  else { fail++; console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}

check('runtime declaration', pkg.engines?.node === '>=24');
check('production CORS fails closed', server.includes("if (IS_PROD) {\n    throw new Error('CORS_ALLOWED_ORIGINS must be configured in production; wildcard CORS is development-only');"));
check('development CORS fallback remains explicit', server.includes("Set it to a comma-separated allowlist before deploying with real sellers."));
check('request correlation id generated', server.includes("req._requestId = String(req.headers['x-request-id'] || crypto.randomUUID());"));
check('request correlation id returned', server.includes("'X-Request-Id': req._requestId"));
check('health endpoint exists', server.includes("url.pathname === '/health'"));
check('rate limiting remains configured', server.includes('RATE_LIMIT_MAX_WRITES') && server.includes('RATE_LIMIT_MAX_READS'));
check('trust proxy remains explicit', server.includes('const TRUST_PROXY = /^(1|true|yes)$/i.test'));
check('backup endpoint remains existing authority', server.includes('async function handleAdminBackup') && server.includes('createDatabaseBackup()') && server.includes("/admin/backup"));
check('no second observability store introduced', !fs.existsSync(path.join(root, 'backend/lib/r3-observability-store.js')));

const syntax = spawnSync(process.execPath, ['--check', path.join(root, 'backend/server.js')], { encoding:'utf8' });
check('server syntax', syntax.status === 0, syntax.stderr.trim());

console.log(`\nR3 Release Readiness / Deployment Hardening: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
