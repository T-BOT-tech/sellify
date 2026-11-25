import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [ui, tabs, html, styles] = await Promise.all([
  readFile(new URL('../app/src/workforce/ui.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/ui/tabs.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
]);

assert.ok(ui.includes("import { authHeaders } from '../auth/tenant.js'"),
  'Workforce UI must use the existing authenticated tenant session');
assert.ok(ui.includes("'/workforce/' + entity + suffix"),
  'all Workforce requests must use the canonical tenant-scoped API');
assert.ok(ui.includes("endpoint('members')"), 'the roster must load canonical Workforce members');
assert.ok(ui.includes("endpoint('departments')") && ui.includes("endpoint('positions')"),
  'organization structure must load from canonical Workforce endpoints');
assert.ok(ui.includes('workforceMemberSearch') && ui.includes('workforceMemberTypeFilter')
  && ui.includes('workforceMemberStatusFilter') && ui.includes('workforceDepartmentFilter')
  && ui.includes('workforcePositionFilter') && ui.includes('workforceLocationFilter'),
  'professional directory must support search and member, status, department, position and location filters');
assert.ok(ui.includes('MEMBER_PAGE_SIZE') && ui.includes('data-member-page'),
  'professional directory must paginate results');
assert.ok(ui.includes('employee_number') && ui.includes('department_id') && ui.includes('position_id')
  && ui.includes('supervisor_member_id'),
  'member creation must support employee numbers and organizational references');
assert.ok(ui.includes('saveMemberCreate') && ui.includes('saveDepartment') && ui.includes('savePosition'),
  'authorized operators must be able to create member, department and position records');
assert.ok(ui.includes('organizationAction') && ui.includes('memberAction'),
  'lifecycle actions must call the authorized Workforce API');
assert.ok(ui.includes("endpoint('utilization', '/summary')"), 'the workspace must load canonical utilization analytics');
assert.ok(ui.includes("JSON.stringify({ expected_version: version })"),
  'member lifecycle requests must carry optimistic concurrency versions');
assert.ok(ui.includes("'Idempotency-Key': 'workforce-ui-'"),
  'availability creation must use an idempotency key');
assert.ok(ui.includes("effective_from: start.toISOString()"),
  'availability writes must satisfy the canonical effective-date contract');
assert.ok(ui.includes("String(config.chatId) !== tenantId")
  && ui.includes("String(config.sessionToken) !== token"),
  'late responses must not cross active tenant or session changes');
assert.ok(!/localStorage|saveJSON|setStaffList|staffList/.test(ui),
  'Workforce UI must not create a parallel local workforce authority');
assert.ok(!ui.includes('createMember') && !ui.includes('user_id:'),
  'the UI must not create duplicate user identities or bypass tenant membership linking');

for (const token of ["'workforce'", "'navWorkforce'", 'renderWorkforce']) {
  assert.ok(tabs.includes(token), 'tab controller missing Workforce integration: ' + token);
}
assert.ok(tabs.includes("'workforce'") && tabs.includes("'navWorkforce'"),
  'Workforce must be included in both tab switching and More navigation');
assert.ok(html.includes('id="tab-workforce"') && html.includes('id="workforceWorkspaceHost"'),
  'the Workforce screen host must exist');
assert.ok(html.includes('id="navWorkforce"') && html.includes("switchTab('workforce')"),
  'the More sheet must expose Workforce navigation');
assert.ok(styles.includes('.workforce-directory-filters') && styles.includes('.workforce-admin-grid'),
  'the responsive directory and organization administration styles must be present');
assert.ok(html.includes('.workforce-metrics') && html.includes('.workforce-availability-form'),
  'the responsive Workforce styles must be present');

console.log('Workforce operator workspace regression: PASS');
