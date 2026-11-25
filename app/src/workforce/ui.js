// Authenticated operator-facing Workforce workspace. The backend remains authoritative.
import { config } from '../state.js';
import { authHeaders } from '../auth/tenant.js';
import { escapeHtml, escapeAttr } from '../utils/index.js';

const SECTIONS = Object.freeze([
  ['profiles', 'Profiles'], ['engagements', 'Engagements'], ['calendars', 'Calendars'],
  ['availability', 'Availability'], ['assignments', 'Assignments'], ['shifts', 'Shifts'], ['allocations', 'Allocations'],
  ['leave-requests', 'Leave requests'], ['absences', 'Absences'],
]);
const boundRoots = new WeakSet();
const workspaceData = new WeakMap();
const MEMBER_PAGE_SIZE = 20;
let mountedWorkspace = null;

function apiBase() { return String(config.syncUrl || window.location.origin).replace(/\/$/, ''); }
function endpoint(entity, suffix = '') {
  return apiBase() + '/tenants/' + encodeURIComponent(String(config.chatId)) + '/workforce/' + entity + suffix;
}
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'Workforce request failed (' + response.status + ')');
    error.status = response.status;
    throw error;
  }
  return data;
}
function canManageMembers() {
  const roles = new Set([
    String(config.tenantRole || '').toLowerCase(), String(config.authRole || '').toLowerCase(),
    ...(Array.isArray(config.authRoles) ? config.authRoles.map(role => String(role).toLowerCase()) : []),
  ]);
  return roles.has('owner') || roles.has('manager');
}
function dateLabel(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}
function shiftTimeLabel(value, timezone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value ? String(value) : '—';
  try { return new Intl.DateTimeFormat(undefined, { timeZone: timezone || undefined, dateStyle: 'medium', timeStyle: 'short' }).format(date); }
  catch { return dateLabel(value); }
}
function validLocalDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function hours(minutes) {
  const value = Number(minutes || 0) / 60;
  return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' h' : '—';
}
function renderSummary(summary = {}) {
  const metrics = [
    ['Planned', hours(summary.planned_minutes)], ['Measured plan', hours(summary.measured_planned_minutes)],
    ['Actual', hours(summary.actual_minutes)], ['Variance', hours(summary.variance_minutes)],
  ];
  return '<div class="workforce-metrics">' + metrics.map(([label, value]) =>
    '<article class="logistics-card workforce-metric"><span class="logistics-meta">' + label
    + '</span><strong>' + value + '</strong></article>').join('') + '</div>'
    + '<p class="logistics-meta">Completed ' + Number(summary.completed_events || 0)
    + ' · Open ' + Number(summary.open_events || 0) + ' · Cancelled ' + Number(summary.cancelled_events || 0)
    + ' · Missing actuals ' + Number(summary.completed_missing_actual_events || 0) + '</p>';
}
function renderMember(member, lookup = {}) {
  const state = String(member.status || 'UNKNOWN').toUpperCase();
  const action = state === 'DRAFT' || state === 'SUSPENDED' ? 'activate' : state === 'ACTIVE' ? 'suspend' : '';
  const actionButton = canManageMembers() && action
    ? '<button class="btn-secondary workforce-member-action" type="button" data-action="' + action
      + '" data-member-id="' + escapeAttr(member.id) + '" data-version="' + Number(member.version || 1) + '">'
      + (action === 'activate' ? 'Activate' : 'Suspend') + '</button>' : '';
  const deactivateButton = canManageMembers() && ['ACTIVE','SUSPENDED'].includes(state)
    ? '<button class="btn-secondary workforce-member-action" type="button" data-action="deactivate" data-member-id="'
      + escapeAttr(member.id) + '" data-version="' + Number(member.version || 1) + '">Deactivate</button>' : '';
  const department = lookup.departments?.find(item => String(item.id) === String(member.department_id));
  const position = lookup.positions?.find(item => String(item.id) === String(member.position_id));
  const supervisor = lookup.members?.find(item => String(item.id) === String(member.supervisor_member_id));
  return '<article class="logistics-card workforce-member-card"><div class="logistics-top"><strong>'
    + escapeHtml(member.display_name || member.user_id || 'Workforce member') + '</strong><span class="logistics-status">'
    + escapeHtml(state.replaceAll('_', ' ')) + '</span></div><div class="logistics-meta">'
    + escapeHtml(String(member.member_type || 'Member').replaceAll('_', ' ')) + ' · v' + Number(member.version || 1)
    + '</div><div class="logistics-meta workforce-member-context">'
    + (member.employee_number ? 'Employee # ' + escapeHtml(member.employee_number) + ' · ' : '')
    + 'Department: ' + escapeHtml(department?.name || 'Unassigned') + ' · Position: ' + escapeHtml(position?.name || 'Unassigned')
    + ' · Supervisor: ' + escapeHtml(supervisor?.display_name || 'Unassigned')
    + ' · Account: ' + (member.user_id ? 'Linked' : 'No login linked') + '</div>'
    + '<div class="workforce-member-controls"><button type="button" class="btn-secondary workforce-select-member" data-member-id="'
    + escapeAttr(member.id) + '">Open member</button>' + actionButton + deactivateButton + '</div></article>';
}
function renderAssignmentRecords(workspace, records) {
  const locations = workspaceData.get(workspace)?.locations || [];
  const actionsByStatus = {
    DRAFT: ['activate','end'],
    ACTIVE: ['suspend','end'],
    SUSPENDED: ['activate','end'],
    ENDED: [],
  };
  const rows = records.map(record => {
    const status = String(record.status || 'UNKNOWN').toUpperCase();
    const location = locations.find(item => String(item.id) === String(record.location_id));
    const actions = canManageMembers() ? (actionsByStatus[status] || []) : [];
    const buttons = actions.map(action => '<button type="button" class="btn-secondary workforce-assignment-action"'
      + ' data-assignment-id="' + escapeAttr(record.id) + '" data-action="' + action
      + '" data-version="' + Number(record.version || 1) + '">' + (action === 'activate' ? 'Activate'
        : action === 'suspend' ? 'Suspend' : 'End') + '</button>').join('');
    return '<article class="workforce-record-row workforce-assignment-row"><div><strong>'
      + escapeHtml(String(record.assignment_type || 'Assignment').replaceAll('_',' '))
      + '</strong><span class="logistics-status">' + escapeHtml(status) + '</span>'
      + '<div class="logistics-meta">' + escapeHtml(location?.name || record.resource_id || 'No location/resource')
      + ' · ' + escapeHtml(dateLabel(record.starts_at)) + ' – ' + escapeHtml(dateLabel(record.ends_at)) + '</div></div>'
      + '<div class="workforce-member-controls">' + buttons + '</div></article>';
  }).join('');
  return '<section class="workforce-data-section"><h4>Location and work assignments</h4>'
    + (rows || '<p class="logistics-meta">No assignments recorded.</p>') + '</section>';
}

function renderProfileRecords(records) {
  const rows = records.map(record => {
    const list = field => Array.isArray(record[field]) ? record[field].join(', ') : '';
    return '<article class="workforce-record-row"><div><strong>' + escapeHtml(String(record.visibility || 'ORGANIZATION')) + '</strong>'
      + '<div class="logistics-meta">Effective ' + escapeHtml(dateLabel(record.effective_from))
      + (record.effective_until ? ' – ' + escapeHtml(dateLabel(record.effective_until)) : ' · Ongoing') + '</div>'
      + '<div class="logistics-meta">Skills: ' + escapeHtml(list('skills') || '—')
      + ' · Qualifications: ' + escapeHtml(list('qualifications') || '—') + '</div>'
      + '<div class="logistics-meta">Languages: ' + escapeHtml(list('languages') || '—')
      + ' · Service capabilities: ' + escapeHtml(list('service_capabilities') || '—') + '</div>'
      + (record.notes ? '<p class="logistics-meta">' + escapeHtml(record.notes) + '</p>' : '')
      + '</div><span class="logistics-meta">v' + Number(record.version || 1) + '</span></article>';
  }).join('');
  return '<section class="workforce-data-section"><h4>Professional profiles</h4>'
    + (rows || '<p class="logistics-meta">No structured profile recorded.</p>') + '</section>';
}

function renderEngagementRecords(records) {
  const actionsByStatus = {
    DRAFT: ['submit','end'],
    PENDING_APPROVAL: ['activate','end'],
    ACTIVE: ['suspend','end'],
    SUSPENDED: ['activate','end'],
    ENDED: [],
  };
  const rows = records.map(record => {
    const status = String(record.status || 'UNKNOWN').toUpperCase();
    const actions = canManageMembers() ? (actionsByStatus[status] || []) : [];
    const buttons = actions.map(action => '<button type="button" class="btn-secondary workforce-engagement-action"'
      + ' data-engagement-id="' + escapeAttr(record.id) + '" data-action="' + action
      + '" data-version="' + Number(record.version || 1) + '">' + (action === 'activate' ? 'Activate'
        : action === 'submit' ? 'Submit for approval' : action === 'suspend' ? 'Suspend' : 'End') + '</button>').join('');
    return '<article class="workforce-record-row workforce-engagement-row"><div><strong>'
      + escapeHtml(String(record.engagement_type || 'Engagement').replaceAll('_',' '))
      + '</strong><span class="logistics-status">' + escapeHtml(status.replaceAll('_',' ')) + '</span>'
      + '<div class="logistics-meta">' + escapeHtml(dateLabel(record.starts_at))
      + (record.ends_at ? ' – ' + escapeHtml(dateLabel(record.ends_at)) : ' · No end date')
      + (record.terms_reference ? ' · ' + escapeHtml(record.terms_reference) : '') + '</div></div>'
      + '<div class="workforce-member-controls">' + buttons + '</div></article>';
  }).join('');
  return '<section class="workforce-data-section"><h4>Engagements</h4>'
    + (rows || '<p class="logistics-meta">No engagements recorded.</p>') + '</section>';
}

function renderRecords(title, records) {
  const rows = records.slice(0, 12).map(record => {
    const state = record.status || record.state || record.availability || '—';
    const start = record.starts_at || record.planned_starts_at || record.effective_from;
    const end = record.ends_at || record.planned_ends_at || record.effective_until;
    return '<article class="workforce-record-row"><div><strong>' + escapeHtml(String(state).replaceAll('_', ' '))
      + '</strong><div class="logistics-meta">' + escapeHtml(dateLabel(start))
      + (end ? ' – ' + escapeHtml(dateLabel(end)) : '') + '</div></div><span class="logistics-meta">v'
      + Number(record.version || 1) + '</span></article>';
  }).join('');
  return '<section class="workforce-data-section"><h4>' + title + '</h4>'
    + (rows || '<p class="logistics-meta">No records yet.</p>') + '</section>';
}

export function workforceWorkspaceShell() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return '<section id="workforceWorkspace" class="settings-section" aria-label="Workforce workspace">'
    + '<div class="workforce-heading"><div><h2>Workforce</h2><p class="logistics-meta">People, organizational structure, availability and work records. Server authorization remains authoritative.</p></div>'
    + '<button type="button" class="btn-secondary" id="workforceRefresh">Refresh</button></div>'
    + '<p id="workforceStatus" class="logistics-meta" role="status" aria-live="polite">Loading Workforce…</p>'
    + '<section><h3>Overview</h3><div id="workforceOverviewMetrics" class="workforce-overview-metrics"></div><div id="workforceSummary"></div></section>'
    + '<section><div class="workforce-heading"><h3>Professional directory</h3><span id="workforceDirectoryCount" class="logistics-meta"></span></div>'
    + '<div class="workforce-directory-filters">'
    + '<label class="workforce-search-label">Search<input id="workforceMemberSearch" type="search" placeholder="Name or employee number"></label>'
    + '<label>Type<select id="workforceMemberTypeFilter"><option value="">All types</option><option>EMPLOYEE</option><option>CONTRACTOR</option><option>PROVIDER</option><option>VOLUNTEER</option></select></label>'
    + '<label>Status<select id="workforceMemberStatusFilter"><option value="">All statuses</option><option>ACTIVE</option><option>DRAFT</option><option>SUSPENDED</option><option>INACTIVE</option></select></label>'
    + '<label>Department<select id="workforceDepartmentFilter"><option value="">All departments</option></select></label>'
    + '<label>Position<select id="workforcePositionFilter"><option value="">All positions</option></select></label>'
    + '<label>Location ID<input id="workforceLocationFilter" type="search" placeholder="Any location"></label></div>'
    + '<div id="workforceMembers"></div><div id="workforceMemberPagination" class="workforce-pagination"></div></section>'
    + '<section id="workforceMemberCreateSection" hidden><h3>Add a professional</h3><p class="logistics-meta">A Workforce record can exist without a Sellify login. Link an account later when appropriate.</p>'
    + '<form id="workforceMemberCreateForm" class="settings-form workforce-admin-form">'
    + '<label>Professional type<select name="member_type" required><option value="EMPLOYEE">Employee</option><option value="CONTRACTOR">Contractor</option><option value="PROVIDER">Service professional</option><option value="VOLUNTEER">Volunteer</option></select></label>'
    + '<label>Display name<input name="display_name" maxlength="120" required></label>'
    + '<label>Employee number (optional)<input name="employee_number" maxlength="80"></label>'
    + '<label>Primary location<select name="primary_location_id"><option value="">No primary location</option></select></label>'
    + '<label>Department<select name="department_id"><option value="">Unassigned</option></select></label>'
    + '<label>Position<select name="position_id"><option value="">Unassigned</option></select></label>'
    + '<label>Supervisor<select name="supervisor_member_id"><option value="">No supervisor</option></select></label>'
    + '<button type="submit" class="btn-primary">Create professional record</button><p class="logistics-meta workforce-form-status" role="status"></p></form></section>'
    + '<section id="workforceOrganizationAdmin" hidden><h3>Organization structure</h3>'
    + '<div class="workforce-admin-grid"><div><h4>Departments</h4><div id="workforceDepartments"></div>'
    + '<form id="workforceDepartmentForm" class="settings-form workforce-admin-form"><label>Code<input name="code" maxlength="40" required></label><label>Name<input name="name" maxlength="120" required></label><label>Description<input name="description" maxlength="1000"></label><button type="submit" class="btn-primary">Add department</button><p class="logistics-meta workforce-form-status" role="status"></p></form></div>'
    + '<div><h4>Positions</h4><div id="workforcePositions"></div>'
    + '<form id="workforcePositionForm" class="settings-form workforce-admin-form"><label>Code<input name="code" maxlength="40" required></label><label>Name<input name="name" maxlength="120" required></label><label>Department<select name="department_id"><option value="">No department</option></select></label><label>Classification<input name="classification" maxlength="80"></label><button type="submit" class="btn-primary">Add position</button><p class="logistics-meta workforce-form-status" role="status"></p></form></div></div></section>'
    + '<section id="workforceShiftTemplateAdmin" hidden><h3>Shift templates and roster generation</h3>'
    + '<p class="logistics-meta">Templates are reusable local-time definitions. Generation creates dated shifts for eligible members; existing shifts are never silently rewritten.</p>'
    + '<div id="workforceShiftTemplates"></div><h4>Dated shifts</h4><div id="workforceDatedShifts"></div>'
    + '<form id="workforceShiftTemplateForm" class="settings-form workforce-admin-form">'
    + '<h4>Create shift template</h4><label>Name<input name="name" maxlength="120" required></label>'
    + '<label>Start (local time)<input name="start_local_time" type="time" required></label><label>End (local time)<input name="end_local_time" type="time" required></label>'
    + '<label>Timezone<input name="timezone" value="' + escapeAttr(zone) + '" maxlength="80" required></label>'
    + '<fieldset><legend>Working days</legend><div class="workforce-day-options">'
    + ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day,index) => '<label><input type="checkbox" name="work_days" value="' + (index+1) + '"' + (index<5?' checked':'') + '> ' + day + '</label>').join('')
    + '</div></fieldset>'
    + '<label>Break start (optional)<input name="break_start_local_time" type="time"></label><label>Break end (optional)<input name="break_end_local_time" type="time"></label>'
    + '<label>Department<select name="department_id"><option value="">Any department</option></select></label>'
    + '<label>Position<select name="position_id"><option value="">Any position</option></select></label>'
    + '<label>Location<select name="location_id"><option value="">Member primary location</option></select></label>'
    + '<label>Effective from<input name="effective_from" type="date" required></label><label>Effective until (optional)<input name="effective_until" type="date"></label>'
    + '<button type="submit" class="btn-primary">Create shift template</button><p class="logistics-meta workforce-form-status" role="status"></p></form></section>'
    + '<section id="workforceLeaveAbsenceAdmin" hidden><h3>Leave and absence</h3>'
    + '<p class="logistics-meta">Leave requests require manager decisions. Recorded unplanned absences affect scheduling immediately; corrections are retained in history.</p>'
    + '<div class="workforce-admin-grid"><div><h4>Request leave</h4>'
    + '<form id="workforceLeaveRequestForm" class="settings-form workforce-admin-form">'
    + '<label class="workforce-leave-member-label">Professional<select name="member_id" required><option value="">Choose a professional</option></select></label>'
    + '<label>Category<select name="leave_category" required><option>ANNUAL</option><option>SICK</option><option>PERSONAL</option><option>UNPAID</option><option>PARENTAL</option><option>BEREAVEMENT</option><option>OTHER</option></select></label>'
    + '<label>Starts<input name="starts_at" type="datetime-local" required></label><label>Ends<input name="ends_at" type="datetime-local" required></label>'
    + '<label><input name="all_day" type="checkbox"> All-day leave</label><label>Reason<textarea name="reason" rows="2" maxlength="1000" required></textarea></label>'
    + '<button type="submit" class="btn-primary">Submit leave request</button><p class="logistics-meta workforce-form-status" role="status"></p></form></div>'
    + '<div id="workforceAbsenceAdmin"><h4>Record unplanned absence</h4>'
    + '<form id="workforceAbsenceForm" class="settings-form workforce-admin-form">'
    + '<label>Professional<select name="member_id" required><option value="">Choose an active professional</option></select></label>'
    + '<label>Absence type<select name="absence_type" required><option>SICKNESS</option><option>UNPLANNED</option><option>NO_SHOW</option><option>OTHER</option></select></label>'
    + '<label>Starts<input name="starts_at" type="datetime-local" required></label><label>Ends<input name="ends_at" type="datetime-local" required></label>'
    + '<label><input name="all_day" type="checkbox"> All-day absence</label><label>Reason<textarea name="reason" rows="2" maxlength="1000" required></textarea></label>'
    + '<button type="submit" class="btn-primary">Record absence</button><p class="logistics-meta workforce-form-status" role="status"></p></form></div></div>'
    + '<h4>Leave requests</h4><div id="workforceLeaveRequests"></div><h4>Recorded absences</h4><div id="workforceAbsences"></div></section>'
    + '<section id="workforceSchedulingPolicyAdmin" hidden><h3>Scheduling policy</h3>'
    + '<p class="logistics-meta">Configure organization rules used to assess shift feasibility. Warnings and unknown evidence are distinct from blocking conflicts.</p>'
    + '<div id="workforceSchedulingPolicies"></div>'
    + '<form id="workforceSchedulingPolicyForm" class="settings-form workforce-admin-form">'
    + '<h4 id="workforceSchedulingPolicyFormTitle">Create scheduling policy</h4>'
    + '<label>Policy name<input name="name" maxlength="120" required></label>'
    + '<label>Effective from<input name="effective_from" type="date" required></label><label>Effective until (optional)<input name="effective_until" type="date"></label>'
    + '<fieldset><legend>Shift and working-time limits (minutes)</legend>'
    + '<label>Maximum shift duration<input name="max_shift_minutes" type="number" min="1" max="1440" step="1"></label>'
    + '<label>Maximum daily working time<input name="max_daily_minutes" type="number" min="1" max="1440" step="1"></label>'
    + '<label>Maximum weekly working time<input name="max_weekly_minutes" type="number" min="1" max="10080" step="1"></label>'
    + '<label>Minimum rest between shifts<input name="minimum_rest_minutes" type="number" min="0" max="10080" step="1"></label>'
    + '<label>Require a break after (minutes)<input name="minimum_break_after_minutes" type="number" min="1" max="1440" step="1"></label>'
    + '<label>Minimum break duration<input name="minimum_break_duration_minutes" type="number" min="1" max="240" step="1"></label>'
    + '<label>Maximum consecutive working days<input name="max_consecutive_days" type="number" min="1" max="31" step="1"></label></fieldset>'
    + '<label>Required qualifications (comma-separated)<textarea name="required_qualifications" rows="2" maxlength="1000"></textarea></label>'
    + '<label>Location policy<select name="location_policy"><option value="ANY">Any location</option><option value="ASSIGNED_ONLY">Assigned locations only</option></select></label>'
    + '<label>Daily limit enforcement<select name="max_daily_enforcement"><option value="BLOCK">Block scheduling</option><option value="WARN">Warn only</option></select></label>'
    + '<label><input name="allow_overrides" type="checkbox"> Allow manager overrides for blocking conflicts</label>'
    + '<label><input name="allow_unknown_overrides" type="checkbox"> Allow manager overrides when assessment evidence is unknown</label>'
    + '<div class="workforce-form-actions"><button type="submit" class="btn-primary">Save scheduling policy</button><button type="button" class="btn-secondary" id="workforceSchedulingPolicyClear">Clear form</button></div>'
    + '<p class="logistics-meta workforce-form-status" role="status"></p></form></section>'
    + '<section id="workforceMemberDetails" hidden><div class="workforce-heading"><h3 id="workforceSelectedMemberTitle">Member workspace</h3>'
    + '<button type="button" class="btn-secondary" id="workforceClearMember">Close</button></div><div id="workforceMemberProfile"></div><div id="workforceMemberRecords"></div>'
    + '<form id="workforceProfileForm" class="settings-form workforce-admin-form" hidden>'
    + '<h4>Professional skills and qualifications</h4><label>Skills (comma-separated)<textarea name="skills" rows="2"></textarea></label>'
    + '<label>Qualifications (comma-separated)<textarea name="qualifications" rows="2"></textarea></label>'
    + '<label>Languages (comma-separated)<textarea name="languages" rows="2"></textarea></label>'
    + '<label>Service capabilities (comma-separated)<textarea name="service_capabilities" rows="2"></textarea></label>'
    + '<label>Visibility<select name="visibility"><option value="PRIVATE">Private</option><option value="ORGANIZATION" selected>Organization</option><option value="LOCATION">Location</option><option value="PUBLIC">Public</option></select></label>'
    + '<label>Effective from<input name="effective_from" type="date" required></label><label>Effective until (optional)<input name="effective_until" type="date"></label>'
    + '<label>Notes<textarea name="notes" rows="3" maxlength="2000"></textarea></label>'
    + '<button type="submit" class="btn-primary">Save professional profile</button><p class="logistics-meta workforce-form-status" role="status"></p></form>'
    + '<form id="workforceEngagementForm" class="settings-form workforce-admin-form" hidden>'
    + '<h4>Record an engagement</h4><label>Relationship type<select name="engagement_type" required><option value="EMPLOYMENT">Employment</option><option value="CONTRACT">Contract</option><option value="PROVIDER_RELATIONSHIP">Provider relationship</option><option value="VOLUNTEER">Volunteer</option><option value="INTERNAL_ASSIGNMENT">Internal assignment</option></select></label>'
    + '<label>Start<input name="starts_at" type="datetime-local" required></label><label>End (optional)<input name="ends_at" type="datetime-local"></label>'
    + '<label>Terms reference (optional)<input name="terms_reference" maxlength="160"></label>'
    + '<button type="submit" class="btn-primary">Create engagement</button><p class="logistics-meta workforce-form-status" role="status"></p></form>'
    + '<form id="workforceLocationAssignmentForm" class="settings-form workforce-admin-form" hidden>'
    + '<h4>Assign to a location</h4><label>Location<select name="location_id" required><option value="">Choose a location</option></select></label>'
    + '<label>Start<input name="starts_at" type="datetime-local" required></label><label>End<input name="ends_at" type="datetime-local" required></label>'
    + '<button type="submit" class="btn-primary">Create location assignment</button><p class="logistics-meta workforce-form-status" role="status"></p></form>'
    + '<form id="workforceAvailabilityAssessmentForm" class="settings-form workforce-admin-form workforce-assessment-form">'
    + '<h4>Assess availability</h4><p class="logistics-meta">Check the selected professional against current Workforce evidence. This does not create a booking, shift or reservation.</p>'
    + '<label>Requested start<input name="starts_at" type="datetime-local" required></label>'
    + '<label>Requested end<input name="ends_at" type="datetime-local" required></label>'
    + '<label>Timezone<input name="timezone" value="' + escapeAttr(zone) + '" readonly required></label>'
    + '<button type="submit" class="btn-secondary">Assess availability</button>'
    + '<p class="logistics-meta workforce-form-status" role="status" aria-live="polite"></p>'
    + '<div id="workforceAvailabilityAssessmentResult" aria-live="polite"></div></form>'
    + '<form id="workforceAvailabilityForm" class="settings-form workforce-availability-form">'
    + '<h4>Declare availability</h4><label>Availability<select name="availability" required><option value="AVAILABLE">Available</option>'
    + '<option value="UNAVAILABLE">Unavailable</option><option value="TENTATIVE">Tentative</option><option value="BLACKOUT">Blackout</option></select></label>'
    + '<label>Start<input name="starts_at" type="datetime-local" required></label><label>End<input name="ends_at" type="datetime-local" required></label>'
    + '<label>Timezone<input name="timezone" value="' + escapeAttr(zone) + '" readonly required></label>'
    + '<button type="submit" class="btn-primary">Save availability</button><p class="logistics-meta workforce-form-status" role="status"></p></form></section></section>';
}
function renderOverviewMetrics(members, departments, positions, engagements) {
  const activeEmployees = members.filter(member => member.status === 'ACTIVE' && member.member_type === 'EMPLOYEE').length;
  const external = members.filter(member => !member.user_id).length;
  const inactive = members.filter(member => ['SUSPENDED','INACTIVE'].includes(member.status)).length;
  const pending = engagements.filter(item => ['DRAFT','PENDING','REQUESTED','SUBMITTED'].includes(String(item.status || '').toUpperCase())).length;
  const metrics = [
    ['Active employees', activeEmployees], ['External professionals', external],
    ['Suspended / inactive', inactive], ['Departments', departments.length],
    ['Positions', positions.length], ['Pending engagements', pending],
  ];
  return metrics.map(([label,value]) => '<article class="logistics-card workforce-overview-metric"><span class="logistics-meta">'
    + escapeHtml(label) + '</span><strong>' + Number(value) + '</strong></article>').join('');
}

function renderMemberDirectory(root) {
  const workspace = root.querySelector('#workforceWorkspace');
  const data = workspaceData.get(workspace);
  if (!workspace || !data) return;
  const query = String(workspace.querySelector('#workforceMemberSearch')?.value || '').trim().toLowerCase();
  const type = String(workspace.querySelector('#workforceMemberTypeFilter')?.value || '');
  const status = String(workspace.querySelector('#workforceMemberStatusFilter')?.value || '');
  const departmentId = String(workspace.querySelector('#workforceDepartmentFilter')?.value || '');
  const positionId = String(workspace.querySelector('#workforcePositionFilter')?.value || '');
  const locationId = String(workspace.querySelector('#workforceLocationFilter')?.value || '').trim().toLowerCase();
  const filtered = data.members.filter(member => {
    const haystack = [member.display_name, member.employee_number, member.user_id].map(value => String(value || '').toLowerCase()).join(' ');
    return (!query || haystack.includes(query))
      && (!type || member.member_type === type)
      && (!status || member.status === status)
      && (!departmentId || String(member.department_id || '') === departmentId)
      && (!positionId || String(member.position_id || '') === positionId)
      && (!locationId || String(member.primary_location_id || '').toLowerCase().includes(locationId));
  });
  const pages = Math.max(1, Math.ceil(filtered.length / MEMBER_PAGE_SIZE));
  const page = Math.min(Math.max(0, Number(workspace.dataset.memberPage || 0)), pages - 1);
  workspace.dataset.memberPage = String(page);
  const records = filtered.slice(page * MEMBER_PAGE_SIZE, (page + 1) * MEMBER_PAGE_SIZE);
  const lookup = { members: data.members, departments: data.departments, positions: data.positions };
  workspace.querySelector('#workforceDirectoryCount').textContent = filtered.length + ' of ' + data.members.length + ' professionals';
  workspace.querySelector('#workforceMembers').innerHTML = records.length
    ? records.map(member => renderMember(member, lookup)).join('')
    : '<p class="logistics-meta">No professionals match these filters.</p>';
  workspace.querySelector('#workforceMemberPagination').innerHTML = '<button type="button" class="btn-secondary" data-member-page="prev" '
    + (page === 0 ? 'disabled' : '') + '>Previous</button><span class="logistics-meta">Page ' + (page + 1) + ' of ' + pages + '</span>'
    + '<button type="button" class="btn-secondary" data-member-page="next" ' + (page >= pages - 1 ? 'disabled' : '') + '>Next</button>';
}

function fillSelect(select, records, selected = '', labelField = 'name') {
  if (!select) return;
  const first = select.options[0]?.outerHTML || '<option value="">Unassigned</option>';
  select.innerHTML = first + records.map(record => '<option value="' + escapeAttr(record.id) + '"'
    + (String(record.id) === String(selected) ? ' selected' : '') + '>' + escapeHtml(record[labelField] || record.code || record.id) + '</option>').join('');
}

function renderShiftTemplateAdmin(workspace, templates, departments, positions, locations, members) {
  const section = workspace.querySelector('#workforceShiftTemplateAdmin');
  if (!canManageMembers()) { section.hidden = true; return; }
  section.hidden = false;
  fillSelect(section.querySelector('#workforceShiftTemplateForm [name="department_id"]'), departments);
  fillSelect(section.querySelector('#workforceShiftTemplateForm [name="position_id"]'), positions);
  fillSelect(section.querySelector('#workforceShiftTemplateForm [name="location_id"]'), locations);
  const eligibleMembers = members.filter(member => member.status === 'ACTIVE');
  const rows = templates.map(template => {
    const state = String(template.status || 'UNKNOWN').toUpperCase();
    const action = state === 'ACTIVE' ? 'deactivate' : 'activate';
    const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const days = (Array.isArray(template.work_days) ? template.work_days : []).map(day => dayLabels[Number(day)-1]).filter(Boolean).join(', ');
    const breaks = Array.isArray(template.break_rules) && template.break_rules.length
      ? ' · Breaks: ' + template.break_rules.map(rule => escapeHtml(rule.start_local_time + '–' + rule.end_local_time)).join(', ') : '';
    const generation = state === 'ACTIVE'
      ? '<form class="settings-form workforce-shift-generation-form" data-template-id="' + escapeAttr(template.id)
        + '" data-template-version="' + Number(template.version || 1) + '"><label>Professional<select name="member_id" required><option value="">Choose an active member</option>'
        + eligibleMembers.map(member => '<option value="' + escapeAttr(member.id) + '">' + escapeHtml(member.display_name || member.id) + '</option>').join('')
        + '</select></label><label>From<input type="date" name="from_date" required></label><label>To<input type="date" name="to_date" required></label>'
        + '<label>Override reason (only if policy permits)<input name="override_reason" maxlength="500"></label>'
        + '<button type="submit" class="btn-secondary">Generate dated shifts</button><p class="logistics-meta workforce-form-status" role="status"></p></form>'
      : '<p class="logistics-meta">Activate this template before generating dated shifts.</p>';
    return '<article class="workforce-record-row workforce-shift-template-row"><div><strong>' + escapeHtml(template.name || 'Shift template')
      + '</strong><span class="logistics-status">' + escapeHtml(state) + '</span>'
      + '<div class="logistics-meta">' + escapeHtml(template.start_local_time || '') + '–' + escapeHtml(template.end_local_time || '')
      + ' · ' + escapeHtml(template.timezone || 'Timezone not set') + ' · ' + escapeHtml(days || 'No days configured') + breaks + '</div>'
      + '<div class="logistics-meta">Effective ' + escapeHtml(template.effective_from || '—')
      + (template.effective_until ? ' – ' + escapeHtml(template.effective_until) : ' · Ongoing')
      + ' · v' + Number(template.version || 1) + '</div></div>'
      + '<div class="workforce-member-controls"><button type="button" class="btn-secondary workforce-structure-action" data-entity="shift-templates" data-id="'
      + escapeAttr(template.id) + '" data-version="' + Number(template.version || 1) + '" data-action="' + action + '">'
      + (action === 'deactivate' ? 'Deactivate' : 'Activate') + '</button></div>' + generation + '</article>';
  }).join('');
  section.querySelector('#workforceShiftTemplates').innerHTML = rows || '<p class="logistics-meta">No shift templates yet.</p>';
}

function renderDatedShiftAdmin(workspace, shifts, members) {
  const host = workspace.querySelector('#workforceDatedShifts');
  if (!host) return;
  if (!canManageMembers()) { host.replaceChildren(); return; }
  const activeMembers = members.filter(member => member.status === 'ACTIVE');
  const rows = [...shifts].sort((a, b) => String(a.starts_at || '').localeCompare(String(b.starts_at || ''))).map(shift => {
    const state = String(shift.status || 'UNKNOWN').toUpperCase();
    const member = members.find(item => String(item.id) === String(shift.member_id));
    const memberLabel = member?.display_name || shift.member_id || 'Unassigned';
    const assessmentState = String(shift.constraint_state || 'UNKNOWN').toUpperCase();
    const assessmentPolicy = shift.constraint_policy_version ? ' · policy v' + Number(shift.constraint_policy_version) : ' · no active policy';
    const assessmentFindings = Array.isArray(shift.constraint_findings) ? shift.constraint_findings.map(item => item.message).filter(Boolean).join('; ') : '';
    const transition = state === 'PLANNED' ? 'confirm' : state === 'CONFIRMED' ? 'start' : state === 'IN_PROGRESS' ? 'complete' : '';
    const transitionButton = transition
      ? '<button type="button" class="btn-secondary workforce-shift-transition" data-shift-id="' + escapeAttr(shift.id)
        + '" data-action="' + transition + '" data-version="' + Number(shift.version || 1) + '">'
        + (transition === 'confirm' ? 'Confirm shift' : transition === 'start' ? 'Start shift' : 'Complete shift') + '</button>' : '';
    const reassignForm = ['PLANNED','CONFIRMED'].includes(state) && activeMembers.some(item => String(item.id) !== String(shift.member_id))
      ? '<form class="settings-form workforce-shift-reassign-form" data-shift-id="' + escapeAttr(shift.id)
        + '" data-version="' + Number(shift.version || 1) + '"><label>Reassign to<select name="member_id" required><option value="">Choose an active professional</option>'
        + activeMembers.filter(item => String(item.id) !== String(shift.member_id)).map(item =>
          '<option value="' + escapeAttr(item.id) + '">' + escapeHtml(item.display_name || item.id) + '</option>').join('')
        + '</select></label><label>Reason<input name="reason" maxlength="500" required></label>'
        + '<label>Override reason (only if policy permits)<input name="override_reason" maxlength="500"></label>'
        + '<button type="submit" class="btn-secondary">Reassign shift</button><p class="logistics-meta workforce-form-status" role="status"></p></form>' : '';
    const cancelForm = ['PLANNED','CONFIRMED','IN_PROGRESS'].includes(state)
      ? '<form class="settings-form workforce-shift-cancel-form" data-shift-id="' + escapeAttr(shift.id)
        + '" data-version="' + Number(shift.version || 1) + '"><label>Cancellation reason<input name="reason" maxlength="500" required></label>'
        + '<button type="submit" class="btn-secondary">Cancel shift</button><p class="logistics-meta workforce-form-status" role="status"></p></form>' : '';
    return '<article class="workforce-record-row workforce-dated-shift-row" data-shift-id="' + escapeAttr(shift.id) + '">'
      + '<div><strong>' + escapeHtml(memberLabel) + '</strong><span class="logistics-status">' + escapeHtml(state.replaceAll('_',' ')) + '</span>'
      + '<div class="logistics-meta">' + escapeHtml(shiftTimeLabel(shift.starts_at, shift.timezone)) + ' – '
      + escapeHtml(shiftTimeLabel(shift.ends_at, shift.timezone)) + ' · ' + escapeHtml(shift.timezone || 'Timezone not set') + '</div>'
      + '<div class="logistics-meta">' + (shift.generated_local_date ? 'Generated for ' + escapeHtml(shift.generated_local_date) : 'Manual dated shift')
      + ' · v' + Number(shift.version || 1) + '</div>'
      + '<div class="logistics-meta">Scheduling assessment: ' + escapeHtml(assessmentState.replaceAll('_',' ')) + escapeHtml(assessmentPolicy) + '</div>'
      + (assessmentFindings ? '<div class="logistics-meta">' + escapeHtml(assessmentFindings) + '</div>' : '')
      + (shift.constraint_override_reason ? '<div class="logistics-meta">Manager override: ' + escapeHtml(shift.constraint_override_reason) + '</div>' : '') + '</div>'
      + '<div class="workforce-member-controls">' + transitionButton
      + '<button type="button" class="btn-secondary workforce-shift-history-button" data-shift-id="' + escapeAttr(shift.id) + '">View history</button></div>'
      + reassignForm + cancelForm + '<div class="workforce-shift-history" hidden></div></article>';
  }).join('');
  host.innerHTML = rows || '<p class="logistics-meta">No dated shifts yet. Generate shifts from an active template above.</p>';
}

function renderOrganizationAdmin(workspace, departments, positions) {
  const section = workspace.querySelector('#workforceOrganizationAdmin');
  const createSection = workspace.querySelector('#workforceMemberCreateSection');
  if (!canManageMembers()) { section.hidden = true; createSection.hidden = true; return; }
  section.hidden = false; createSection.hidden = false;
  workspace.querySelector('#workforceDepartments').innerHTML = departments.length ? departments.map(item =>
    '<article class="workforce-admin-row"><div><strong>' + escapeHtml(item.name) + '</strong><span class="logistics-meta">' + escapeHtml(item.code) + ' · ' + escapeHtml(item.status) + '</span></div>'
    + '<button type="button" class="btn-secondary workforce-structure-action" data-entity="departments" data-action="' + (item.status === 'ACTIVE' ? 'deactivate' : 'activate')
    + '" data-id="' + escapeAttr(item.id) + '" data-version="' + Number(item.version || 1) + '">' + (item.status === 'ACTIVE' ? 'Deactivate' : 'Activate') + '</button></article>'
  ).join('') : '<p class="logistics-meta">No departments yet.</p>';
  workspace.querySelector('#workforcePositions').innerHTML = positions.length ? positions.map(item =>
    '<article class="workforce-admin-row"><div><strong>' + escapeHtml(item.name) + '</strong><span class="logistics-meta">' + escapeHtml(item.code) + ' · ' + escapeHtml(item.status) + '</span></div>'
    + '<button type="button" class="btn-secondary workforce-structure-action" data-entity="positions" data-action="' + (item.status === 'ACTIVE' ? 'deactivate' : 'activate')
    + '" data-id="' + escapeAttr(item.id) + '" data-version="' + Number(item.version || 1) + '">' + (item.status === 'ACTIVE' ? 'Deactivate' : 'Activate') + '</button></article>'
  ).join('') : '<p class="logistics-meta">No positions yet.</p>';
  fillSelect(workspace.querySelector('#workforceDepartmentFilter'), departments, '', 'name');
  fillSelect(workspace.querySelector('#workforcePositionFilter'), positions, '', 'name');
  fillSelect(workspace.querySelector('#workforceMemberCreateForm [name="primary_location_id"]'), workspaceData.get(workspace)?.locations || [], '', 'name');
  fillSelect(workspace.querySelector('#workforceMemberCreateForm [name="department_id"]'), departments);
  fillSelect(workspace.querySelector('#workforceMemberCreateForm [name="position_id"]'), positions);
  fillSelect(workspace.querySelector('#workforcePositionForm [name="department_id"]'), departments);
  const supervisors = workspaceData.get(workspace)?.members.filter(member => member.status === 'ACTIVE') || [];
  fillSelect(workspace.querySelector('#workforceMemberCreateForm [name="supervisor_member_id"]'), supervisors, '', 'display_name');
}


async function optionalOrganizationLocations() {
  try {
    const data = await request(apiBase() + '/tenants/' + encodeURIComponent(String(config.chatId)) + '/locations?include_inactive=false');
    return Array.isArray(data.locations) ? data.locations : [];
  } catch (error) {
    if ([403,404].includes(error.status)) return [];
    throw error;
  }
}

async function optionalRecords(entity) {
  try {
    const data = await request(endpoint(entity) + '?limit=100');
    return Array.isArray(data.records) ? data.records : [];
  } catch (error) {
    if ([403,404].includes(error.status)) return [];
    throw error;
  }
}

function renderLeaveAbsenceAdmin(workspace, leaveRequests, absences, members) {
  const section = workspace.querySelector('#workforceLeaveAbsenceAdmin');
  if (!section) return;
  section.hidden = false;
  const manager = canManageMembers();
  const activeMembers = members.filter(member => String(member.status || '').toUpperCase() === 'ACTIVE');
  const leaveForm = section.querySelector('#workforceLeaveRequestForm');
  const leaveMemberLabel = leaveForm.querySelector('.workforce-leave-member-label');
  const leaveMemberSelect = leaveForm.elements.member_id;
  fillSelect(leaveMemberSelect, manager ? members : members.slice(0, 1), '', 'display_name');
  if (manager) {
    leaveMemberLabel.hidden = false;
    leaveMemberSelect.disabled = false;
  } else {
    leaveMemberLabel.hidden = true;
    leaveMemberSelect.disabled = false;
    leaveMemberSelect.value = members[0]?.id || '';
  }
  leaveForm.hidden = members.length === 0;
  const absenceSection = section.querySelector('#workforceAbsenceAdmin');
  absenceSection.hidden = !manager;
  const absenceForm = section.querySelector('#workforceAbsenceForm');
  fillSelect(absenceForm.elements.member_id, activeMembers, '', 'display_name');
  absenceForm.hidden = !manager || activeMembers.length === 0;

  const leaveRows = leaveRequests.map(record => {
    const state = String(record.status || 'UNKNOWN').toUpperCase();
    const member = members.find(item => String(item.id) === String(record.member_id));
    const actions = [];
    if (state === 'DRAFT') {
      actions.push('<form class="workforce-leave-action-form" data-record-id="' + escapeAttr(record.id) + '" data-action="submit" data-version="' + Number(record.version || 1) + '"><button type="submit" class="btn-secondary">Submit request</button></form>');
    } else if (manager && state === 'PENDING_APPROVAL') {
      actions.push('<form class="workforce-leave-action-form" data-record-id="' + escapeAttr(record.id) + '" data-action="approve" data-version="' + Number(record.version || 1) + '"><label>Decision note (optional)<input name="decision_reason" maxlength="500"></label><button type="submit" class="btn-secondary">Approve</button></form>');
      actions.push('<form class="workforce-leave-action-form" data-record-id="' + escapeAttr(record.id) + '" data-action="reject" data-version="' + Number(record.version || 1) + '"><label>Rejection reason<input name="decision_reason" maxlength="500" required></label><button type="submit" class="btn-secondary">Reject</button></form>');
    } else if (manager && state === 'APPROVED') {
      actions.push('<form class="workforce-leave-action-form" data-record-id="' + escapeAttr(record.id) + '" data-action="cancel" data-version="' + Number(record.version || 1) + '"><label>Cancellation reason<input name="reason" maxlength="500" required></label><button type="submit" class="btn-secondary">Cancel approval</button></form>');
    } else if (!manager && ['DRAFT','PENDING_APPROVAL'].includes(state)) {
      actions.push('<form class="workforce-leave-action-form" data-record-id="' + escapeAttr(record.id) + '" data-action="withdraw" data-version="' + Number(record.version || 1) + '"><label>Withdrawal note (optional)<input name="reason" maxlength="500"></label><button type="submit" class="btn-secondary">Withdraw request</button></form>');
    }
    return '<article class="workforce-record-row workforce-leave-row"><div><strong>' + escapeHtml(member?.display_name || 'Workforce member') + '</strong><span class="logistics-status">' + escapeHtml(state.replaceAll('_',' ')) + '</span>'
      + '<div class="logistics-meta">' + escapeHtml(String(record.leave_category || 'Leave').replaceAll('_',' ')) + ' · ' + escapeHtml(dateLabel(record.starts_at)) + ' – ' + escapeHtml(dateLabel(record.ends_at)) + ' · ' + escapeHtml(record.timezone || '') + '</div>'
      + '<div class="logistics-meta">' + escapeHtml(record.reason || '') + (record.decision_reason ? ' · Decision: ' + escapeHtml(record.decision_reason) : '') + '</div>'
      + '<button type="button" class="btn-secondary workforce-record-history-button" data-entity="leave-requests" data-record-id="' + escapeAttr(record.id) + '">View history</button><div class="workforce-record-history" hidden></div></div>'
      + '<div class="workforce-member-controls">' + actions.join('') + '</div></article>';
  }).join('');
  section.querySelector('#workforceLeaveRequests').innerHTML = leaveRows || '<p class="logistics-meta">No leave requests recorded.</p>';

  const absenceRows = absences.map(record => {
    const state = String(record.status || 'UNKNOWN').toUpperCase();
    const member = members.find(item => String(item.id) === String(record.member_id));
    const voidForm = manager && state === 'RECORDED'
      ? '<form class="workforce-absence-void-form" data-record-id="' + escapeAttr(record.id) + '" data-version="' + Number(record.version || 1) + '"><label>Correction reason<input name="reason" maxlength="500" required></label><button type="submit" class="btn-secondary">Void record</button></form>' : '';
    return '<article class="workforce-record-row workforce-absence-row"><div><strong>' + escapeHtml(member?.display_name || 'Workforce member') + '</strong><span class="logistics-status">' + escapeHtml(state) + '</span>'
      + '<div class="logistics-meta">' + escapeHtml(String(record.absence_type || 'Absence').replaceAll('_',' ')) + ' · ' + escapeHtml(dateLabel(record.starts_at)) + ' – ' + escapeHtml(dateLabel(record.ends_at)) + ' · ' + escapeHtml(record.timezone || '') + '</div>'
      + '<div class="logistics-meta">' + escapeHtml(record.reason || '') + '</div>'
      + '<button type="button" class="btn-secondary workforce-record-history-button" data-entity="absences" data-record-id="' + escapeAttr(record.id) + '">View history</button><div class="workforce-record-history" hidden></div></div>'
      + '<div class="workforce-member-controls">' + voidForm + '</div></article>';
  }).join('');
  section.querySelector('#workforceAbsences').innerHTML = absenceRows || '<p class="logistics-meta">No unplanned absences recorded.</p>';
}

async function saveLeaveRequest(form, root) {
  const status = form.querySelector('.workforce-form-status');
  const values = new FormData(form);
  const workspace = root.querySelector('#workforceWorkspace');
  const members = workspaceData.get(workspace)?.members || [];
  const memberId = String(values.get('member_id') || members[0]?.id || '').trim();
  const startsAt = new Date(String(values.get('starts_at') || ''));
  const endsAt = new Date(String(values.get('ends_at') || ''));
  const reason = String(values.get('reason') || '').trim();
  if (!memberId || !Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())
    || startsAt >= endsAt || !reason || reason.length > 1000) {
    status.textContent = 'Choose a professional, valid start and end, and provide a reason.'; return;
  }
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true; status.textContent = 'Submitting leave request…';
  try {
    const created = await request(endpoint('leave-requests'), {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'workforce-ui-' + crypto.randomUUID() },
      body: JSON.stringify({ member_id: memberId, leave_category: String(values.get('leave_category') || 'OTHER'),
        starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), timezone,
        all_day: values.get('all_day') === 'on', reason }),
    });
    const record = created.record;
    if (!record?.id || !Number.isInteger(Number(record.version))) throw new Error('Leave request response was incomplete.');
    await request(endpoint('leave-requests', '/' + encodeURIComponent(record.id) + '/submit'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expected_version: Number(record.version) }),
    });
    form.reset();
    await refreshWorkspaceWithStatus(root, '#workforceLeaveAbsenceAdmin', 'Leave request submitted.');
  } catch (error) { status.textContent = error.message || 'Leave request could not be submitted.'; }
  finally { submit.disabled = false; }
}

async function saveAbsence(form, root) {
  const status = form.querySelector('.workforce-form-status');
  const values = new FormData(form);
  const memberId = String(values.get('member_id') || '').trim();
  const startsAt = new Date(String(values.get('starts_at') || ''));
  const endsAt = new Date(String(values.get('ends_at') || ''));
  const reason = String(values.get('reason') || '').trim();
  if (!memberId || !Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())
    || startsAt >= endsAt || !reason || reason.length > 1000) {
    status.textContent = 'Choose a professional, valid start and end, and provide a reason.'; return;
  }
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true; status.textContent = 'Recording absence…';
  try {
    await request(endpoint('absences'), {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'workforce-ui-' + crypto.randomUUID() },
      body: JSON.stringify({ member_id: memberId, absence_type: String(values.get('absence_type') || 'OTHER'),
        starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), timezone,
        all_day: values.get('all_day') === 'on', reason }),
    });
    form.reset();
    await refreshWorkspaceWithStatus(root, '#workforceLeaveAbsenceAdmin', 'Unplanned absence recorded.');
  } catch (error) { status.textContent = error.message || 'Absence could not be recorded.'; }
  finally { submit.disabled = false; }
}

async function submitLeaveAction(form, root) {
  const action = form.dataset.action, recordId = form.dataset.recordId, version = Number(form.dataset.version);
  if (!recordId || !['submit','approve','reject','withdraw','cancel'].includes(action) || !Number.isInteger(version) || version < 1) return;
  const values = new FormData(form);
  const payload = { expected_version: version };
  const reason = String(values.get('reason') || '').trim();
  const decisionReason = String(values.get('decision_reason') || '').trim();
  if (action === 'reject' && !decisionReason) {
    form.querySelector('[name="decision_reason"]')?.focus(); return;
  }
  if (action === 'cancel' && !reason) { form.querySelector('[name="reason"]')?.focus(); return; }
  if (reason) payload.reason = reason;
  if (decisionReason) payload.decision_reason = decisionReason;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await request(endpoint('leave-requests', '/' + encodeURIComponent(recordId) + '/' + action), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const actionLabel = ({ submit: 'submitted', approve: 'approved', reject: 'rejected', withdraw: 'withdrawn', cancel: 'cancelled' })[action];
    await refreshWorkspaceWithStatus(root, '#workforceLeaveAbsenceAdmin', 'Leave request ' + actionLabel + '.');
  } catch (error) {
    const status = root.querySelector('#workforceStatus');
    if (status) status.textContent = error.message || 'Leave request action failed.';
    submit.disabled = false;
  }
}

async function voidAbsence(form, root) {
  const recordId = form.dataset.recordId, version = Number(form.dataset.version);
  const reason = String(new FormData(form).get('reason') || '').trim();
  if (!recordId || !reason || reason.length > 500 || !Number.isInteger(version) || version < 1) return;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await request(endpoint('absences', '/' + encodeURIComponent(recordId) + '/void'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expected_version: version, reason }),
    });
    await refreshWorkspaceWithStatus(root, '#workforceLeaveAbsenceAdmin', 'Absence record voided.');
  } catch (error) {
    const status = root.querySelector('#workforceStatus');
    if (status) status.textContent = error.message || 'Absence record could not be voided.';
    submit.disabled = false;
  }
}

async function loadWorkforceRecordHistory(button) {
  const entity = button.dataset.entity, recordId = button.dataset.recordId;
  const host = button.parentElement?.querySelector('.workforce-record-history');
  if (!['leave-requests','absences','scheduling-policies'].includes(entity) || !recordId || !host) return;
  if (!host.hidden) { host.hidden = true; return; }
  host.hidden = false; host.innerHTML = '<p class="logistics-meta">Loading history…</p>';
  try {
    const data = await request(endpoint(entity, '/' + encodeURIComponent(recordId) + '/history'));
    const rows = (Array.isArray(data.records) ? data.records : []).map(event =>
      '<li><strong>' + escapeHtml(String(event.action || '').split('.').pop().replaceAll('_',' ')) + '</strong>'
      + '<span class="logistics-meta"> · ' + escapeHtml(dateLabel(event.created_at))
      + (event.metadata?.reason ? ' · ' + escapeHtml(event.metadata.reason) : '')
      + (event.metadata?.decision_reason ? ' · ' + escapeHtml(event.metadata.decision_reason) : '') + '</span></li>'
    ).join('');
    host.innerHTML = rows ? '<ul>' + rows + '</ul>' : '<p class="logistics-meta">No history is available.</p>';
  } catch (error) { host.innerHTML = '<p class="logistics-meta">' + escapeHtml(error.message || 'History could not be loaded.') + '</p>'; }
}

function renderSchedulingPolicyAdmin(workspace, policies) {
  const section = workspace.querySelector('#workforceSchedulingPolicyAdmin');
  if (!section) return;
  const manager = canManageMembers();
  section.hidden = !manager;
  if (!manager) return;
  const rows = policies.map(policy => {
    const rules = policy.rules || {};
    const summary = Object.entries(rules).filter(([key]) => key !== 'enforcement')
      .map(([key,value]) => key === 'required_qualifications' ? 'Qualifications: ' + (Array.isArray(value) ? value.join(', ') : '')
        : key === 'location_policy' ? 'Location: ' + value
        : key.replaceAll('_',' ') + ': ' + value).join(' · ');
    const state = String(policy.status || 'DRAFT').toUpperCase();
    const action = state === 'ACTIVE' ? 'deactivate' : 'activate';
    const actionLabel = state === 'ACTIVE' ? 'Deactivate policy' : 'Activate policy';
    return '<article class="workforce-record-row workforce-scheduling-policy-row"><div><strong>' + escapeHtml(policy.name || 'Scheduling policy') + '</strong>'
      + '<span class="logistics-status">' + escapeHtml(state) + '</span>'
      + '<div class="logistics-meta">Policy version ' + Number(policy.version || 1) + ' · Effective ' + escapeHtml(policy.effective_from || '')
      + (policy.effective_until ? ' to ' + escapeHtml(policy.effective_until) : ' onward') + '</div>'
      + '<div class="logistics-meta">' + escapeHtml(summary || 'No additional constraints configured') + '</div>'
      + '<button type="button" class="btn-secondary workforce-scheduling-policy-edit" data-policy-id="' + escapeAttr(policy.id) + '">Edit policy</button>'
      + '<button type="button" class="btn-secondary workforce-record-history-button" data-entity="scheduling-policies" data-record-id="' + escapeAttr(policy.id) + '">View history</button>'
      + '<div class="workforce-record-history" hidden></div></div>'
      + '<div class="workforce-member-controls"><form class="workforce-scheduling-policy-action-form" data-record-id="' + escapeAttr(policy.id) + '" data-action="' + action + '" data-version="' + Number(policy.version || 1) + '">'
      + '<button type="submit" class="btn-secondary">' + actionLabel + '</button></form></div></article>';
  }).join('');
  section.querySelector('#workforceSchedulingPolicies').innerHTML = rows || '<p class="logistics-meta">No scheduling policy configured. Create a draft policy to define organization rules.</p>';
}

function editSchedulingPolicy(button, root) {
  const workspace = root.querySelector('#workforceWorkspace');
  const form = workspace?.querySelector('#workforceSchedulingPolicyForm');
  const policy = workspaceData.get(workspace)?.schedulingPolicies?.find(item => String(item.id) === String(button.dataset.policyId));
  if (!form || !policy) return;
  const rules = policy.rules || {};
  form.dataset.policyId = String(policy.id);
  form.dataset.version = String(policy.version);
  form.elements.name.value = policy.name || '';
  form.elements.effective_from.value = policy.effective_from || '';
  form.elements.effective_until.value = policy.effective_until || '';
  for (const field of ['max_shift_minutes','max_daily_minutes','max_weekly_minutes','minimum_rest_minutes',
    'minimum_break_after_minutes','minimum_break_duration_minutes','max_consecutive_days']) {
    form.elements[field].value = rules[field] ?? '';
  }
  form.elements.required_qualifications.value = Array.isArray(rules.required_qualifications) ? rules.required_qualifications.join(', ') : '';
  form.elements.location_policy.value = rules.location_policy || 'ANY';
  form.elements.max_daily_enforcement.value = rules.enforcement?.max_daily_minutes || 'BLOCK';
  form.elements.allow_overrides.checked = rules.allow_overrides === true;
  form.elements.allow_unknown_overrides.checked = rules.allow_unknown_overrides === true;
  form.querySelector('#workforceSchedulingPolicyFormTitle').textContent = 'Edit ' + policy.name + ' · version ' + policy.version;
  form.querySelector('.workforce-form-status').textContent = 'Editing the selected policy. Saving creates the next policy version.';
  form.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

async function saveSchedulingPolicy(form, root) {
  const status = form.querySelector('.workforce-form-status');
  const values = new FormData(form);
  const rules = {};
  for (const field of ['max_shift_minutes','max_daily_minutes','max_weekly_minutes','minimum_rest_minutes',
    'minimum_break_after_minutes','minimum_break_duration_minutes','max_consecutive_days']) {
    const value = String(values.get(field) || '').trim();
    if (value) rules[field] = Number(value);
  }
  const qualifications = String(values.get('required_qualifications') || '').split(',').map(value => value.trim()).filter(Boolean);
  if (qualifications.length) rules.required_qualifications = qualifications;
  const locationPolicy = String(values.get('location_policy') || 'ANY');
  if (locationPolicy !== 'ANY') rules.location_policy = locationPolicy;
  if (rules.max_daily_minutes !== undefined) rules.enforcement = { max_daily_minutes: String(values.get('max_daily_enforcement') || 'BLOCK') };
  rules.allow_overrides = values.get('allow_overrides') === 'on';
  rules.allow_unknown_overrides = values.get('allow_unknown_overrides') === 'on';
  const body = {
    name: String(values.get('name') || '').trim(),
    effective_from: String(values.get('effective_from') || ''),
    effective_until: String(values.get('effective_until') || '') || null,
    rules,
  };
  if (!body.name || !body.effective_from) {
    status.textContent = 'Provide a policy name and effective-from date.'; return;
  }
  const policyId = form.dataset.policyId || '';
  if (policyId) {
    const version = Number(form.dataset.version);
    if (!Number.isInteger(version) || version < 1) { status.textContent = 'Reload the policy before editing it.'; return; }
    body.expected_version = version;
  }
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true; status.textContent = 'Saving scheduling policy…';
  try {
    const result = await request(policyId ? endpoint('scheduling-policies', '/' + encodeURIComponent(policyId)) : endpoint('scheduling-policies'), {
      method: policyId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(policyId ? {} : { 'Idempotency-Key': 'workforce-ui-' + crypto.randomUUID() }) },
      body: JSON.stringify(body),
    });
    form.reset(); delete form.dataset.policyId; delete form.dataset.version;
    form.querySelector('#workforceSchedulingPolicyFormTitle').textContent = 'Create scheduling policy';
    await refreshWorkspaceWithStatus(root, '#workforceSchedulingPolicyAdmin', policyId ? 'Scheduling policy version saved.' : 'Scheduling policy created as a draft.');
  } catch (error) { status.textContent = error.message || 'Scheduling policy could not be saved.'; }
  finally { submit.disabled = false; }
}

async function schedulingPolicyAction(form, root) {
  const action = form.dataset.action, id = form.dataset.recordId, version = Number(form.dataset.version);
  if (!['activate','deactivate'].includes(action) || !id || !Number.isInteger(version) || version < 1) return;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await request(endpoint('scheduling-policies', '/' + encodeURIComponent(id) + '/' + action), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expected_version: version }),
    });
    await refreshWorkspaceWithStatus(root, '#workforceSchedulingPolicyAdmin', action === 'activate'
      ? 'Scheduling policy activated.' : 'Scheduling policy deactivated.');
  } catch (error) {
    const status = root.querySelector('#workforceStatus');
    if (status) status.textContent = error.message || 'Scheduling policy action failed.';
    submit.disabled = false;
  }
}

async function refreshWorkspace(root) {
  const workspace = root.querySelector('#workforceWorkspace');
  if (!workspace) return;
  const status = workspace.querySelector('#workforceStatus');
  const membersNode = workspace.querySelector('#workforceMembers');
  const summaryNode = workspace.querySelector('#workforceSummary');
  if (!config.chatId || !config.sessionToken) {
    status.textContent = 'Sign in to a business to view Workforce.';
    status.dataset.state = 'DENIED';
    membersNode.replaceChildren(); summaryNode.replaceChildren(); return;
  }
  const seq = Number(workspace.dataset.refreshSequence || 0) + 1;
  workspace.dataset.refreshSequence = String(seq);
  const tenantId = String(config.chatId), token = String(config.sessionToken);
  status.textContent = 'Loading Workforce records…'; status.dataset.state = 'LOADING';
  try {
    const [membersData, summaryData, departments, positions, engagements, locations, shiftTemplates, shifts, leaveRequests, absences, schedulingPolicies] = await Promise.all([
      request(endpoint('members') + '?limit=100'),
      request(endpoint('utilization', '/summary')),
      optionalRecords('departments'), optionalRecords('positions'), optionalRecords('engagements'),
      optionalOrganizationLocations(), optionalRecords('shift-templates'), optionalRecords('shifts'),
      optionalRecords('leave-requests'), optionalRecords('absences'), optionalRecords('scheduling-policies'),
    ]);
    if (!workspace.isConnected || workspace.dataset.refreshSequence !== String(seq)
      || String(config.chatId) !== tenantId || String(config.sessionToken) !== token) return;
    const members = Array.isArray(membersData.records) ? membersData.records : [];
    workspaceData.set(workspace, { members, departments, positions, engagements, locations, shiftTemplates, shifts, leaveRequests, absences, schedulingPolicies });
    workspace.querySelector('#workforceOverviewMetrics').innerHTML =
      renderOverviewMetrics(members, departments, positions, engagements);
    summaryNode.innerHTML = renderSummary(summaryData.summary || {});
    renderMemberDirectory(root);
    renderOrganizationAdmin(workspace, departments, positions);
    renderShiftTemplateAdmin(workspace, shiftTemplates, departments, positions, locations, members);
    renderDatedShiftAdmin(workspace, shifts, members);
    renderLeaveAbsenceAdmin(workspace, leaveRequests, absences, members);
    renderSchedulingPolicyAdmin(workspace, schedulingPolicies);
    status.textContent = members.length + ' Workforce member' + (members.length === 1 ? '' : 's') + ' loaded.';
    status.dataset.state = 'READY';
    const selected = workspace.dataset.selectedMemberId;
    if (selected && members.some(member => String(member.id) === selected)) {
      await refreshMember(root, selected, members.find(member => String(member.id) === selected));
    } else if (selected) {
      workspace.dataset.selectedMemberId = ''; workspace.querySelector('#workforceMemberDetails').hidden = true;
    }
  } catch (error) {
    if (workspace.dataset.refreshSequence !== String(seq) || String(config.chatId) !== tenantId
      || String(config.sessionToken) !== token) return;
    status.textContent = error.status === 403 ? 'Your current role does not have Workforce access.'
      : error.message || 'Workforce could not be loaded.';
    status.dataset.state = error.status === 403 ? 'DENIED' : 'ERROR';
    membersNode.replaceChildren(); summaryNode.replaceChildren();
  }
}
async function refreshWorkspaceWithStatus(root, formSelector, message) {
  await refreshWorkspace(root);
  const status = root.querySelector(formSelector + ' .workforce-form-status');
  if (status) status.textContent = message;
}

async function refreshMember(root, memberId, member = null) {
  const workspace = root.querySelector('#workforceWorkspace');
  const details = workspace?.querySelector('#workforceMemberDetails');
  const recordsNode = workspace?.querySelector('#workforceMemberRecords');
  const profileNode = workspace?.querySelector('#workforceMemberProfile');
  if (!workspace || !details || !recordsNode || !profileNode) return;
  member = member || workspaceData.get(workspace)?.members.find(item => String(item.id) === String(memberId)) || null;
  profileNode.innerHTML = member ? renderMemberProfile(workspace, member) : '';
  const memberProfileForm = profileNode.querySelector('#workforceMemberProfileForm');
  memberProfileForm?.addEventListener('submit', event => { event.preventDefault(); saveMemberProfile(memberProfileForm, root); });
  const accountLinkForm = profileNode.querySelector('#workforceAccountLinkForm');
  accountLinkForm?.addEventListener('submit', event => { event.preventDefault(); linkMemberAccount(accountLinkForm, root); });
  const unlinkAccountButton = profileNode.querySelector('#workforceUnlinkAccount');
  unlinkAccountButton?.addEventListener('click', () => unlinkMemberAccount(unlinkAccountButton, root));
  const seq = Number(workspace.dataset.detailSequence || 0) + 1;
  workspace.dataset.detailSequence = String(seq);
  const tenantId = String(config.chatId), token = String(config.sessionToken);
  details.hidden = false;
  workspace.querySelector('#workforceSelectedMemberTitle').textContent = member?.display_name || member?.user_id || 'Member workspace';
  recordsNode.innerHTML = '<p class="logistics-meta">Loading member records…</p>';
  const results = await Promise.all(SECTIONS.map(async ([entity, title]) => {
    try {
      const data = await request(endpoint(entity) + '?member_id=' + encodeURIComponent(memberId) + '&limit=50');
      return { title, records: Array.isArray(data.records) ? data.records : [], error: null };
    } catch (error) { return { title, records: [], error }; }
  }));
  if (!workspace.isConnected || workspace.dataset.detailSequence !== String(seq)
    || String(config.chatId) !== tenantId || String(config.sessionToken) !== token) return;
  recordsNode.innerHTML = results.map(result => result.error
    ? '<section class="workforce-data-section"><h4>' + escapeHtml(result.title) + '</h4><p class="logistics-meta">Not available: '
      + escapeHtml(result.error.message) + '</p></section>'
    : result.title === 'Profiles' ? renderProfileRecords(result.records)
      : result.title === 'Engagements' ? renderEngagementRecords(result.records)
        : result.title === 'Assignments' ? renderAssignmentRecords(workspace, result.records) : renderRecords(result.title, result.records)).join('');
  const profileForm = workspace.querySelector('#workforceProfileForm');
  const profileRecords = results.find(result => result.title === 'Profiles' && !result.error)?.records || [];
  const selectedProfile = [...profileRecords].sort((a, b) => String(b.effective_from || '').localeCompare(String(a.effective_from || '')))[0] || null;
  profileForm.dataset.memberId = memberId;
  profileForm.dataset.profileId = selectedProfile?.id || '';
  profileForm.dataset.version = String(selectedProfile?.version || 1);
  profileForm.hidden = !canManageMembers();
  for (const field of ['skills','qualifications','languages','service_capabilities']) {
    profileForm.elements[field].value = Array.isArray(selectedProfile?.[field]) ? selectedProfile[field].join(', ') : '';
  }
  profileForm.elements.visibility.value = selectedProfile?.visibility || 'ORGANIZATION';
  profileForm.elements.effective_from.value = String(selectedProfile?.effective_from || new Date().toISOString()).slice(0, 10);
  profileForm.elements.effective_until.value = selectedProfile?.effective_until ? String(selectedProfile.effective_until).slice(0, 10) : '';
  profileForm.elements.notes.value = selectedProfile?.notes || '';
  const engagementForm = workspace.querySelector('#workforceEngagementForm');
  engagementForm.dataset.memberId = memberId;
  engagementForm.hidden = !canManageMembers();
  const assignmentForm = workspace.querySelector('#workforceLocationAssignmentForm');
  assignmentForm.dataset.memberId = memberId;
  assignmentForm.hidden = !canManageMembers();
  fillSelect(assignmentForm.elements.location_id, workspaceData.get(workspace)?.locations || [], '', 'name');
  const form = workspace.querySelector('#workforceAvailabilityForm');
  form.dataset.memberId = memberId;
  form.hidden = !canManageMembers();
  const assessmentForm = workspace.querySelector('#workforceAvailabilityAssessmentForm');
  assessmentForm.dataset.memberId = memberId;
  assessmentForm.dataset.locationId = member?.primary_location_id || '';
  const localInputValue = date => {
    const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return adjusted.toISOString().slice(0, 16);
  };
  const assessmentStart = new Date();
  assessmentForm.elements.starts_at.value = localInputValue(assessmentStart);
  assessmentForm.elements.ends_at.value = localInputValue(new Date(assessmentStart.getTime() + 60 * 60000));
  assessmentForm.elements.timezone.value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  assessmentForm.querySelector('#workforceAvailabilityAssessmentResult').innerHTML = '';
}

function renderMemberProfile(workspace, member) {
  const data = workspaceData.get(workspace) || { members: [], departments: [], positions: [], locations: [] };
  const supervisors = data.members.filter(item => item.status === 'ACTIVE' && String(item.id) !== String(member.id));
  const department = data.departments.find(item => String(item.id) === String(member.department_id));
  const position = data.positions.find(item => String(item.id) === String(member.position_id));
  const supervisor = data.members.find(item => String(item.id) === String(member.supervisor_member_id));
  const account = member.user_id
    ? '<div class="workforce-account-status"><span class="logistics-status logistics-status-active">Sellify account linked</span>'
      + '<p class="logistics-meta">The linked account must retain an active tenant membership. Workforce does not manage its authentication.</p>'
      + '<button type="button" class="btn-secondary" id="workforceUnlinkAccount" data-member-id="' + escapeAttr(member.id)
      + '" data-version="' + Number(member.version || 1) + '">Unlink account</button></div>'
    : '<form id="workforceAccountLinkForm" class="settings-form workforce-admin-form" data-member-id="' + escapeAttr(member.id)
      + '" data-version="' + Number(member.version || 1) + '"><h4>Link an existing Sellify account</h4>'
      + '<label>Existing account user ID<input name="user_id" autocomplete="off" required></label>'
      + '<p class="logistics-meta">This links an existing user with active membership in this tenant. It does not create a user or grant membership.</p>'
      + '<button type="submit" class="btn-primary">Link existing account</button><p class="logistics-meta workforce-form-status" role="status"></p></form>';
  const editor = canManageMembers()
    ? '<form id="workforceMemberProfileForm" class="settings-form workforce-admin-form" data-member-id="' + escapeAttr(member.id)
      + '" data-version="' + Number(member.version || 1) + '"><h4>Professional profile and assignments</h4>'
      + '<label>Display name<input name="display_name" maxlength="120" required value="' + escapeAttr(member.display_name || '') + '"></label>'
      + '<label>Employee number<input name="employee_number" maxlength="80" value="' + escapeAttr(member.employee_number || '') + '"></label>'
      + '<label>Primary location<select name="primary_location_id"><option value="">No primary location</option>' + data.locations.map(item => '<option value="' + escapeAttr(item.id) + '"'
        + (String(item.id) === String(member.primary_location_id || '') ? ' selected' : '') + '>' + escapeHtml(item.name || item.code || item.id) + '</option>').join('') + '</select></label>'
      + '<label>Department<select name="department_id"><option value="">Unassigned</option>' + data.departments.map(item => '<option value="' + escapeAttr(item.id) + '"'
        + (String(item.id) === String(member.department_id || '') ? ' selected' : '') + '>' + escapeHtml(item.name) + '</option>').join('') + '</select></label>'
      + '<label>Position<select name="position_id"><option value="">Unassigned</option>' + data.positions.map(item => '<option value="' + escapeAttr(item.id) + '"'
        + (String(item.id) === String(member.position_id || '') ? ' selected' : '') + '>' + escapeHtml(item.name) + '</option>').join('') + '</select></label>'
      + '<label>Supervisor<select name="supervisor_member_id"><option value="">No supervisor</option>' + supervisors.map(item => '<option value="' + escapeAttr(item.id) + '"'
        + (String(item.id) === String(member.supervisor_member_id || '') ? ' selected' : '') + '>' + escapeHtml(item.display_name || item.id) + '</option>').join('') + '</select></label>'
      + '<button type="submit" class="btn-primary">Save profile and assignments</button><p class="logistics-meta workforce-form-status" role="status"></p></form>'
    : '<p class="logistics-meta">Profile and reporting changes require Workforce management permission.</p>';
  return '<section class="workforce-profile-summary"><h4>Professional profile</h4><div class="workforce-profile-grid">'
    + '<div><span class="logistics-meta">Type</span><strong>' + escapeHtml(member.member_type || '—') + '</strong></div>'
    + '<div><span class="logistics-meta">Status</span><strong>' + escapeHtml(member.status || '—') + '</strong></div>'
    + '<div><span class="logistics-meta">Department</span><strong>' + escapeHtml(department?.name || 'Unassigned') + '</strong></div>'
    + '<div><span class="logistics-meta">Position</span><strong>' + escapeHtml(position?.name || 'Unassigned') + '</strong></div>'
    + '<div><span class="logistics-meta">Supervisor</span><strong>' + escapeHtml(supervisor?.display_name || 'Unassigned') + '</strong></div>'
    + '<div><span class="logistics-meta">Employee number</span><strong>' + escapeHtml(member.employee_number || 'Not assigned') + '</strong></div>'
    + '<div><span class="logistics-meta">Primary location</span><strong>' + escapeHtml(data.locations.find(item => String(item.id) === String(member.primary_location_id || ''))?.name || 'Unassigned') + '</strong></div>'
    + '</div>' + editor + account + '</section>';
}

async function saveMemberProfile(form, root) {
  const status = form.querySelector('.workforce-form-status');
  const values = new FormData(form);
  const memberId = form.dataset.memberId;
  const payload = { expected_version: Number(form.dataset.version), display_name: String(values.get('display_name') || '').trim() };
  for (const field of ['employee_number','primary_location_id','department_id','position_id','supervisor_member_id']) {
    const value = String(values.get(field) || '').trim();
    payload[field] = value || null;
  }
  const workspace = root.querySelector('#workforceWorkspace');
  const position = workspaceData.get(workspace)?.positions.find(item => String(item.id) === String(payload.position_id || ''));
  if (position?.department_id) {
    if (payload.department_id && payload.department_id !== position.department_id) {
      status.textContent = 'Choose a position from the selected department.'; return;
    }
    payload.department_id = position.department_id;
  }
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true; status.textContent = 'Saving professional profile…';
  try {
    await request(endpoint('members', '/' + encodeURIComponent(memberId)), {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    await refreshWorkspaceWithStatus(root, '#workforceMemberProfileForm', 'Profile and assignments saved.');
  } catch (error) { status.textContent = error.message || 'Profile could not be saved.'; }
  finally { submit.disabled = false; }
}

async function linkMemberAccount(form, root) {
  const status = form.querySelector('.workforce-form-status');
  const values = new FormData(form);
  const memberId = form.dataset.memberId;
  const payload = { expected_version: Number(form.dataset.version), user_id: String(values.get('user_id') || '').trim() };
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true; status.textContent = 'Checking existing account membership…';
  try {
    await request(endpoint('members', '/' + encodeURIComponent(memberId) + '/link-account'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    await refreshWorkspaceWithStatus(root, '#workforceAccountLinkForm', 'Existing account linked.');
  } catch (error) { status.textContent = error.message || 'Account could not be linked.'; }
  finally { submit.disabled = false; }
}

async function unlinkMemberAccount(button, root) {
  const memberId = button.dataset.memberId, version = Number(button.dataset.version);
  if (!memberId || !Number.isInteger(version)) return;
  button.disabled = true;
  try {
    await request(endpoint('members', '/' + encodeURIComponent(memberId) + '/unlink-account'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expected_version: version }),
    });
    await refreshWorkspace(root);
  } catch (error) {
    const status = root.querySelector('#workforceStatus');
    if (status) status.textContent = error.message || 'Account could not be unlinked.';
    button.disabled = false;
  }
}

async function memberAction(button, root) {
  const memberId = button.dataset.memberId, action = button.dataset.action;
  const version = Number(button.dataset.version);
  if (!memberId || !['activate','suspend','deactivate'].includes(action) || !Number.isInteger(version)) return;
  button.disabled = true;
  try {
    await request(endpoint('members', '/' + encodeURIComponent(memberId) + '/' + action), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expected_version: version }),
    });
    await refreshWorkspace(root);
  } catch (error) {
    const status = root.querySelector('#workforceStatus');
    if (status) status.textContent = error.message || 'Member status could not be changed.';
    button.disabled = false;
  }
}

async function saveMemberCreate(form, root) {
  const status = form.querySelector('.workforce-form-status');
  const values = new FormData(form);
  const payload = {
    member_type: String(values.get('member_type') || ''),
    display_name: String(values.get('display_name') || '').trim(),
  };
  for (const field of ['employee_number','primary_location_id','department_id','position_id','supervisor_member_id']) {
    const value = String(values.get(field) || '').trim();
    if (value) payload[field] = value;
  }
  const workspace = root.querySelector('#workforceWorkspace');
  const data = workspaceData.get(workspace) || { positions: [] };
  const selectedPosition = data.positions.find(item => String(item.id) === String(payload.position_id || ''));
  if (selectedPosition?.department_id) {
    if (payload.department_id && payload.department_id !== selectedPosition.department_id) {
      status.textContent = 'Choose a position from the selected department.'; return;
    }
    payload.department_id = selectedPosition.department_id;
  }
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true; status.textContent = 'Creating professional record…';
  try {
    await request(endpoint('members'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'workforce-ui-' + crypto.randomUUID() },
      body: JSON.stringify(payload),
    });
    form.reset();
    await refreshWorkspaceWithStatus(root, '#workforceMemberCreateForm', 'Professional record created. No Sellify login was created.');
  } catch (error) { status.textContent = error.message || 'Professional record could not be created.'; }
  finally { submit.disabled = false; }
}

async function saveDepartment(form, root) {
  const status = form.querySelector('.workforce-form-status');
  const values = new FormData(form);
  const payload = { code: String(values.get('code') || '').trim(), name: String(values.get('name') || '').trim(),
    description: String(values.get('description') || '').trim() };
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true; status.textContent = 'Creating department…';
  try {
    await request(endpoint('departments'), {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'workforce-ui-' + crypto.randomUUID() },
      body: JSON.stringify(payload),
    });
    form.reset(); await refreshWorkspaceWithStatus(root, '#workforceDepartmentForm', 'Department created.');
  } catch (error) { status.textContent = error.message || 'Department could not be created.'; }
  finally { submit.disabled = false; }
}

async function savePosition(form, root) {
  const status = form.querySelector('.workforce-form-status');
  const values = new FormData(form);
  const payload = { code: String(values.get('code') || '').trim(), name: String(values.get('name') || '').trim() };
  for (const field of ['department_id','classification']) {
    const value = String(values.get(field) || '').trim();
    if (value) payload[field] = value;
  }
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true; status.textContent = 'Creating position…';
  try {
    await request(endpoint('positions'), {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'workforce-ui-' + crypto.randomUUID() },
      body: JSON.stringify(payload),
    });
    form.reset(); await refreshWorkspaceWithStatus(root, '#workforcePositionForm', 'Position created.');
  } catch (error) { status.textContent = error.message || 'Position could not be created.'; }
  finally { submit.disabled = false; }
}

async function organizationAction(button, root) {
  const entity = button.dataset.entity, id = button.dataset.id, action = button.dataset.action;
  const version = Number(button.dataset.version);
  if (!['departments','positions','shift-templates'].includes(entity) || !id || !['activate','deactivate'].includes(action) || !Number.isInteger(version)) return;
  button.disabled = true;
  try {
    await request(endpoint(entity, '/' + encodeURIComponent(id) + '/' + action), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expected_version: version }),
    });
    await refreshWorkspace(root);
  } catch (error) {
    const status = root.querySelector('#workforceStatus');
    if (status) status.textContent = error.message || 'Workforce record status could not be changed.';
    button.disabled = false;
  }
}
async function saveLocationAssignment(form, root) {
  const status = form.querySelector('.workforce-form-status');
  const values = new FormData(form);
  const memberId = form.dataset.memberId;
  const locationId = String(values.get('location_id') || '').trim();
  const start = new Date(String(values.get('starts_at') || ''));
  const end = new Date(String(values.get('ends_at') || ''));
  if (!memberId || !locationId || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
    status.textContent = 'Choose a location and a valid start/end time range.'; return;
  }
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true; status.textContent = 'Creating location assignment…';
  try {
    await request(endpoint('assignments'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'workforce-ui-' + crypto.randomUUID() },
      body: JSON.stringify({
        member_id: memberId, assignment_type: 'LOCATION', location_id: locationId,
        starts_at: start.toISOString(), ends_at: end.toISOString(),
      }),
    });
    form.reset(); await refreshWorkspaceWithStatus(root, '#workforceLocationAssignmentForm', 'Location assignment created.');
  } catch (error) { status.textContent = error.message || 'Location assignment could not be created.'; }
  finally { submit.disabled = false; }
}

async function assignmentAction(button, root) {
  const id = button.dataset.assignmentId, action = button.dataset.action;
  const version = Number(button.dataset.version);
  if (!id || !['activate','suspend','end'].includes(action) || !Number.isInteger(version) || version < 1) return;
  button.disabled = true;
  try {
    await request(endpoint('assignments', '/' + encodeURIComponent(id) + '/' + action), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expected_version: version }),
    });
    await refreshWorkspace(root);
  } catch (error) {
    const status = root.querySelector('#workforceStatus');
    if (status) status.textContent = error.message || 'Location assignment could not be updated.';
    button.disabled = false;
  }
}

async function saveProfile(form, root) {
  const status = form.querySelector('.workforce-form-status');
  const values = new FormData(form);
  const memberId = form.dataset.memberId;
  if (!memberId) return;
  const payload = {
    skills: String(values.get('skills') || '').split(',').map(value => value.trim()).filter(Boolean),
    qualifications: String(values.get('qualifications') || '').split(',').map(value => value.trim()).filter(Boolean),
    languages: String(values.get('languages') || '').split(',').map(value => value.trim()).filter(Boolean),
    service_capabilities: String(values.get('service_capabilities') || '').split(',').map(value => value.trim()).filter(Boolean),
    visibility: String(values.get('visibility') || 'ORGANIZATION'),
    effective_from: String(values.get('effective_from') || '').trim(),
    notes: String(values.get('notes') || '').trim(),
  };
  const effectiveUntil = String(values.get('effective_until') || '').trim();
  if (effectiveUntil) payload.effective_until = effectiveUntil;
  if (!payload.effective_from || (effectiveUntil && effectiveUntil < payload.effective_from)) {
    status.textContent = 'Choose a valid effective date range.'; return;
  }
  const profileId = String(form.dataset.profileId || '');
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true; status.textContent = profileId ? 'Updating professional profile…' : 'Saving professional profile…';
  try {
    if (profileId) {
      payload.expected_version = Number(form.dataset.version);
      await request(endpoint('profiles', '/' + encodeURIComponent(profileId)), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
    } else {
      payload.member_id = memberId;
      await request(endpoint('profiles'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'workforce-ui-' + crypto.randomUUID() },
        body: JSON.stringify(payload),
      });
    }
    await refreshWorkspaceWithStatus(root, '#workforceProfileForm', 'Profile saved.');
  } catch (error) { status.textContent = error.message || 'Professional profile could not be saved.'; }
  finally { submit.disabled = false; }
}

async function saveShiftTemplate(form, root) {
  const status = form.querySelector('.workforce-form-status');
  const values = new FormData(form);
  const name = String(values.get('name') || '').trim();
  const start = String(values.get('start_local_time') || '');
  const end = String(values.get('end_local_time') || '');
  const timezone = String(values.get('timezone') || '').trim();
  const effectiveFrom = String(values.get('effective_from') || '');
  const effectiveUntil = String(values.get('effective_until') || '');
  const workDays = values.getAll('work_days').map(Number);
  const breakStart = String(values.get('break_start_local_time') || '');
  const breakEnd = String(values.get('break_end_local_time') || '');
  if (!name || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(end)
    || start === end || !timezone || !validLocalDate(effectiveFrom)
    || (effectiveUntil && effectiveUntil < effectiveFrom) || !workDays.length
    || ((breakStart || breakEnd) && (!breakStart || !breakEnd || breakStart === breakEnd))) {
    status.textContent = 'Complete the template name, valid local times, timezone, working days and effective dates. Provide both break times or neither.'; return;
  }
  const payload = {
    name, start_local_time: start, end_local_time: end, timezone,
    work_days: workDays, effective_from: effectiveFrom,
    break_rules: breakStart ? [{ start_local_time: breakStart, end_local_time: breakEnd }] : [],
  };
  if (effectiveUntil) payload.effective_until = effectiveUntil;
  for (const field of ['department_id','position_id','location_id']) {
    const value = String(values.get(field) || '').trim();
    if (value) payload[field] = value;
  }
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true; status.textContent = 'Creating shift template…';
  try {
    await request(endpoint('shift-templates'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'workforce-ui-' + crypto.randomUUID() },
      body: JSON.stringify(payload),
    });
    form.reset();
    form.querySelector('[name="timezone"]').value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    for (const day of form.querySelectorAll('[name="work_days"]')) day.checked = Number(day.value) <= 5;
    await refreshWorkspaceWithStatus(root, '#workforceShiftTemplateAdmin', 'Shift template created.');
  } catch (error) { status.textContent = error.message || 'Shift template could not be created.'; }
  finally { submit.disabled = false; }
}

async function generateTemplateShifts(form, root) {
  const status = form.querySelector('.workforce-form-status');
  const templateId = form.dataset.templateId;
  const expectedVersion = Number(form.dataset.templateVersion);
  const values = new FormData(form);
  const memberId = String(values.get('member_id') || '').trim();
  const fromDate = String(values.get('from_date') || '');
  const toDate = String(values.get('to_date') || '');
  const from = Date.parse(fromDate + 'T00:00:00Z');
  const to = Date.parse(toDate + 'T00:00:00Z');
  const dayCount = (to - from) / 86400000 + 1;
  if (!templateId || !memberId || !Number.isInteger(expectedVersion) || expectedVersion < 1
    || !validLocalDate(fromDate) || !validLocalDate(toDate)
    || !Number.isFinite(from) || !Number.isFinite(to) || dayCount < 1 || dayCount > 31) {
    status.textContent = 'Choose an active member and a valid ascending date range of no more than 31 days.'; return;
  }
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true; status.textContent = 'Generating dated shifts…';
  try {
    const result = await request(endpoint('shift-templates', '/' + encodeURIComponent(templateId) + '/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'workforce-ui-' + crypto.randomUUID() },
      body: JSON.stringify({ expected_version: expectedVersion, member_id: memberId, from_date: fromDate, to_date: toDate,
        override_reason: String(values.get('override_reason') || '').trim() || undefined }),
    });
    const message = 'Created ' + Number(result.created_count || 0) + ', already existed ' + Number(result.existing_count || 0)
      + ', conflicts ' + (Array.isArray(result.conflicts) ? result.conflicts.length : 0)
      + ', skipped ' + (Array.isArray(result.skipped) ? result.skipped.length : 0) + '.';
    await refreshWorkspace(root);
    const workspace = root.querySelector('#workforceWorkspace');
    const statusNode = workspace?.querySelector('#workforceStatus');
    if (statusNode) statusNode.textContent = message;
  } catch (error) { status.textContent = error.message || 'Dated shifts could not be generated.'; }
  finally { submit.disabled = false; }
}

async function transitionDatedShift(button, root) {
  const shiftId = button.dataset.shiftId, action = button.dataset.action, version = Number(button.dataset.version);
  if (!shiftId || !['confirm','start','complete'].includes(action) || !Number.isInteger(version) || version < 1) return;
  button.disabled = true;
  try {
    await request(endpoint('shifts', '/' + encodeURIComponent(shiftId) + '/' + action), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expected_version: version }),
    });
    await refreshWorkspace(root);
    const status = root.querySelector('#workforceStatus');
    if (status) status.textContent = 'Shift ' + action + ' recorded.';
  } catch (error) {
    const status = root.querySelector('#workforceStatus');
    if (status) status.textContent = error.message || 'Shift lifecycle action could not be completed.';
    button.disabled = false;
  }
}

async function reassignDatedShift(form, root) {
  const status = form.querySelector('.workforce-form-status');
  const values = new FormData(form);
  const shiftId = form.dataset.shiftId, version = Number(form.dataset.version);
  const memberId = String(values.get('member_id') || '').trim();
  const reason = String(values.get('reason') || '').trim();
  const overrideReason = String(values.get('override_reason') || '').trim();
  if (!shiftId || !memberId || !reason || reason.length > 500 || overrideReason.length > 500 || !Number.isInteger(version) || version < 1) {
    status.textContent = 'Choose an active professional and provide a reassignment reason.'; return;
  }
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true; status.textContent = 'Reassigning shift…';
  try {
    await request(endpoint('shifts', '/' + encodeURIComponent(shiftId) + '/reassign'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expected_version: version, member_id: memberId, reason,
        override_reason: overrideReason || undefined }),
    });
    await refreshWorkspace(root);
    const workspaceStatus = root.querySelector('#workforceStatus');
    if (workspaceStatus) workspaceStatus.textContent = 'Shift reassigned.';
  } catch (error) { status.textContent = error.message || 'Shift could not be reassigned.'; }
  finally { submit.disabled = false; }
}

async function cancelDatedShift(form, root) {
  const status = form.querySelector('.workforce-form-status');
  const shiftId = form.dataset.shiftId, version = Number(form.dataset.version);
  const reason = String(new FormData(form).get('reason') || '').trim();
  if (!shiftId || !reason || reason.length > 500 || !Number.isInteger(version) || version < 1) {
    status.textContent = 'Provide a cancellation reason of no more than 500 characters.'; return;
  }
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true; status.textContent = 'Cancelling shift…';
  try {
    await request(endpoint('shifts', '/' + encodeURIComponent(shiftId) + '/cancel'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expected_version: version, reason }),
    });
    await refreshWorkspace(root);
    const workspaceStatus = root.querySelector('#workforceStatus');
    if (workspaceStatus) workspaceStatus.textContent = 'Shift cancelled.';
  } catch (error) { status.textContent = error.message || 'Shift could not be cancelled.'; }
  finally { submit.disabled = false; }
}

async function loadDatedShiftHistory(button, root) {
  const shiftId = button.dataset.shiftId;
  const row = button.closest('.workforce-dated-shift-row');
  const host = row?.querySelector('.workforce-shift-history');
  if (!shiftId || !host) return;
  if (!host.hidden) { host.hidden = true; return; }
  host.hidden = false; host.innerHTML = '<p class="logistics-meta">Loading shift history…</p>';
  try {
    const data = await request(endpoint('shifts', '/' + encodeURIComponent(shiftId) + '/history'));
    const members = workspaceData.get(root.querySelector('#workforceWorkspace'))?.members || [];
    const rows = (Array.isArray(data.records) ? data.records : []).map(event => {
      const action = String(event.action || '').split('.').pop().replaceAll('_',' ');
      const from = members.find(member => String(member.id) === String(event.metadata?.from_member_id));
      const to = members.find(member => String(member.id) === String(event.metadata?.to_member_id));
      const reassignment = event.metadata?.from_member_id
        ? ' · ' + escapeHtml(from?.display_name || event.metadata.from_member_id) + ' → ' + escapeHtml(to?.display_name || event.metadata.to_member_id) : '';
      const reason = event.metadata?.reason ? ' · ' + escapeHtml(event.metadata.reason) : '';
      return '<li><strong>' + escapeHtml(action) + '</strong><span class="logistics-meta"> · '
        + escapeHtml(dateLabel(event.created_at)) + reassignment + reason + '</span></li>';
    }).join('');
    host.innerHTML = rows ? '<ul>' + rows + '</ul>' : '<p class="logistics-meta">No shift history is available.</p>';
  } catch (error) { host.innerHTML = '<p class="logistics-meta">' + escapeHtml(error.message || 'Shift history could not be loaded.') + '</p>'; }
}

async function saveEngagement(form, root) {
  const status = form.querySelector('.workforce-form-status');
  const values = new FormData(form);
  const memberId = form.dataset.memberId;
  const start = new Date(String(values.get('starts_at') || ''));
  const endValue = String(values.get('ends_at') || '').trim();
  const end = endValue ? new Date(endValue) : null;
  if (!memberId || !Number.isFinite(start.getTime()) || (end && (!Number.isFinite(end.getTime()) || start >= end))) {
    status.textContent = 'Choose a valid start and, if supplied, an end time after the start.'; return;
  }
  const payload = {
    member_id: memberId,
    engagement_type: String(values.get('engagement_type') || ''),
    starts_at: start.toISOString(),
  };
  if (end) payload.ends_at = end.toISOString();
  const terms = String(values.get('terms_reference') || '').trim();
  if (terms) payload.terms_reference = terms;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true; status.textContent = 'Creating engagement…';
  try {
    await request(endpoint('engagements'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'workforce-ui-' + crypto.randomUUID() },
      body: JSON.stringify(payload),
    });
    form.reset(); await refreshWorkspaceWithStatus(root, '#workforceEngagementForm', 'Engagement recorded.');
  } catch (error) { status.textContent = error.message || 'Engagement could not be created.'; }
  finally { submit.disabled = false; }
}

async function engagementAction(button, root) {
  const id = button.dataset.engagementId, action = button.dataset.action;
  const version = Number(button.dataset.version);
  if (!id || !['submit','activate','suspend','end'].includes(action) || !Number.isInteger(version) || version < 1) return;
  button.disabled = true;
  try {
    await request(endpoint('engagements', '/' + encodeURIComponent(id) + '/' + action), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expected_version: version }),
    });
    await refreshWorkspace(root);
  } catch (error) {
    const status = root.querySelector('#workforceStatus');
    if (status) status.textContent = error.message || 'Engagement could not be updated.';
    button.disabled = false;
  }
}

function renderAvailabilityAssessment(assessment) {
  if (!assessment || typeof assessment !== 'object') return '<p class="logistics-meta">The server returned no availability assessment.</p>';
  const state = String(assessment.state || 'UNKNOWN').toUpperCase();
  const sources = Array.isArray(assessment.source_versions) ? assessment.source_versions : [];
  const findings = Array.isArray(assessment.findings) ? assessment.findings : [];
  return '<section class="logistics-card workforce-assessment-result"><div class="logistics-top"><strong>Assessment: '
    + escapeHtml(state.replaceAll('_', ' ')) + '</strong><span class="logistics-status">' + escapeHtml(state) + '</span></div>'
    + '<p class="logistics-meta">Evaluated: ' + escapeHtml(dateLabel(assessment.evaluated_at)) + '</p>'
    + '<h5>Evidence sources</h5><ul>' + sources.map(item => '<li>' + escapeHtml(item.source || 'source') + ': '
      + escapeHtml(item.status || 'UNKNOWN') + (item.version ? ' · v' + escapeHtml(item.version) : '') + '</li>').join('') + '</ul>'
    + '<h5>Findings</h5>' + (findings.length ? '<ul>' + findings.map(item => '<li><strong>'
      + escapeHtml(item.state || 'UNKNOWN') + '</strong> · ' + escapeHtml(item.code || 'FINDING') + ': '
      + escapeHtml(item.message || '') + '</li>').join('') + '</ul>' : '<p class="logistics-meta">No findings were returned.</p>')
    + '<p class="logistics-meta">Assessment only. No booking, reservation, shift or operational commitment was created.</p></section>';
}

async function assessMemberAvailability(form, root) {
  const status = form.querySelector('.workforce-form-status');
  const resultNode = form.querySelector('#workforceAvailabilityAssessmentResult');
  const values = new FormData(form);
  const start = new Date(String(values.get('starts_at') || ''));
  const end = new Date(String(values.get('ends_at') || ''));
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
    status.textContent = 'Choose a valid start and end time.'; return;
  }
  const memberId = form.dataset.memberId;
  if (!memberId) return;
  const workspace = root.querySelector('#workforceWorkspace');
  const sequence = workspace?.dataset.detailSequence || '';
  const tenantId = String(config.chatId), token = String(config.sessionToken);
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true; status.textContent = 'Assessing availability…'; resultNode.innerHTML = '';
  try {
    const body = {
      starts_at: start.toISOString(), ends_at: end.toISOString(),
      timezone: String(values.get('timezone') || '').trim(),
      ...(form.dataset.locationId ? { location_id: form.dataset.locationId } : {}),
    };
    const data = await request(endpoint('members') + '/' + encodeURIComponent(memberId) + '/availability-assessment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!workspace?.isConnected || workspace.dataset.detailSequence !== sequence
      || String(config.chatId) !== tenantId || String(config.sessionToken) !== token
      || String(workspace.dataset.selectedMemberId || '') !== String(memberId)) return;
    resultNode.innerHTML = renderAvailabilityAssessment(data.assessment);
    status.textContent = 'Assessment completed. This is not a booking or reservation.';
  } catch (error) {
    status.textContent = error.message || 'Availability could not be assessed.';
  } finally { submit.disabled = false; }
}

async function saveAvailability(form, root) {
  const status = form.querySelector('.workforce-form-status');
  const values = new FormData(form);
  const start = new Date(String(values.get('starts_at') || ''));
  const end = new Date(String(values.get('ends_at') || ''));
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
    status.textContent = 'Choose a valid start and end time.'; return;
  }
  const memberId = form.dataset.memberId;
  if (!memberId) return;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true; status.textContent = 'Saving availability…';
  try {
    await request(endpoint('availability'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'workforce-ui-' + crypto.randomUUID() },
      body: JSON.stringify({
        member_id: memberId, availability: String(values.get('availability')),
        starts_at: start.toISOString(), ends_at: end.toISOString(),
        timezone: String(values.get('timezone') || '').trim(), effective_from: start.toISOString(),
      }),
    });
    status.textContent = 'Availability saved.';
    form.reset();
    const zone = form.querySelector('[name="timezone"]');
    if (zone) zone.value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    await refreshMember(root, memberId);
  } catch (error) { status.textContent = error.message || 'Availability could not be saved.'; }
  finally { submit.disabled = false; }
}

export function mountWorkforceWorkspace(root = document) {
  const workspace = root.querySelector('#workforceWorkspace');
  if (!workspace) return;
  if (!boundRoots.has(root)) {
    boundRoots.add(root);
    root.addEventListener('click', event => {
      const refresh = event.target.closest('#workforceRefresh');
      const select = event.target.closest('.workforce-select-member');
      const action = event.target.closest('.workforce-member-action');
      const structureAction = event.target.closest('.workforce-structure-action');
      const engagementButton = event.target.closest('.workforce-engagement-action');
      const assignmentButton = event.target.closest('.workforce-assignment-action');
      const shiftTransitionButton = event.target.closest('.workforce-shift-transition');
      const shiftHistoryButton = event.target.closest('.workforce-shift-history-button');
      const recordHistoryButton = event.target.closest('.workforce-record-history-button');
      const policyEditButton = event.target.closest('.workforce-scheduling-policy-edit');
      const policyClearButton = event.target.closest('#workforceSchedulingPolicyClear');
      const page = event.target.closest('[data-member-page]');
      const clear = event.target.closest('#workforceClearMember');
      if (refresh) refreshWorkspace(root);
      if (select) { workspace.dataset.selectedMemberId = select.dataset.memberId || ''; refreshMember(root, select.dataset.memberId); }
      if (action) memberAction(action, root);
      if (structureAction) organizationAction(structureAction, root);
      if (engagementButton) engagementAction(engagementButton, root);
      if (assignmentButton) assignmentAction(assignmentButton, root);
      if (shiftTransitionButton) transitionDatedShift(shiftTransitionButton, root);
      if (shiftHistoryButton) loadDatedShiftHistory(shiftHistoryButton, root);
      if (recordHistoryButton) loadWorkforceRecordHistory(recordHistoryButton);
      if (policyEditButton) editSchedulingPolicy(policyEditButton, root);
      if (policyClearButton) {
        const form = root.querySelector('#workforceSchedulingPolicyForm');
        form?.reset(); delete form.dataset.policyId; delete form.dataset.version;
        if (form) { form.querySelector('#workforceSchedulingPolicyFormTitle').textContent = 'Create scheduling policy'; form.querySelector('.workforce-form-status').textContent = ''; }
      }
      if (page) {
        const current = Number(workspace.dataset.memberPage || 0);
        workspace.dataset.memberPage = String(Math.max(0, current + (page.dataset.memberPage === 'next' ? 1 : -1)));
        renderMemberDirectory(root);
      }
      if (clear) { workspace.dataset.selectedMemberId = ''; workspace.querySelector('#workforceMemberDetails').hidden = true; }
    });
    root.addEventListener('input', event => {
      if (['workforceMemberSearch','workforceLocationFilter'].includes(event.target?.id)) {
        workspace.dataset.memberPage = '0'; renderMemberDirectory(root);
      }
    });
    root.addEventListener('change', event => {
      if (['workforceMemberTypeFilter','workforceMemberStatusFilter','workforceDepartmentFilter','workforcePositionFilter'].includes(event.target?.id)) {
        workspace.dataset.memberPage = '0'; renderMemberDirectory(root);
      }
      const data = workspaceData.get(workspace);
      if (event.target?.form?.id === 'workforceMemberCreateForm' && event.target.name === 'department_id' && data) {
        const positions = data.positions.filter(item => !item.department_id || String(item.department_id) === String(event.target.value));
        fillSelect(workspace.querySelector('#workforceMemberCreateForm [name="position_id"]'), positions);
      }
      if (event.target?.form?.id === 'workforceMemberCreateForm' && event.target.name === 'position_id' && data) {
        const position = data.positions.find(item => String(item.id) === String(event.target.value));
        if (position?.department_id) workspace.querySelector('#workforceMemberCreateForm [name="department_id"]').value = position.department_id;
      }
    });
    root.addEventListener('submit', event => {
      const id = event.target?.id;
      if (!['workforceAvailabilityAssessmentForm','workforceAvailabilityForm','workforceMemberCreateForm','workforceDepartmentForm','workforcePositionForm','workforceEngagementForm','workforceProfileForm','workforceLocationAssignmentForm','workforceShiftTemplateForm','workforceLeaveRequestForm','workforceAbsenceForm','workforceSchedulingPolicyForm'].includes(id)
        && !['workforce-leave-action-form','workforce-absence-void-form','workforce-scheduling-policy-action-form'].some(name => event.target?.classList?.contains(name))
        && !['workforce-shift-generation-form','workforce-shift-reassign-form','workforce-shift-cancel-form'].some(name => event.target?.classList?.contains(name))) return;
      event.preventDefault();
      if (id === 'workforceAvailabilityAssessmentForm') assessMemberAvailability(event.target, root);
      if (id === 'workforceAvailabilityForm') saveAvailability(event.target, root);
      if (id === 'workforceEngagementForm') saveEngagement(event.target, root);
      if (id === 'workforceShiftTemplateForm') saveShiftTemplate(event.target, root);
      if (id === 'workforceLeaveRequestForm') saveLeaveRequest(event.target, root);
      if (id === 'workforceAbsenceForm') saveAbsence(event.target, root);
      if (id === 'workforceSchedulingPolicyForm') saveSchedulingPolicy(event.target, root);
      if (event.target?.classList?.contains('workforce-leave-action-form')) submitLeaveAction(event.target, root);
      if (event.target?.classList?.contains('workforce-absence-void-form')) voidAbsence(event.target, root);
      if (event.target?.classList?.contains('workforce-scheduling-policy-action-form')) schedulingPolicyAction(event.target, root);
      if (event.target?.classList?.contains('workforce-shift-generation-form')) generateTemplateShifts(event.target, root);
      if (event.target?.classList?.contains('workforce-shift-reassign-form')) reassignDatedShift(event.target, root);
      if (event.target?.classList?.contains('workforce-shift-cancel-form')) cancelDatedShift(event.target, root);
      if (id === 'workforceProfileForm') saveProfile(event.target, root);
      if (id === 'workforceLocationAssignmentForm') saveLocationAssignment(event.target, root);
      if (id === 'workforceMemberCreateForm') saveMemberCreate(event.target, root);
      if (id === 'workforceDepartmentForm') saveDepartment(event.target, root);
      if (id === 'workforcePositionForm') savePosition(event.target, root);
    });
  }
  const tenantKey = config.chatId && config.sessionToken ? String(config.chatId) + ':' + String(config.sessionToken) : '';
  if (tenantKey && (mountedWorkspace !== workspace || workspace.dataset.tenantKey !== tenantKey)) {
    mountedWorkspace = workspace; workspace.dataset.tenantKey = tenantKey; workspace.dataset.selectedMemberId = '';
    refreshWorkspace(root);
  }
}
export function renderWorkforce() {
  const host = document.getElementById('workforceWorkspaceHost');
  if (!host) return;
  host.innerHTML = workforceWorkspaceShell();
  mountWorkforceWorkspace(host);
}
