// Authenticated operator-facing Workforce workspace. The backend remains authoritative.
import { config } from '../state.js';
import { authHeaders } from '../auth/tenant.js';
import { escapeHtml, escapeAttr } from '../utils/index.js';

const SECTIONS = Object.freeze([
  ['profiles', 'Profiles'], ['engagements', 'Engagements'], ['calendars', 'Calendars'],
  ['availability', 'Availability'], ['assignments', 'Assignments'], ['shifts', 'Shifts'], ['allocations', 'Allocations'],
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
    + '<label>Department<select name="department_id"><option value="">Unassigned</option></select></label>'
    + '<label>Position<select name="position_id"><option value="">Unassigned</option></select></label>'
    + '<label>Supervisor<select name="supervisor_member_id"><option value="">No supervisor</option></select></label>'
    + '<button type="submit" class="btn-primary">Create professional record</button><p class="logistics-meta workforce-form-status" role="status"></p></form></section>'
    + '<section id="workforceOrganizationAdmin" hidden><h3>Organization structure</h3>'
    + '<div class="workforce-admin-grid"><div><h4>Departments</h4><div id="workforceDepartments"></div>'
    + '<form id="workforceDepartmentForm" class="settings-form workforce-admin-form"><label>Code<input name="code" maxlength="40" required></label><label>Name<input name="name" maxlength="120" required></label><label>Description<input name="description" maxlength="1000"></label><button type="submit" class="btn-primary">Add department</button><p class="logistics-meta workforce-form-status" role="status"></p></form></div>'
    + '<div><h4>Positions</h4><div id="workforcePositions"></div>'
    + '<form id="workforcePositionForm" class="settings-form workforce-admin-form"><label>Code<input name="code" maxlength="40" required></label><label>Name<input name="name" maxlength="120" required></label><label>Department<select name="department_id"><option value="">No department</option></select></label><label>Classification<input name="classification" maxlength="80"></label><button type="submit" class="btn-primary">Add position</button><p class="logistics-meta workforce-form-status" role="status"></p></form></div></div></section>'
    + '<section id="workforceMemberDetails" hidden><div class="workforce-heading"><h3 id="workforceSelectedMemberTitle">Member workspace</h3>'
    + '<button type="button" class="btn-secondary" id="workforceClearMember">Close</button></div><div id="workforceMemberProfile"></div><div id="workforceMemberRecords"></div>'
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
  fillSelect(workspace.querySelector('#workforceMemberCreateForm [name="department_id"]'), departments);
  fillSelect(workspace.querySelector('#workforceMemberCreateForm [name="position_id"]'), positions);
  fillSelect(workspace.querySelector('#workforcePositionForm [name="department_id"]'), departments);
  const supervisors = workspaceData.get(workspace)?.members.filter(member => member.status === 'ACTIVE') || [];
  fillSelect(workspace.querySelector('#workforceMemberCreateForm [name="supervisor_member_id"]'), supervisors, '', 'display_name');
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
    const [membersData, summaryData, departments, positions, engagements] = await Promise.all([
      request(endpoint('members') + '?limit=100'),
      request(endpoint('utilization', '/summary')),
      optionalRecords('departments'), optionalRecords('positions'), optionalRecords('engagements'),
    ]);
    if (!workspace.isConnected || workspace.dataset.refreshSequence !== String(seq)
      || String(config.chatId) !== tenantId || String(config.sessionToken) !== token) return;
    const members = Array.isArray(membersData.records) ? membersData.records : [];
    workspaceData.set(workspace, { members, departments, positions, engagements });
    workspace.querySelector('#workforceOverviewMetrics').innerHTML =
      renderOverviewMetrics(members, departments, positions, engagements);
    summaryNode.innerHTML = renderSummary(summaryData.summary || {});
    renderMemberDirectory(root);
    renderOrganizationAdmin(workspace, departments, positions);
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
async function refreshMember(root, memberId, member = null) {
  const workspace = root.querySelector('#workforceWorkspace');
  const details = workspace?.querySelector('#workforceMemberDetails');
  const recordsNode = workspace?.querySelector('#workforceMemberRecords');
  const profileNode = workspace?.querySelector('#workforceMemberProfile');
  if (!workspace || !details || !recordsNode || !profileNode) return;
  member = member || workspaceData.get(workspace)?.members.find(item => String(item.id) === String(memberId)) || null;
  profileNode.innerHTML = member ? renderMemberProfile(workspace, member) : '';
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
    : renderRecords(result.title, result.records)).join('');
  const form = workspace.querySelector('#workforceAvailabilityForm');
  form.dataset.memberId = memberId;
  form.hidden = !canManageMembers();
}

function renderMemberProfile(workspace, member) {
  const data = workspaceData.get(workspace) || { members: [], departments: [], positions: [] };
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
    + '</div>' + editor + account + '</section>';
}

async function saveMemberProfile(form, root) {
  const status = form.querySelector('.workforce-form-status');
  const values = new FormData(form);
  const memberId = form.dataset.memberId;
  const payload = { expected_version: Number(form.dataset.version), display_name: String(values.get('display_name') || '').trim() };
  for (const field of ['employee_number','department_id','position_id','supervisor_member_id']) {
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
    status.textContent = 'Profile and assignments saved.'; await refreshWorkspace(root);
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
    status.textContent = 'Existing account linked.'; await refreshWorkspace(root);
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
  for (const field of ['employee_number','department_id','position_id','supervisor_member_id']) {
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
    form.reset(); status.textContent = 'Professional record created. No Sellify login was created.';
    await refreshWorkspace(root);
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
    form.reset(); status.textContent = 'Department created.'; await refreshWorkspace(root);
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
    form.reset(); status.textContent = 'Position created.'; await refreshWorkspace(root);
  } catch (error) { status.textContent = error.message || 'Position could not be created.'; }
  finally { submit.disabled = false; }
}

async function organizationAction(button, root) {
  const entity = button.dataset.entity, id = button.dataset.id, action = button.dataset.action;
  const version = Number(button.dataset.version);
  if (!['departments','positions'].includes(entity) || !id || !['activate','deactivate'].includes(action) || !Number.isInteger(version)) return;
  button.disabled = true;
  try {
    await request(endpoint(entity, '/' + encodeURIComponent(id) + '/' + action), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expected_version: version }),
    });
    await refreshWorkspace(root);
  } catch (error) {
    const status = root.querySelector('#workforceStatus');
    if (status) status.textContent = error.message || 'Organization structure status could not be changed.';
    button.disabled = false;
  }
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
      const page = event.target.closest('[data-member-page]');
      const clear = event.target.closest('#workforceClearMember');
      if (refresh) refreshWorkspace(root);
      if (select) { workspace.dataset.selectedMemberId = select.dataset.memberId || ''; refreshMember(root, select.dataset.memberId); }
      if (action) memberAction(action, root);
      if (structureAction) organizationAction(structureAction, root);
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
      if (!['workforceAvailabilityForm','workforceMemberCreateForm','workforceDepartmentForm','workforcePositionForm'].includes(id)) return;
      event.preventDefault();
      if (id === 'workforceAvailabilityForm') saveAvailability(event.target, root);
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
