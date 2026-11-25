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
assert.ok(ui.includes('async function refreshWorkspaceWithStatus')
  && ui.includes("refreshWorkspaceWithStatus(root, '#workforceMemberProfileForm'")
  && ui.includes("refreshWorkspaceWithStatus(root, '#workforceProfileForm'")
  && ui.includes("refreshWorkspaceWithStatus(root, '#workforceEngagementForm'"),
  'successful form feedback must remain visible after the workspace refreshes and re-renders the member profile');
assert.ok(ui.includes('workforceEngagementForm') && ui.includes('saveEngagement'),
  'authorized managers must be able to create member-scoped engagements');
assert.ok(ui.includes('workforceShiftTemplateForm') && ui.includes('saveShiftTemplate')
  && ui.includes("endpoint('shift-templates')"),
  'authorized managers must be able to create organization-scoped shift templates');
assert.ok(ui.includes('workforce-shift-generation-form') && ui.includes('generateTemplateShifts')
  && ui.includes("'/generate'") && ui.includes('expected_version'),
  'active templates must generate dated shifts through the versioned canonical API');
assert.ok(ui.includes("optionalRecords('shifts')") && ui.includes('renderDatedShiftAdmin')
  && ui.includes('workforce-dated-shift-row'),
  'the manager workspace must list dated shifts from the canonical Workforce API');
assert.ok(ui.includes('reassignDatedShift') && ui.includes('loadDatedShiftHistory')
  && ui.includes("'/reassign'") && ui.includes("'/history'"),
  'dated shifts must expose reassignment with reason and immutable history');
assert.ok(ui.includes('cancelDatedShift') && ui.includes('Cancellation reason'),
  'dated shift cancellation must capture a reason');
assert.ok(ui.includes('workforceLeaveRequestForm') && ui.includes('saveLeaveRequest')
  && ui.includes("endpoint('leave-requests')") && ui.includes("'/submit'"),
  'employees and managers must be able to submit leave through the canonical Workforce API');
assert.ok(ui.includes('workforceAbsenceForm') && ui.includes('saveAbsence')
  && ui.includes("endpoint('absences')"),
  'authorized managers must be able to record unplanned absences');
assert.ok(ui.includes('submitLeaveAction') && ui.includes('voidAbsence')
  && ui.includes("'/approve'") && ui.includes("'/reject'") && ui.includes("'/withdraw'") && ui.includes("'/cancel'") && ui.includes("'/void'"),
  'leave decisions, withdrawal, cancellation and absence correction must use backend lifecycle actions');
assert.ok(ui.includes('loadWorkforceRecordHistory') && ui.includes('workforce-record-history-button')
  && ui.includes("optionalRecords('leave-requests')") && ui.includes("optionalRecords('absences')"),
  'leave and absence records must display canonical lists and audit history');

assert.ok(ui.includes('validLocalDate') && ui.includes('work_days') && ui.includes('break_rules'),
  'template creation and roster generation must validate dates, weekdays and break rules');
assert.ok(ui.includes('workforceProfileForm') && ui.includes('saveProfile'),
  'authorized managers must be able to create and update structured professional profiles');
assert.ok(ui.includes('primary_location_id') && ui.includes('optionalOrganizationLocations'),
  'professional creation and editing must use the canonical organization location directory');
assert.ok(ui.includes("memberProfileForm?.addEventListener('submit'")
  && ui.includes("accountLinkForm?.addEventListener('submit'")
  && ui.includes("unlinkAccountButton?.addEventListener('click'"),
  'dynamically rendered member edit and existing-account link/unlink controls must have explicit event handlers');
assert.ok(ui.includes('workforceLocationAssignmentForm') && ui.includes('saveLocationAssignment')
  && ui.includes('assignmentAction'),
  'authorized managers must be able to create and manage dated location assignments');
assert.ok(['Skills (comma-separated)','Qualifications (comma-separated)','Languages (comma-separated)','Service capabilities (comma-separated)']
  .every(label => ui.includes(label)),
  'professional profile UI must expose the canonical structured profile fields');
assert.ok(ui.includes('expected_version = Number(form.dataset.version)'),
  'profile updates must use optimistic concurrency');
assert.ok(ui.includes('renderEngagementRecords') && ui.includes('workforce-engagement-action')
  && ui.includes('engagementAction'),
  'engagement records must expose their canonical lifecycle actions');
assert.ok(['submit','activate','suspend','end'].every(action => ui.includes("'" + action + "'")),
  'engagement UI must preserve the entity-specific lifecycle transitions');
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
const memberCreateStart = ui.indexOf('async function saveMemberCreate(');
const memberCreateEnd = ui.indexOf('\nasync function ', memberCreateStart + 1);
assert.ok(memberCreateStart >= 0 && memberCreateEnd > memberCreateStart,
  'the professional-record creation handler must remain explicit');
assert.ok(!ui.slice(memberCreateStart, memberCreateEnd).includes('user_id'),
  'professional-record creation must not create or attach an authentication identity');
assert.ok(ui.includes("async function linkMemberAccount")
  && ui.includes("'/link-account'") && ui.includes("'/unlink-account'"),
  'existing user accounts may only be linked through the canonical membership-validated account-link routes');

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
