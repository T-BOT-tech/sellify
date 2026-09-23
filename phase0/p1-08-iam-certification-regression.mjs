import assert from 'node:assert/strict';
import fs from 'node:fs';

const backend = fs.readFileSync(new URL('../backend/server.js', import.meta.url), 'utf8');
const auth = fs.readFileSync(new URL('../backend/lib/authorization.js', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../app/src/authorization/iam-certification.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');

assert.match(backend, /iam-certification/);
assert.match(backend, /handleAuthorizationIamCertification/);
assert.match(backend, /settings:configure/);
assert.match(backend, /backend\/lib\/authorization\.js/);
assert.match(auth, /export function authorize/);
assert.match(ui, /Role.*Permission.*Scope/i);
assert.match(ui, /Condition\/Approval/i);
assert.match(ui, /Server enforcement/i);
assert.match(ui, /Audit \/ event/i);
assert.match(ui, /P1-IMPLEMENTATION-08/);
assert.match(html, /iamCertificationPanel/);
assert.doesNotMatch(ui, /ROLE_PERMISSIONS|CREATE TABLE|INSERT INTO|UPDATE .*audit|approvalStore|permissionStore|new Authorization/);
console.log('P1-08 IAM certification trace regression: PASS');
