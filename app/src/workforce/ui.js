// Authenticated operator-facing Workforce workspace. The backend remains authoritative.
import { config } from '../state.js';
import { authHeaders } from '../auth/tenant.js';
import { escapeHtml, escapeAttr } from '../utils/index.js';

const SECTIONS = Object.freeze([
  ['profiles', 'Profiles'], ['engagements', 'Engagements'], ['calendars', 'Calendars'],
  ['availability', 'Availability'], ['assignments', 'Assignments'], ['shifts', 'Shifts'], ['allocations', 'Allocations'],
]);
const boundRoots = new WeakSet();
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
function renderMember(member) {
  const state = String(member.status || 'UNKNOWN').toUpperCase();
  const action = state === 'DRAFT' || state === 'SUSPENDED' ? 'activate' : state === 'ACTIVE' ? 'suspend' : '';
  const actionButton = canManageMembers() && action
    ? '<button class="btn-secondary workforce-member-action" type="button" data-action="' + action
      + '" data-member-id="' + escapeAttr(member.id) + '" data-version="' + Number(member.version || 1) + '">'
      + (action === 'activate' ? 'Activate' : 'Suspend') + '</button>' : '';
  return '<article class="logistics-card workforce-member-card"><div class="logistics-top"><strong>'
    + escapeHtml(member.display_name || member.user_id || 'Workforce member') + '</strong><span class="logistics-status">'
    + escapeHtml(state.replaceAll('_', ' ')) + '</span></div><div class="logistics-meta">'
    + escapeHtml(String(member.member_type || 'Member').replaceAll('_', ' ')) + ' · v' + Number(member.version || 1)
    + '</div><div class="workforce-member-controls"><button type="button" class="btn-secondary workforce-select-member" data-member-id="'
    + escapeAttr(member.id) + '">Open member</button>' + actionButton + '</div></article>';
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
    + '<div class="workforce-heading"><div><h2>Workforce</h2><p class="logistics-meta">People, availability, assignments and work records. Server authorization remains authoritative.</p></div>'
    + '<button type="button" class="btn-secondary" id="workforceRefresh">Refresh</button></div>'
    + '<p id="workforceStatus" class="logistics-meta" role="status" aria-live="polite">Loading Workforce…</p>'
    + '<section><h3>Utilization</h3><div id="workforceSummary"></div></section>'
    + '<section><h3>Members</h3><div id="workforceMembers"></div></section>'
    + '<section id="workforceMemberDetails" hidden><div class="workforce-heading"><h3 id="workforceSelectedMemberTitle">Member workspace</h3>'
    + '<button type="button" class="btn-secondary" id="workforceClearMember">Close</button></div><div id="workforceMemberRecords"></div>'
    + '<form id="workforceAvailabilityForm" class="settings-form workforce-availability-form">'
    + '<h4>Declare availability</h4><label>Availability<select name="availability" required><option value="AVAILABLE">Available</option>'
    + '<option value="UNAVAILABLE">Unavailable</option><option value="TENTATIVE">Tentative</option><option value="BLACKOUT">Blackout</option></select></label>'
    + '<label>Start<input name="starts_at" type="datetime-local" required></label><label>End<input name="ends_at" type="datetime-local" required></label>'
    + '<label>Timezone<input name="timezone" value="' + escapeAttr(zone) + '" required></label>'
    + '<button type="submit" class="btn-primary">Save availability</button><p class="logistics-meta workforce-form-status" role="status"></p></form></section></section>';
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
    const [membersData, summaryData] = await Promise.all([
      request(endpoint('members') + '?limit=100'), request(endpoint('utilization', '/summary')),
    ]);
    if (!workspace.isConnected || workspace.dataset.refreshSequence !== String(seq)
      || String(config.chatId) !== tenantId || String(config.sessionToken) !== token) return;
    const members = Array.isArray(membersData.records) ? membersData.records : [];
    membersNode.innerHTML = members.length ? members.map(renderMember).join('')
      : '<p class="logistics-meta">No Workforce members are registered yet. Link an existing tenant member through the authorized Workforce API.</p>';
    summaryNode.innerHTML = renderSummary(summaryData.summary || {});
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
  if (!workspace || !details || !recordsNode) return;
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

async function memberAction(button, root) {
  const { memberId, action } = { memberId: button.dataset.memberId, action: button.dataset.action };
  const version = Number(button.dataset.version);
  if (!memberId || !['activate', 'suspend'].includes(action) || !Number.isInteger(version)) return;
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
      const clear = event.target.closest('#workforceClearMember');
      if (refresh) refreshWorkspace(root);
      if (select) { workspace.dataset.selectedMemberId = select.dataset.memberId || ''; refreshMember(root, select.dataset.memberId); }
      if (action) memberAction(action, root);
      if (clear) { workspace.dataset.selectedMemberId = ''; workspace.querySelector('#workforceMemberDetails').hidden = true; }
    });
    root.addEventListener('submit', event => {
      if (event.target?.id !== 'workforceAvailabilityForm') return;
      event.preventDefault(); saveAvailability(event.target, root);
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
