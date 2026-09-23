import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const server = fs.readFileSync(path.join(root,'backend/server.js'),'utf8');
const panel = fs.readFileSync(path.join(root,'app/src/authorization/conditions-approval.js'),'utf8');
const boundary = fs.readFileSync(path.join(root,'backend/lib/vertical-approval-boundary.js'),'utf8');
const auth = fs.readFileSync(path.join(root,'backend/lib/authorization.js'),'utf8');
assert.match(server,/conditions-contract/);
assert.match(server,/settings:configure/);
assert.match(panel,/uiIsNotAuthorization|canonical/);
assert.match(boundary,/approval_authority: 'external_existing_or_future_approval_workflow'/);
assert.match(boundary,/approval_store: 'none'/);
assert.match(auth,/REQUIRES_APPROVAL/);
console.log('P1-06 Conditions & Approval Boundary Regression: PASS');
