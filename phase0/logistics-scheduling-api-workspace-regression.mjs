// L11 — authenticated Logistics Scheduling API and workspace integration regression.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const server = read('../backend/server.js');
const store = read('../backend/lib/store-sqlite.js');
const ui = read('../app/src/logistics/ui.js');
const workspace = read('../app/src/logistics/scheduling.js');
const en = read('../app/src/i18n/locales/en.js');
const am = read('../app/src/i18n/locales/am.js');
const om = read('../app/src/i18n/locales/om.js');

for (const name of [
  'createLogisticsSchedulingActivity',
  'getLogisticsSchedulingActivity',
  'listLogisticsSchedulingActivities',
  'evaluateLogisticsSchedulingActivity',
  'transitionLogisticsSchedulingActivity',
]) assert.match(server, new RegExp(name));

assert.ok((server.match(/handleLogisticsScheduling\(req, res/g) || []).length >= 6);
assert.match(server, /pattern:.*logistics.*scheduling/);

assert.match(server, /requireSession\(req, chatId\)/);
assert.match(server, /logistics:scheduling:view/);
assert.match(server, /logistics:scheduling:request/);
assert.match(server, /transitionLogisticsSchedulingActivity\(chatId, activityId, target, session/);
assert.match(server, /Only transition command fields cross the HTTP boundary/);
assert.match(server, /idempotencyKey: req\.headers\['idempotency-key'\]/);

assert.match(store, /export async function createLogisticsSchedulingActivity/);
assert.match(store, /db\.exec\('BEGIN IMMEDIATE'\)/);
assert.match(store, /export async function evaluateLogisticsSchedulingActivity/);
assert.match(store, /const externalEvaluation = null/);
assert.match(store, /export async function transitionLogisticsSchedulingActivity/);
assert.match(store, /assertLogisticsSchedulingAuthorization\(actor, organizationId, row\.location_id, schedulingAction\)/);

assert.match(ui, /logisticsSchedulingWorkspaceShell/);
assert.match(ui, /mountLogisticsSchedulingWorkspace/);
assert.match(workspace, /logisticsSchedulingRequestForm/);
assert.match(workspace, /data-scheduling-evaluate/);
assert.match(workspace, /data-scheduling-transition/);
assert.match(workspace, /UNKNOWN_STALE/);
assert.match(workspace, /DENIED/);
assert.match(workspace, /EMPTY/);
assert.match(workspace, /LOADING/);
assert.doesNotMatch(workspace, /enqueueCommand|offline queue|QUEUED/i);
assert.match(workspace, /canManageScheduling/);
assert.match(workspace, /related_\$\{referenceType\}/);

for (const locale of [en, am, om]) {
  for (const key of [
    'logisticsSchedulingTitle',
    'logisticsSchedulingLoading',
    'logisticsSchedulingEmpty',
    'logisticsSchedulingDenied',
    'logisticsSchedulingError',
    'logisticsSchedulingUnknownStale',
    'logisticsSchedulingSubmit',
  ]) assert.match(locale, new RegExp(key + ':'));
}

console.log('L11 Logistics Scheduling API + Workspace Integration Regression: PASS');
