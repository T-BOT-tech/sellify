import crypto from 'node:crypto';
import { validateWorkforceRecurrenceRule } from './workforce-recurrence-contract.js';
import { buildShiftWindowFromTemplate, isoWeekday } from './workforce-shift-time.js';
import {
  WORKFORCE_REPOSITORY_ENTITY_OPERATIONS,
  validateWorkforceRepositoryOperation,
} from './workforce-repository-contract.js';

const TABLES = Object.freeze({
  department: { table: 'workforce_departments', id: 'id', state: 'status', fields: ['code','name','description'], createOnlyFields: [], json: [] },
  position: { table: 'workforce_positions', id: 'id', state: 'status', fields: ['code','name','description','department_id','classification'], createOnlyFields: [], json: [] },
  shift_template: { table: 'workforce_shift_templates', id: 'id', state: 'status', fields: ['name','start_local_time','end_local_time','timezone','break_rules','work_days','department_id','position_id','location_id','effective_from','effective_until'], createOnlyFields: [], json: ['break_rules_json','work_days_json'] },
  member: {
    table: 'workforce_members', id: 'id', state: 'status',
    fields: ['member_type','primary_location_id','timezone','display_name','employee_number','department_id','position_id','supervisor_member_id'],
    createOnlyFields: ['user_id'],
    json: [],
  },
  profile: {
    table: 'workforce_profiles', id: 'id',
    fields: ['skills','qualifications','languages','service_capabilities','visibility','notes','effective_from','effective_until'],
    createOnlyFields: ['member_id'],
    json: ['skills_json','qualifications_json','languages_json','service_capabilities_json'],
  },
  engagement: {
    table: 'workforce_engagements', id: 'id', state: 'status',
    fields: ['engagement_type','starts_at','ends_at','approver_user_id','terms_reference'],
    createOnlyFields: ['member_id'],
    json: [],
  },
  calendar: {
    table: 'workforce_calendars', id: 'id', state: 'status',
    fields: ['location_id','timezone','weekly_schedule','holiday_calendar','effective_from','effective_until'],
    createOnlyFields: ['member_id'],
    json: ['weekly_schedule_json','holiday_calendar_json'],
  },
  calendar_exception: {
    table: 'workforce_calendar_exceptions', id: 'id', state: 'status',
    fields: ['exception_type','starts_at','ends_at','all_day','reason'],
    createOnlyFields: ['calendar_id'],
    json: [],
  },
  availability: {
    table: 'workforce_availability_windows', id: 'id', state: 'status',
    fields: ['resource_id','location_id','availability','starts_at','ends_at','timezone','recurrence_rule','effective_from','effective_until'],
    createOnlyFields: ['member_id'],
    json: [],
  },
  assignment: {
    table: 'workforce_assignments', id: 'id', state: 'status',
    fields: ['resource_id','location_id','assignment_type','starts_at','ends_at'],
    createOnlyFields: ['member_id','booking_id','operational_task_id'],
    json: [],
  },
  shift: {
    table: 'workforce_shifts', id: 'id', state: 'status',
    fields: ['resource_id','location_id','starts_at','ends_at','timezone','break_rules'],
    createOnlyFields: ['member_id','recurrence_source_id','assignment_source_id','shift_template_id','template_version','generated_local_date'],
    json: ['break_rules_json'],
  },
  allocation: {
    table: 'workforce_allocations', id: 'id', state: 'state',
    fields: ['resource_id','starts_at','ends_at'],
    createOnlyFields: ['member_id','booking_id','operational_task_id'],
    json: [],
  },
  utilization: {
    table: 'workforce_utilization_events', id: 'id', state: 'status',
    fields: ['resource_id','planned_starts_at','planned_ends_at','actual_starts_at','actual_ends_at','evidence_source'],
    createOnlyFields: ['member_id','booking_id','operational_task_id'],
    json: [],
  },
});

const INITIAL_STATES = Object.freeze({
  department: 'ACTIVE', position: 'ACTIVE', shift_template: 'ACTIVE',
  member: 'DRAFT',
  engagement: 'DRAFT',
  calendar: 'ACTIVE',
  calendar_exception: 'ACTIVE',
  availability: 'ACTIVE',
  assignment: 'DRAFT',
  shift: 'PLANNED',
  allocation: 'DRAFT',
  utilization: 'PLANNED',
});

const TRANSITIONS = Object.freeze({
  department: { activate: { from: ['INACTIVE'], to: 'ACTIVE' }, deactivate: { from: ['ACTIVE'], to: 'INACTIVE' } },
  position: { activate: { from: ['INACTIVE'], to: 'ACTIVE' }, deactivate: { from: ['ACTIVE'], to: 'INACTIVE' } },
  shift_template: { activate: { from: ['INACTIVE'], to: 'ACTIVE' }, deactivate: { from: ['ACTIVE'], to: 'INACTIVE' } },
  member: {
    activate: { from: ['DRAFT','SUSPENDED'], to: 'ACTIVE' },
    suspend: { from: ['ACTIVE'], to: 'SUSPENDED' },
    deactivate: { from: ['ACTIVE','SUSPENDED'], to: 'INACTIVE' },
  },
  engagement: {
    submit: { from: ['DRAFT'], to: 'PENDING_APPROVAL' },
    activate: { from: ['PENDING_APPROVAL','SUSPENDED'], to: 'ACTIVE' },
    suspend: { from: ['ACTIVE'], to: 'SUSPENDED' },
    end: { from: ['DRAFT','PENDING_APPROVAL','ACTIVE','SUSPENDED'], to: 'ENDED' },
  },
  calendar_exception: {
    cancel: { from: ['ACTIVE'], to: 'CANCELLED' },
  },
  assignment: {
    activate: { from: ['DRAFT','SUSPENDED'], to: 'ACTIVE' },
    suspend: { from: ['ACTIVE'], to: 'SUSPENDED' },
    end: { from: ['DRAFT','ACTIVE','SUSPENDED'], to: 'ENDED' },
  },
  shift: {
    confirm: { from: ['PLANNED'], to: 'CONFIRMED' },
    start: { from: ['CONFIRMED'], to: 'IN_PROGRESS' },
    complete: { from: ['IN_PROGRESS'], to: 'COMPLETED' },
    cancel: { from: ['PLANNED','CONFIRMED','IN_PROGRESS'], to: 'CANCELLED' },
  },
  allocation: {
    submit: { from: ['DRAFT'], to: 'PENDING_APPROVAL' },
    approve: { from: ['PENDING_APPROVAL'], to: 'COMMITTED' },
    release: { from: ['COMMITTED'], to: 'RELEASED' },
    cancel: { from: ['DRAFT','PENDING_APPROVAL','COMMITTED'], to: 'CANCELLED' },
  },
  utilization: {
    start: { from: ['PLANNED'], to: 'IN_PROGRESS' },
    complete: { from: ['IN_PROGRESS'], to: 'COMPLETED' },
    cancel: { from: ['PLANNED','IN_PROGRESS'], to: 'CANCELLED' },
  },
});

const RESOURCE_SCOPED_ENTITIES = new Set(['availability','assignment','shift','allocation','utilization']);
const TIMESTAMP_FIELDS = new Set([
  'starts_at','ends_at','planned_starts_at','planned_ends_at','actual_starts_at','actual_ends_at',
]);

function normalizeRepositoryValue(field, value) {
  if (field === 'code') {
    if (typeof value !== 'string') throw fail('WORKFORCE_CODE_INVALID', 'code must be a string');
    const normalized = value.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9._/-]{0,39}$/.test(normalized)) throw fail('WORKFORCE_CODE_INVALID', 'code must be 1-40 letters, numbers, dots, underscores, slashes or hyphens');
    return normalized;
  }
  if (field === 'name') {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 120) throw fail('WORKFORCE_NAME_INVALID', 'name must be a non-empty string of at most 120 characters');
    return value.trim();
  }
  if (field === 'description') {
    if (value == null) return '';
    if (typeof value !== 'string' || value.length > 1000) throw fail('WORKFORCE_DESCRIPTION_INVALID', 'description must be a string of at most 1000 characters');
    return value.trim();
  }
  if (field === 'start_local_time' || field === 'end_local_time') {
    if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      throw fail('WORKFORCE_LOCAL_TIME_INVALID', field + ' must use HH:MM in local time');
    }
    return value;
  }
  if (field === 'timezone') {
    try {
      if (typeof value !== 'string' || !value.trim()) throw new Error('empty timezone');
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return value.trim();
    } catch { throw fail('WORKFORCE_TIMEZONE_INVALID', 'timezone must be a valid IANA timezone'); }
  }
  if (field === 'work_days_json') {
    if (!Array.isArray(value) || value.some(day => !Number.isInteger(day) || day < 1 || day > 7)
      || new Set(value).size !== value.length || value.length === 0) {
      throw fail('WORKFORCE_WORK_DAYS_INVALID', 'work_days must contain unique ISO weekdays from 1 to 7');
    }
    return [...value].sort((a,b) => a-b);
  }
  if (field === 'classification') {
    if (value == null) return null;
    if (typeof value !== 'string' || value.trim().length > 80) throw fail('WORKFORCE_CLASSIFICATION_INVALID', 'classification must be a string of at most 80 characters');
    return value.trim() || null;
  }
  if (['department_id','position_id','supervisor_member_id','shift_template_id'].includes(field)) {
    if (value == null) return null;
    if (typeof value !== 'string' || !value.trim()) throw fail('WORKFORCE_REFERENCE_INVALID', field + ' must be a non-empty ID or null');
    return value.trim();
  }
  if (field === 'template_version') {
    if (!Number.isInteger(value) || value < 1) throw fail('WORKFORCE_TEMPLATE_VERSION_INVALID', 'template_version must be a positive integer');
    return value;
  }
  if (field === 'generated_local_date') {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
      || !Number.isFinite(Date.parse(value + 'T00:00:00Z'))
      || new Date(value + 'T00:00:00Z').toISOString().slice(0,10) !== value) {
      throw fail('WORKFORCE_SHIFT_DATE_INVALID', 'generated_local_date must be a valid YYYY-MM-DD date');
    }
    return value;
  }
  if (field === 'employee_number') {
    if (value == null) return null;
    if (typeof value !== 'string') throw fail('WORKFORCE_EMPLOYEE_NUMBER_INVALID', 'employee_number must be a string');
    const normalized = value.trim();
    if (normalized.length > 80) throw fail('WORKFORCE_EMPLOYEE_NUMBER_INVALID', 'employee_number must not exceed 80 characters');
    return normalized || null;
  }
  if (field === 'recurrence_rule' && value != null && value !== '') {
    const result = validateWorkforceRecurrenceRule(value);
    if (!result.valid) throw fail('WORKFORCE_RECURRENCE_RULE_INVALID', result.errors.join('; '));
    return String(value).trim().toUpperCase();
  }
  if (field === 'recurrence_rule' && value === '') return null;
  if (TIMESTAMP_FIELDS.has(field) && value != null) {
    const parsed = Date.parse(value);
    if (typeof value !== 'string' || !Number.isFinite(parsed)) {
      throw fail('WORKFORCE_TIMESTAMP_INVALID', `${field} must be a valid ISO-8601 timestamp`);
    }
    if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
      throw fail('WORKFORCE_TIMESTAMP_TIMEZONE_REQUIRED', `${field} must include an explicit timezone`);
    }
    return new Date(parsed).toISOString();
  }
  return value;
}

const FILTER_COLUMNS = new Set([
  'member_id','resource_id','location_id','booking_id','operational_task_id',
  'calendar_id','status','state','availability','exception_type','assignment_type','employee_number','department_id','position_id','supervisor_member_id','code',
]);

function fail(code, message, statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode });
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function databaseColumn(field, jsonColumns) {
  return jsonColumns.includes(`${field}_json`) ? `${field}_json` : field;
}

function toDatabaseValue(value, column, jsonColumns) {
  if (jsonColumns.includes(column)) return JSON.stringify(value ?? []);
  if (column === 'all_day') return value ? 1 : 0;
  return value;
}

function fromDatabaseRow(row, jsonColumns) {
  if (!row) return null;
  const result = { ...row };
  for (const column of jsonColumns) {
    const output = column.replace(/_json$/, '');
    try { result[output] = row[column] == null ? [] : JSON.parse(row[column]); }
    catch { result[output] = []; }
    delete result[column];
  }
  if (Object.hasOwn(result, 'all_day')) result.all_day = Boolean(result.all_day);
  result.version = Number(result.version);
  return result;
}

function scopedError() {
  return fail('WORKFORCE_SCOPE_NOT_FOUND', 'Workforce record was not found in the active organization and tenant', 404);
}

export class WorkforceSqliteRepository {
  constructor({ db, authorize, clock = () => new Date().toISOString(), idFactory = () => crypto.randomUUID() } = {}) {
    if (!db || typeof db.prepare !== 'function' || typeof db.exec !== 'function') {
      throw new TypeError('WorkforceSqliteRepository requires a SQLite DatabaseSync connection');
    }
    if (typeof authorize !== 'function') {
      throw fail('WORKFORCE_AUTHORIZATION_REQUIRED', 'A Workforce authorization callback is required before repository access', 500);
    }
    this.db = db;
    this.authorize = authorize;
    this.clock = clock;
    this.idFactory = idFactory;
  }

  assertContext(context = {}) {
    const result = validateWorkforceRepositoryOperation('member', 'get', context);
    if (!result.valid) throw fail('WORKFORCE_CONTEXT_INVALID', result.errors.join('; '));
    if (typeof context.chat_id !== 'string' || !context.chat_id.trim()) {
      throw fail('WORKFORCE_CONTEXT_INVALID', 'Missing required context: chat_id');
    }
    const tenant = this.db.prepare(
      'SELECT tenant_id, organization_id, chat_id FROM tenants WHERE tenant_id = ? AND organization_id = ? AND chat_id = ?'
    ).get(String(context.tenant_id), String(context.organization_id), String(context.chat_id));
    if (!tenant) throw scopedError();
    return {
      organization_id: String(tenant.organization_id),
      tenant_id: String(tenant.tenant_id),
      chat_id: String(tenant.chat_id),
    };
  }

  assertAuthorized(context, entity, operation, record = null) {
    let allowed = false;
    try { allowed = this.authorize({ ...context, entity, operation, record }); }
    catch (error) { throw error; }
    if (allowed !== true) throw fail('WORKFORCE_FORBIDDEN', 'Workforce permission denied', 403);
  }

  assertReferences(entity, data, scope, recordId = null) {
    if (entity === 'shift' && data.shift_template_id) {
      const template = this.db.prepare(`
        SELECT id FROM workforce_shift_templates
        WHERE id=? AND organization_id=? AND tenant_id=? AND chat_id=?
      `).get(String(data.shift_template_id), scope.organization_id, scope.tenant_id, scope.chat_id);
      if (!template) throw fail('WORKFORCE_SHIFT_TEMPLATE_SCOPE_INVALID', 'Shift template does not belong to the active organization and tenant', 422);
      if (!Number.isInteger(data.template_version) || Number(data.template_version) < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(String(data.generated_local_date || ''))) {
        throw fail('WORKFORCE_SHIFT_TEMPLATE_PROVENANCE_INVALID', 'Generated shifts require a template version and local generation date', 422);
      }
    }
    if (entity === 'shift' && !data.shift_template_id && (data.template_version != null || data.generated_local_date != null)) {
      throw fail('WORKFORCE_SHIFT_TEMPLATE_PROVENANCE_INVALID', 'Template version and local date require a shift template reference', 422);
    }
    if (data.member_id) {
      const member = this.db.prepare(`
        SELECT id FROM workforce_members
        WHERE id = ? AND organization_id = ? AND tenant_id = ? AND chat_id = ?
      `).get(String(data.member_id), scope.organization_id, scope.tenant_id, scope.chat_id);
      if (!member) throw fail('WORKFORCE_MEMBER_SCOPE_INVALID', 'Member does not belong to the active organization and tenant', 422);
    }
    if (data.calendar_id) {
      const calendar = this.db.prepare(`
        SELECT id FROM workforce_calendars
        WHERE id = ? AND organization_id = ? AND tenant_id = ? AND chat_id = ?
      `).get(String(data.calendar_id), scope.organization_id, scope.tenant_id, scope.chat_id);
      if (!calendar) throw fail('WORKFORCE_CALENDAR_SCOPE_INVALID', 'Calendar does not belong to the active organization and tenant', 422);
    }
    if (entity === 'shift_template') {
      const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        && Number.isFinite(Date.parse(value + 'T00:00:00Z'))
        && new Date(value + 'T00:00:00Z').toISOString().slice(0,10) === value;
      if (!validDate(data.effective_from) || (data.effective_until != null && !validDate(data.effective_until))
        || (data.effective_until && data.effective_until < data.effective_from)) {
        throw fail('WORKFORCE_TEMPLATE_EFFECTIVE_DATE_INVALID', 'Template effective dates must be valid YYYY-MM-DD dates in ascending order');
      }
      const minute = value => Number(value.slice(0,2)) * 60 + Number(value.slice(3,5));
      const startMinute = minute(data.start_local_time);
      const endMinute = minute(data.end_local_time);
      const duration = (endMinute - startMinute + 1440) % 1440;
      if (!duration) throw fail('WORKFORCE_TEMPLATE_DURATION_INVALID', 'A shift template must have a non-zero local-time duration');
      const breaks = data.break_rules_json ?? data.break_rules ?? [];
      if (!Array.isArray(breaks) || breaks.some(rule => !rule || typeof rule !== 'object' || Array.isArray(rule)
        || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(rule.start_local_time || ''))
        || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(rule.end_local_time || ''))
        || rule.start_local_time === rule.end_local_time)) {
        throw fail('WORKFORCE_BREAK_RULES_INVALID', 'Template break_rules must be local-time intervals');
      }
      const normalizedBreaks = breaks.map(rule => {
        const offset = (minute(rule.start_local_time) - startMinute + 1440) % 1440;
        const breakDuration = (minute(rule.end_local_time) - minute(rule.start_local_time) + 1440) % 1440;
        if (!breakDuration || offset + breakDuration > duration) {
          throw fail('WORKFORCE_BREAK_RULES_INVALID', 'Each break interval must fit inside the template shift');
        }
        return { offset, end: offset + breakDuration };
      }).sort((a,b) => a.offset - b.offset);
      for (let index = 1; index < normalizedBreaks.length; index++) {
        if (normalizedBreaks[index].offset < normalizedBreaks[index - 1].end) {
          throw fail('WORKFORCE_BREAK_RULES_INVALID', 'Break intervals must not overlap');
        }
      }
      if (data.department_id) {
        const department = this.db.prepare("SELECT id FROM workforce_departments WHERE id=? AND organization_id=? AND tenant_id=? AND chat_id=? AND status='ACTIVE'")
          .get(String(data.department_id), scope.organization_id, scope.tenant_id, scope.chat_id);
        if (!department) throw fail('WORKFORCE_TEMPLATE_DEPARTMENT_SCOPE_INVALID', 'Template department is outside the active organization and tenant', 422);
      }
      if (data.position_id) {
        const position = this.db.prepare("SELECT id, department_id FROM workforce_positions WHERE id=? AND organization_id=? AND tenant_id=? AND chat_id=? AND status='ACTIVE'")
          .get(String(data.position_id), scope.organization_id, scope.tenant_id, scope.chat_id);
        if (!position || (position.department_id && String(position.department_id) !== String(data.department_id || ''))) {
          throw fail('WORKFORCE_TEMPLATE_POSITION_SCOPE_INVALID', 'Template position must be active and match its department in the current organization', 422);
        }
      }
    }
    if (entity === 'position' && data.department_id) {
      const department = this.db.prepare("SELECT id FROM workforce_departments WHERE id=? AND organization_id=? AND tenant_id=? AND chat_id=? AND status='ACTIVE'")
        .get(String(data.department_id), scope.organization_id, scope.tenant_id, scope.chat_id);
      if (!department) throw fail('WORKFORCE_DEPARTMENT_SCOPE_INVALID', 'Department is outside the active scope or inactive', 422);
    }
    if (entity === 'member') {
      if (data.department_id) {
        const department = this.db.prepare("SELECT id FROM workforce_departments WHERE id=? AND organization_id=? AND tenant_id=? AND chat_id=? AND status='ACTIVE'")
          .get(String(data.department_id), scope.organization_id, scope.tenant_id, scope.chat_id);
        if (!department) throw fail('WORKFORCE_DEPARTMENT_SCOPE_INVALID', 'Department is outside the active scope or inactive', 422);
      }
      if (data.position_id) {
        const position = this.db.prepare("SELECT id, department_id FROM workforce_positions WHERE id=? AND organization_id=? AND tenant_id=? AND chat_id=? AND status='ACTIVE'")
          .get(String(data.position_id), scope.organization_id, scope.tenant_id, scope.chat_id);
        if (!position) throw fail('WORKFORCE_POSITION_SCOPE_INVALID', 'Position is outside the active scope or inactive', 422);
        if (position.department_id && String(position.department_id) !== String(data.department_id || '')) {
          throw fail('WORKFORCE_POSITION_DEPARTMENT_MISMATCH', 'Member department must match the position department', 422);
        }
      }
      if (data.supervisor_member_id) {
        const supervisorId = String(data.supervisor_member_id);
        if (recordId && supervisorId === String(recordId)) throw fail('WORKFORCE_SUPERVISOR_SELF_INVALID', 'A member cannot supervise themselves', 422);
        const supervisor = this.db.prepare("SELECT id FROM workforce_members WHERE id=? AND organization_id=? AND tenant_id=? AND chat_id=? AND status='ACTIVE'")
          .get(supervisorId, scope.organization_id, scope.tenant_id, scope.chat_id);
        if (!supervisor) throw fail('WORKFORCE_SUPERVISOR_SCOPE_INVALID', 'Supervisor must be active in the same organization and tenant', 422);
        const visited = new Set(recordId ? [String(recordId)] : []);
        let cursor = supervisorId;
        while (cursor) {
          if (visited.has(cursor)) throw fail('WORKFORCE_REPORTING_CYCLE_INVALID', 'Reporting relationship would create a cycle', 409);
          visited.add(cursor);
          const parent = this.db.prepare('SELECT supervisor_member_id FROM workforce_members WHERE id=? AND organization_id=? AND tenant_id=? AND chat_id=?')
            .get(cursor, scope.organization_id, scope.tenant_id, scope.chat_id);
          cursor = parent?.supervisor_member_id ? String(parent.supervisor_member_id) : null;
        }
      }
    }
    if (Object.hasOwn(data, 'user_id')) {
      const userId = data.user_id == null ? null : String(data.user_id).trim();
      if (userId === '') throw fail('WORKFORCE_USER_ID_INVALID', 'user_id must be omitted, null, or a valid existing user ID', 422);
      if (userId) {
        const user = this.db.prepare(`
          SELECT u.id FROM users u
          JOIN memberships m ON m.user_id = u.id
          WHERE u.id = ? AND m.chat_id = ? AND m.status = 'active'
        `).get(userId, scope.chat_id);
        if (!user) throw fail('WORKFORCE_USER_MEMBERSHIP_REQUIRED', 'User must have an active membership in this tenant', 422);
      }
    }
    if (data.primary_location_id || data.location_id) {
      const locationId = String(data.primary_location_id || data.location_id);
      const location = this.db.prepare(
        'SELECT id FROM locations WHERE id = ? AND organization_id = ?'
      ).get(locationId, scope.organization_id);
      if (!location) throw fail('WORKFORCE_LOCATION_SCOPE_INVALID', 'Location does not belong to the active organization', 422);
    }
    if (data.resource_id) {
      const resource = this.db.prepare(
        'SELECT id FROM service_resources WHERE id = ? AND organization_id = ? AND chat_id = ?'
      ).get(String(data.resource_id), scope.organization_id, scope.chat_id);
      if (!resource) throw fail('WORKFORCE_RESOURCE_SCOPE_INVALID', 'Service Resource does not belong to the active organization and tenant', 422);
    }
    if (data.booking_id) {
      const booking = this.db.prepare(
        'SELECT id FROM service_bookings WHERE id = ? AND organization_id = ? AND chat_id = ?'
      ).get(String(data.booking_id), scope.organization_id, scope.chat_id);
      if (!booking) throw fail('WORKFORCE_BOOKING_SCOPE_INVALID', 'Service Booking does not belong to the active organization and tenant', 422);
    }
  }

  assertResourceVisibility(context, entity, row) {
    if (!row) return;
    if (RESOURCE_SCOPED_ENTITIES.has(entity) && context.resource_id
      && String(row.resource_id || '') !== String(context.resource_id)) throw scopedError();
    if (context.member_id && row.member_id
      && String(row.member_id) !== String(context.member_id)) throw scopedError();
    if (context.member_id && entity === 'calendar_exception') {
      const calendar = this.db.prepare('SELECT member_id FROM workforce_calendars WHERE id = ? AND organization_id = ? AND tenant_id = ?')
        .get(String(row.calendar_id), String(context.organization_id), String(context.tenant_id));
      if (!calendar || String(calendar.member_id) !== String(context.member_id)) throw scopedError();
    }
    if (context.provider_user_id) {
      const member = row.member_id
        ? this.db.prepare('SELECT user_id FROM workforce_members WHERE id = ? AND organization_id = ? AND tenant_id = ?')
          .get(String(row.member_id), String(context.organization_id), String(context.tenant_id))
        : null;
      if (entity === 'member' && String(row.user_id) !== String(context.provider_user_id)) throw scopedError();
      if (member && String(member.user_id) !== String(context.provider_user_id)) throw scopedError();
      if (entity === 'calendar_exception') {
        const owner = this.db.prepare(`SELECT m.user_id FROM workforce_calendars c JOIN workforce_members m ON m.id = c.member_id WHERE c.id = ? AND c.organization_id = ? AND c.tenant_id = ?`)
          .get(String(row.calendar_id), String(context.organization_id), String(context.tenant_id));
        if (!owner || String(owner.user_id) !== String(context.provider_user_id)) throw scopedError();
      }
    }
  }

  get(entity, id, context = {}) {
    const spec = TABLES[entity];
    if (!spec) throw fail('WORKFORCE_ENTITY_INVALID', `Unsupported Workforce entity: ${entity}`);
    const scope = this.assertContext(context);
    const row = this.db.prepare(`
      SELECT * FROM ${spec.table}
      WHERE ${spec.id} = ? AND organization_id = ? AND tenant_id = ? AND chat_id = ?
    `).get(String(id), scope.organization_id, scope.tenant_id, scope.chat_id);
    if (!row) throw scopedError();
    const record = fromDatabaseRow(row, spec.json);
    this.assertResourceVisibility(context, entity, record);
    this.assertAuthorized(context, entity, 'get', record);
    return record;
  }

  list(entity, context = {}, filters = {}) {
    const spec = TABLES[entity];
    if (!spec) throw fail('WORKFORCE_ENTITY_INVALID', `Unsupported Workforce entity: ${entity}`);
    const scope = this.assertContext(context);
    this.assertAuthorized(context, entity, 'list', null);
    const clauses = ['organization_id = ?', 'tenant_id = ?', 'chat_id = ?'];
    const values = [scope.organization_id, scope.tenant_id, scope.chat_id];
    for (const [key, value] of Object.entries(filters || {})) {
      if (!FILTER_COLUMNS.has(key) || value === undefined || value === null || value === '') continue;
      clauses.push(`${key} = ?`);
      values.push(value);
    }
    if (RESOURCE_SCOPED_ENTITIES.has(entity) && context.resource_id) {
      clauses.push('resource_id = ?');
      values.push(String(context.resource_id));
    }
    if (context.member_id && ['profile','engagement','calendar','availability','assignment','shift','allocation','utilization'].includes(entity)) {
      clauses.push('member_id = ?');
      values.push(String(context.member_id));
    }
    if (context.member_id && entity === 'calendar_exception') {
      clauses.push('calendar_id IN (SELECT id FROM workforce_calendars WHERE organization_id = ? AND tenant_id = ? AND member_id = ?)');
      values.push(scope.organization_id, scope.tenant_id, String(context.member_id));
    }
    if (context.provider_user_id) {
      if (entity === 'member') {
        clauses.push('user_id = ?');
        values.push(String(context.provider_user_id));
      } else if (spec.fields.includes('member_id') || (spec.createOnlyFields || []).includes('member_id')) {
        clauses.push('member_id IN (SELECT id FROM workforce_members WHERE organization_id = ? AND tenant_id = ? AND user_id = ?)');
        values.push(scope.organization_id, scope.tenant_id, String(context.provider_user_id));
      } else if (entity === 'calendar_exception') {
        clauses.push('calendar_id IN (SELECT c.id FROM workforce_calendars c JOIN workforce_members m ON m.id = c.member_id WHERE c.organization_id = ? AND c.tenant_id = ? AND m.user_id = ?)');
        values.push(scope.organization_id, scope.tenant_id, String(context.provider_user_id));
      }
    }
    const limit = Math.min(200, Math.max(1, Number(filters?.limit) || 50));
    const offset = Math.max(0, Number(filters?.offset) || 0);
    const rows = this.db.prepare(`
      SELECT * FROM ${spec.table}
      WHERE ${clauses.join(' AND ')}
      ORDER BY updated_at DESC, id DESC
      LIMIT ? OFFSET ?
    `).all(...values, limit, offset);
    const records = rows.map((row) => fromDatabaseRow(row, spec.json));
    for (const record of records) {
      this.assertResourceVisibility(context, entity, record);
      this.assertAuthorized(context, entity, 'list', record);
    }
    return records;
  }

  summarizeUtilization(context = {}, filters = {}) {
    const scope = this.assertContext(context);
    this.assertAuthorized(context, 'utilization', 'list', null);

    const clauses = ['organization_id = ?', 'tenant_id = ?', 'chat_id = ?'];
    const values = [scope.organization_id, scope.tenant_id, scope.chat_id];
    for (const field of ['member_id','resource_id','booking_id','operational_task_id']) {
      const value = filters[field];
      if (value !== undefined && value !== null && value !== '') {
        clauses.push(`${field} = ?`);
        values.push(String(value));
      }
    }
    if (filters.status !== undefined && filters.status !== null && filters.status !== '') {
      if (!['PLANNED','IN_PROGRESS','COMPLETED','CANCELLED'].includes(String(filters.status))) {
        throw fail('WORKFORCE_ANALYTICS_FILTER_INVALID', 'status is not a valid utilization status');
      }
      clauses.push('status = ?');
      values.push(String(filters.status));
    }

    const from = filters.from == null || filters.from === '' ? null : String(filters.from);
    const to = filters.to == null || filters.to === '' ? null : String(filters.to);
    for (const [field, value] of [['from', from], ['to', to]]) {
      if (value !== null && (!Number.isFinite(Date.parse(value))
        || !/(Z|[+-]\d{2}:?\d{2})$/i.test(value))) {
        throw fail('WORKFORCE_ANALYTICS_RANGE_INVALID', `${field} must be ISO-8601 with an explicit timezone`);
      }
    }
    if (from && to && Date.parse(from) >= Date.parse(to)) {
      throw fail('WORKFORCE_ANALYTICS_RANGE_INVALID', 'from must be before to');
    }
    if (from) { clauses.push('planned_starts_at >= ?'); values.push(new Date(from).toISOString()); }
    if (to) { clauses.push('planned_starts_at < ?'); values.push(new Date(to).toISOString()); }

    if (context.resource_id) {
      clauses.push('resource_id = ?');
      values.push(String(context.resource_id));
    }
    if (context.member_id) {
      clauses.push('member_id = ?');
      values.push(String(context.member_id));
    }
    if (context.provider_user_id) {
      clauses.push('member_id IN (SELECT id FROM workforce_members WHERE organization_id = ? AND tenant_id = ? AND user_id = ?)');
      values.push(scope.organization_id, scope.tenant_id, String(context.provider_user_id));
    }

    const rows = this.db.prepare(`
      SELECT
        member_id,
        resource_id,
        COUNT(*) AS event_count,
        SUM(CASE WHEN julianday(planned_ends_at) > julianday(planned_starts_at)
          THEN (julianday(planned_ends_at) - julianday(planned_starts_at)) * 1440 ELSE 0 END) AS planned_minutes,
        SUM(CASE WHEN status = 'COMPLETED'
          AND actual_starts_at IS NOT NULL AND actual_ends_at IS NOT NULL
          AND julianday(actual_ends_at) > julianday(actual_starts_at)
          THEN (julianday(planned_ends_at) - julianday(planned_starts_at)) * 1440 ELSE 0 END) AS measured_planned_minutes,
        SUM(CASE WHEN status = 'COMPLETED'
          AND actual_starts_at IS NOT NULL AND actual_ends_at IS NOT NULL
          AND julianday(actual_ends_at) > julianday(actual_starts_at)
          THEN (julianday(actual_ends_at) - julianday(actual_starts_at)) * 1440 ELSE 0 END) AS actual_minutes,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_events,
        SUM(CASE WHEN status IN ('PLANNED','IN_PROGRESS') THEN 1 ELSE 0 END) AS open_events,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_events,
        SUM(CASE WHEN status = 'COMPLETED'
          AND (actual_starts_at IS NULL OR actual_ends_at IS NULL
            OR julianday(actual_ends_at) <= julianday(actual_starts_at))
          THEN 1 ELSE 0 END) AS completed_missing_actual_events
      FROM workforce_utilization_events
      WHERE ${clauses.join(' AND ')}
      GROUP BY member_id, resource_id
      ORDER BY member_id, resource_id
    `).all(...values);

    const metricFields = [
      'event_count','completed_events','open_events','cancelled_events','completed_missing_actual_events',
      'planned_minutes','measured_planned_minutes','actual_minutes',
    ];
    const normalizeRow = row => {
      const result = { member_id: row.member_id, resource_id: row.resource_id || null };
      for (const field of metricFields) result[field] = Number(row[field] || 0);
      result.variance_minutes = result.actual_minutes - result.measured_planned_minutes;
      return result;
    };
    const normalized = rows.map(normalizeRow);
    const aggregate = items => {
      const result = Object.fromEntries(metricFields.map(field => [
        field, items.reduce((sum, item) => sum + Number(item[field] || 0), 0),
      ]));
      result.variance_minutes = result.actual_minutes - result.measured_planned_minutes;
      for (const field of ['planned_minutes','measured_planned_minutes','actual_minutes','variance_minutes']) {
        result[field] = Math.round(result[field] * 100) / 100;
      }
      return result;
    };
    const groupBy = field => {
      const grouped = new Map();
      for (const item of normalized) {
        const key = item[field] == null ? '' : String(item[field]);
        const current = grouped.get(key) || {
          [field]: item[field] ?? null,
          ...Object.fromEntries(metricFields.map(name => [name, 0])),
        };
        for (const name of metricFields) current[name] += item[name];
        grouped.set(key, current);
      }
      return [...grouped.values()].map(item => ({
        ...item,
        variance_minutes: Math.round((item.actual_minutes - item.measured_planned_minutes) * 100) / 100,
        planned_minutes: Math.round(item.planned_minutes * 100) / 100,
        measured_planned_minutes: Math.round(item.measured_planned_minutes * 100) / 100,
        actual_minutes: Math.round(item.actual_minutes * 100) / 100,
      }));
    };

    const totals = aggregate(normalized);
    return Object.freeze({
      ...totals,
      by_member: groupBy('member_id'),
      by_resource: groupBy('resource_id'),
      range: Object.freeze({ from, to, basis: 'planned_starts_at' }),
      authority: 'workforce_utilization_events',
    });
  }

  generateShiftsFromTemplate(templateId, input = {}, context = {}) {
    const scope = this.assertContext(context);
    const template = this.get('shift_template', templateId, context);
    this.assertAuthorized(context, 'shift_template', 'generate', template);
    if (template.status !== 'ACTIVE') throw fail('WORKFORCE_SHIFT_TEMPLATE_INACTIVE', 'Only active shift templates can generate dated shifts', 409);
    const expectedVersion = Number(input.expected_version);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      throw fail('WORKFORCE_EXPECTED_VERSION_REQUIRED', 'expected_version must be a positive integer');
    }
    if (Number(template.version) !== expectedVersion) {
      throw fail('WORKFORCE_VERSION_CONFLICT', 'Shift template changed since it was loaded', 409);
    }
    const memberId = typeof input.member_id === 'string' ? input.member_id.trim() : '';
    if (!memberId) throw fail('WORKFORCE_MEMBER_ID_REQUIRED', 'member_id is required to generate dated shifts');
    const member = this.get('member', memberId, context);
    if (member.status !== 'ACTIVE') throw fail('WORKFORCE_MEMBER_NOT_ELIGIBLE', 'Only active Workforce members can receive generated shifts', 409);
    if (template.department_id && String(member.department_id || '') !== String(template.department_id)) {
      throw fail('WORKFORCE_MEMBER_DEPARTMENT_MISMATCH', 'Member department does not match the shift template', 409);
    }
    if (template.position_id && String(member.position_id || '') !== String(template.position_id)) {
      throw fail('WORKFORCE_MEMBER_POSITION_MISMATCH', 'Member position does not match the shift template', 409);
    }
    const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      && Number.isFinite(Date.parse(value + 'T00:00:00Z'))
      && new Date(value + 'T00:00:00Z').toISOString().slice(0,10) === value;
    const fromDate = input.from_date;
    const toDate = input.to_date;
    if (!validDate(fromDate) || !validDate(toDate) || fromDate > toDate) {
      throw fail('WORKFORCE_SHIFT_GENERATION_RANGE_INVALID', 'from_date and to_date must be valid ascending YYYY-MM-DD dates');
    }
    const dayCount = Math.floor((Date.parse(toDate + 'T00:00:00Z') - Date.parse(fromDate + 'T00:00:00Z')) / 86400000) + 1;
    if (dayCount > 31) throw fail('WORKFORCE_SHIFT_GENERATION_RANGE_TOO_LARGE', 'A single generation request may cover at most 31 calendar days', 422);
    const key = typeof input.idempotency_key === 'string' ? input.idempotency_key.trim() : '';
    if (!key || key.length > 160) throw fail('WORKFORCE_IDEMPOTENCY_KEY_INVALID', 'A valid idempotency key of at most 160 characters is required');
    if (input.location_id && template.location_id && String(input.location_id) !== String(template.location_id)) {
      throw fail('WORKFORCE_TEMPLATE_LOCATION_MISMATCH', 'Requested location does not match the template location', 422);
    }
    const locationId = template.location_id || input.location_id || member.primary_location_id || null;
    if (locationId) {
      const location = this.db.prepare('SELECT id FROM locations WHERE id=? AND organization_id=?')
        .get(String(locationId), scope.organization_id);
      if (!location) throw fail('WORKFORCE_LOCATION_SCOPE_INVALID', 'Generation location is outside the active organization', 422);
    }

    const createdRecords = [], existingRecords = [], conflicts = [], skipped = [];
    const workDays = Array.isArray(template.work_days) ? template.work_days : [1,2,3,4,5];
    for (let offset = 0; offset < dayCount; offset++) {
      const localDate = new Date(Date.parse(fromDate + 'T00:00:00Z') + offset * 86400000).toISOString().slice(0,10);
      if (!workDays.includes(isoWeekday(localDate))) {
        skipped.push({ local_date: localDate, reason: 'NON_WORKING_DAY' });
        continue;
      }
      if (localDate < template.effective_from || (template.effective_until && localDate > template.effective_until)) {
        skipped.push({ local_date: localDate, reason: 'OUTSIDE_TEMPLATE_EFFECTIVE_DATES' });
        continue;
      }
      const window = buildShiftWindowFromTemplate(template, localDate);
      const existing = this.db.prepare(`
        SELECT * FROM workforce_shifts
        WHERE organization_id=? AND tenant_id=? AND shift_template_id=? AND member_id=? AND generated_local_date=?
      `).get(scope.organization_id, scope.tenant_id, String(template.id), memberId, localDate);
      if (existing) {
        existingRecords.push(fromDatabaseRow(existing, TABLES.shift.json));
        continue;
      }
      if (locationId && String(member.primary_location_id || '') !== String(locationId)) {
        const assigned = this.db.prepare(`
          SELECT id FROM workforce_assignments
          WHERE organization_id=? AND tenant_id=? AND chat_id=? AND member_id=?
            AND assignment_type='LOCATION' AND location_id=? AND status='ACTIVE'
            AND starts_at<=? AND ends_at>=?
          LIMIT 1
        `).get(scope.organization_id, scope.tenant_id, scope.chat_id, memberId, String(locationId), window.starts_at, window.ends_at);
        if (!assigned) {
          skipped.push({ local_date: localDate, reason: 'LOCATION_ASSIGNMENT_REQUIRED' });
          continue;
        }
      }
      const engagement = this.db.prepare(`
        SELECT id FROM workforce_engagements
        WHERE organization_id=? AND tenant_id=? AND chat_id=? AND member_id=? AND status='ACTIVE'
          AND starts_at<=? AND (ends_at IS NULL OR ends_at>=?)
        ORDER BY starts_at DESC LIMIT 1
      `).get(scope.organization_id, scope.tenant_id, scope.chat_id, memberId, window.starts_at, window.ends_at);
      if (!engagement) {
        skipped.push({ local_date: localDate, reason: 'ACTIVE_ENGAGEMENT_REQUIRED' });
        continue;
      }
      const overlapping = this.db.prepare(`
        SELECT id, starts_at, ends_at, status FROM workforce_shifts
        WHERE organization_id=? AND tenant_id=? AND chat_id=? AND member_id=?
          AND status<>'CANCELLED' AND starts_at<? AND ends_at>?
        ORDER BY starts_at LIMIT 10
      `).all(scope.organization_id, scope.tenant_id, scope.chat_id, memberId, window.ends_at, window.starts_at);
      if (overlapping.length) {
        conflicts.push({ local_date: localDate, reason: 'SHIFT_OVERLAP', existing_shifts: overlapping });
        continue;
      }
      const perShiftKey = key + ':' + localDate;
      if (perShiftKey.length > 200) throw fail('WORKFORCE_IDEMPOTENCY_KEY_INVALID', 'Derived shift idempotency key is too long');
      try {
        const result = this.create('shift', {
          idempotency_key: perShiftKey,
          member_id: memberId,
          location_id: locationId,
          starts_at: window.starts_at,
          ends_at: window.ends_at,
          timezone: window.timezone,
          break_rules: window.break_rules,
          shift_template_id: template.id,
          template_version: template.version,
          generated_local_date: localDate,
        }, context);
        if (result.duplicate) existingRecords.push(result.record);
        else {
          createdRecords.push(result.record);
          this.writeAudit(scope, 'shift', result.record.id, 'generated_from_template', {
            shift_template_id: template.id, template_version: template.version, generated_local_date: localDate,
          }, context);
        }
      } catch (error) {
        if (error.code !== 'WORKFORCE_CONSTRAINT_CONFLICT') throw error;
        const raced = this.db.prepare(`
          SELECT * FROM workforce_shifts
          WHERE organization_id=? AND tenant_id=? AND shift_template_id=? AND member_id=? AND generated_local_date=?
        `).get(scope.organization_id, scope.tenant_id, String(template.id), memberId, localDate);
        if (!raced) throw error;
        existingRecords.push(fromDatabaseRow(raced, TABLES.shift.json));
      }
    }
    return Object.freeze({
      template_id: template.id,
      template_version: template.version,
      member_id: memberId,
      range: Object.freeze({ from: fromDate, to: toDate, timezone: template.timezone }),
      created_records: createdRecords,
      existing_records: existingRecords,
      conflicts,
      skipped,
      created_count: createdRecords.length,
      existing_count: existingRecords.length,
      conflict_count: conflicts.length,
      skipped_count: skipped.length,
    });
  }

  create(entity, input = {}, context = {}) {
    const spec = TABLES[entity];
    if (!spec) throw fail('WORKFORCE_ENTITY_INVALID', `Unsupported Workforce entity: ${entity}`);
    const scope = this.assertContext(context);
    const payload = { ...input };
    const validation = validateWorkforceRepositoryOperation(entity, 'create', {
      ...scope, idempotency_key: payload.idempotency_key,
    });
    if (!validation.valid) throw fail('WORKFORCE_CREATE_INVALID', validation.errors.join('; '));
    const data = {};
    for (const field of [...(spec.createOnlyFields || []), ...spec.fields]) if (Object.hasOwn(payload, field)) data[databaseColumn(field, spec.json)] = normalizeRepositoryValue(databaseColumn(field, spec.json), payload[field]);
    this.assertReferences(entity, data, scope, payload.id || null);
    const requestHash = fingerprint({ entity, data });
    const existing = this.db.prepare(`
      SELECT * FROM ${spec.table}
      WHERE organization_id = ? AND tenant_id = ? AND idempotency_key = ?
    `).get(scope.organization_id, scope.tenant_id, String(payload.idempotency_key));
    if (existing) {
      if (existing.request_hash !== requestHash) {
        throw fail('WORKFORCE_IDEMPOTENCY_CONFLICT', 'Idempotency key was already used with different Workforce data', 409);
      }
      const record = fromDatabaseRow(existing, spec.json);
      this.assertResourceVisibility(context, entity, record);
      this.assertAuthorized(context, entity, 'create', record);
      return { record, duplicate: true };
    }

    const id = String(payload.id || this.idFactory());
    const now = this.clock();
    const columns = [
      'id','organization_id','tenant_id','chat_id',...Object.keys(data),
      ...(spec.state ? [spec.state] : []),
      'idempotency_key','request_hash','created_by','updated_by','created_at','updated_at','version',
    ];
    const values = [
      id,scope.organization_id,scope.tenant_id,scope.chat_id,
      ...Object.entries(data).map(([key,value]) => toDatabaseValue(value,key,spec.json)),
      ...(spec.state ? [INITIAL_STATES[entity]] : []),
      String(payload.idempotency_key),requestHash,context.actor_id || null,context.actor_id || null,now,now,1,
    ];
    const recordForAuthorization = {
      id,organization_id:scope.organization_id,tenant_id:scope.tenant_id,chat_id:scope.chat_id,
      ...data,...(spec.state ? { [spec.state]: INITIAL_STATES[entity] } : {}),version:1,
    };
    this.assertResourceVisibility(context, entity, recordForAuthorization);
    this.assertAuthorized(context, entity, 'create', recordForAuthorization);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const race = this.db.prepare(`
        SELECT * FROM ${spec.table}
        WHERE organization_id = ? AND tenant_id = ? AND idempotency_key = ?
      `).get(scope.organization_id, scope.tenant_id, String(payload.idempotency_key));
      if (race) {
        if (race.request_hash !== requestHash) throw fail('WORKFORCE_IDEMPOTENCY_CONFLICT', 'Idempotency key was already used with different Workforce data', 409);
        const duplicateRecord = fromDatabaseRow(race, spec.json);
        this.assertResourceVisibility(context, entity, duplicateRecord);
        this.assertAuthorized(context, entity, 'create', duplicateRecord);
        this.db.exec('COMMIT');
        return { record: duplicateRecord, duplicate: true };
      }
      const placeholders = columns.map(() => '?').join(', ');
      this.db.prepare(`INSERT INTO ${spec.table} (${columns.join(', ')}) VALUES (${placeholders})`).run(...values);
      this.writeAudit(scope, entity, id, 'created', { version: 1 }, context);
      const row = this.db.prepare(`
        SELECT * FROM ${spec.table}
        WHERE id = ? AND organization_id = ? AND tenant_id = ? AND chat_id = ?
      `).get(id,scope.organization_id,scope.tenant_id,scope.chat_id);
      this.db.exec('COMMIT');
      return { record: fromDatabaseRow(row, spec.json), duplicate: false };
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      if (String(error?.code || '').startsWith('SQLITE_CONSTRAINT') || (Number.isInteger(Number(error?.errcode)) && (Number(error.errcode) & 0xff) === 19)) {
        throw fail('WORKFORCE_CONSTRAINT_CONFLICT', 'Workforce data conflicts with an existing scoped record or canonical reference', 409);
      }
      throw error;
    }
  }

  update(entity, id, input = {}, context = {}) {
    const spec = TABLES[entity];
    if (!spec) throw fail('WORKFORCE_ENTITY_INVALID', `Unsupported Workforce entity: ${entity}`);
    const scope = this.assertContext(context);
    const expected = Number(input.expected_version);
    const validation = validateWorkforceRepositoryOperation(entity, 'update', { ...scope, expected_version: expected });
    if (!validation.valid) throw fail('WORKFORCE_UPDATE_INVALID', validation.errors.join('; '));
    const existing = this.getForMutation(entity, id, scope, context, 'update');
    if (Number(existing.version) !== expected) throw fail('WORKFORCE_VERSION_CONFLICT', 'Workforce record changed since it was loaded', 409);
    const data = {};
    for (const field of spec.fields) if (Object.hasOwn(input, field)) data[databaseColumn(field, spec.json)] = normalizeRepositoryValue(databaseColumn(field, spec.json), input[field]);
    if (Object.keys(data).length === 0) throw fail('WORKFORCE_UPDATE_EMPTY', 'At least one mutable Workforce field is required');
    const referenceData = { ...existing, ...data };
    if (entity === 'member' && !Object.hasOwn(data, 'user_id')) delete referenceData.user_id;
    this.assertReferences(entity, referenceData, scope, String(id));
    const now = this.clock();
    const assignments = Object.keys(data).map((key) => `${key} = ?`);
    const values = Object.entries(data).map(([key,value]) => toDatabaseValue(value,key,spec.json));
    assignments.push('updated_by = ?','updated_at = ?','version = version + 1');
    values.push(context.actor_id || null,now,String(id),scope.organization_id,scope.tenant_id,scope.chat_id,expected);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = this.db.prepare(`
        UPDATE ${spec.table} SET ${assignments.join(', ')}
        WHERE id = ? AND organization_id = ? AND tenant_id = ? AND chat_id = ? AND version = ?
      `).run(...values);
      if (Number(result.changes) !== 1) throw fail('WORKFORCE_VERSION_CONFLICT', 'Workforce record changed since it was loaded', 409);
      this.writeAudit(scope, entity, String(id), 'updated', { version: expected + 1 }, context);
      if (entity === 'member' && Object.hasOwn(data, 'supervisor_member_id')) {
        this.writeAudit(scope, entity, String(id), 'reporting_relationship_changed', { from: existing.supervisor_member_id || null, to: data.supervisor_member_id || null, version: expected + 1 }, context);
      }
      const row = this.db.prepare(`
        SELECT * FROM ${spec.table}
        WHERE id = ? AND organization_id = ? AND tenant_id = ? AND chat_id = ?
      `).get(String(id),scope.organization_id,scope.tenant_id,scope.chat_id);
      this.db.exec('COMMIT');
      return fromDatabaseRow(row, spec.json);
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      throw error;
    }
  }

  getForMutation(entity, id, scope, context, operation) {
    const spec = TABLES[entity];
    const row = this.db.prepare(`
      SELECT * FROM ${spec.table}
      WHERE id = ? AND organization_id = ? AND tenant_id = ? AND chat_id = ?
    `).get(String(id),scope.organization_id,scope.tenant_id,scope.chat_id);
    if (!row) throw scopedError();
    const record = fromDatabaseRow(row, spec.json);
    this.assertResourceVisibility(context, entity, record);
    this.assertAuthorized(context, entity, operation, record);
    return record;
  }

  linkAccount(entity, id, input = {}, context = {}) {
    if (entity !== 'member') throw fail('WORKFORCE_ENTITY_INVALID', 'Account links are supported only for Workforce members');
    const scope = this.assertContext(context);
    const expected = Number(input.expected_version);
    const validation = validateWorkforceRepositoryOperation('member', 'link_account', {
      ...scope, expected_version: expected,
    });
    if (!validation.valid) throw fail('WORKFORCE_ACCOUNT_LINK_INVALID', validation.errors.join('; '));
    if (typeof input.user_id !== 'string' || !input.user_id.trim()) {
      throw fail('WORKFORCE_USER_ID_REQUIRED', 'user_id is required to link an existing account', 400);
    }

    const userId = input.user_id.trim();
    const record = this.getForMutation('member', id, scope, context, 'link_account');
    if (Number(record.version) !== expected) {
      throw fail('WORKFORCE_VERSION_CONFLICT', 'Workforce record changed since it was loaded', 409);
    }
    if (record.user_id) {
      throw fail('WORKFORCE_ACCOUNT_ALREADY_LINKED', 'Workforce member already has a linked account', 409);
    }

    const now = this.clock();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.assertReferences('member', { user_id: userId }, scope);
      const existingLink = this.db.prepare(`
        SELECT id FROM workforce_members
        WHERE organization_id = ? AND tenant_id = ? AND user_id = ? AND id <> ?
        LIMIT 1
      `).get(scope.organization_id, scope.tenant_id, userId, String(id));
      if (existingLink) {
        throw fail('WORKFORCE_USER_ALREADY_LINKED', 'This Sellify user is already linked to another Workforce member in this organization', 409);
      }

      const result = this.db.prepare(`
        UPDATE workforce_members
        SET user_id = ?, updated_by = ?, updated_at = ?, version = version + 1
        WHERE id = ? AND organization_id = ? AND tenant_id = ? AND chat_id = ?
          AND version = ? AND user_id IS NULL
      `).run(userId, context.actor_id || null, now, String(id),
        scope.organization_id, scope.tenant_id, scope.chat_id, expected);
      if (Number(result.changes) !== 1) {
        throw fail('WORKFORCE_VERSION_CONFLICT', 'Workforce record changed since it was loaded', 409);
      }
      this.writeAudit(scope, 'member', String(id), 'account_linked', {
        user_id: userId, version: expected + 1,
      }, context);
      const row = this.db.prepare(`
        SELECT * FROM workforce_members
        WHERE id = ? AND organization_id = ? AND tenant_id = ? AND chat_id = ?
      `).get(String(id), scope.organization_id, scope.tenant_id, scope.chat_id);
      this.db.exec('COMMIT');
      return fromDatabaseRow(row, TABLES.member.json);
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      if (String(error?.code || '').startsWith('SQLITE_CONSTRAINT') || (Number.isInteger(Number(error?.errcode)) && (Number(error.errcode) & 0xff) === 19)) {
        throw fail('WORKFORCE_CONSTRAINT_CONFLICT', 'Workforce account link conflicts with an existing scoped record or canonical reference', 409);
      }
      throw error;
    }
  }

  unlinkAccount(entity, id, input = {}, context = {}) {
    if (entity !== 'member') throw fail('WORKFORCE_ENTITY_INVALID', 'Account links are supported only for Workforce members');
    const scope = this.assertContext(context);
    const expected = Number(input.expected_version);
    const validation = validateWorkforceRepositoryOperation('member', 'unlink_account', {
      ...scope, expected_version: expected,
    });
    if (!validation.valid) throw fail('WORKFORCE_ACCOUNT_UNLINK_INVALID', validation.errors.join('; '));

    const record = this.getForMutation('member', id, scope, context, 'unlink_account');
    if (Number(record.version) !== expected) {
      throw fail('WORKFORCE_VERSION_CONFLICT', 'Workforce record changed since it was loaded', 409);
    }
    if (!record.user_id) {
      throw fail('WORKFORCE_ACCOUNT_NOT_LINKED', 'Workforce member has no linked Sellify account', 409);
    }

    const now = this.clock();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = this.db.prepare(`
        UPDATE workforce_members
        SET user_id = NULL, updated_by = ?, updated_at = ?, version = version + 1
        WHERE id = ? AND organization_id = ? AND tenant_id = ? AND chat_id = ?
          AND version = ? AND user_id = ?
      `).run(context.actor_id || null, now, String(id),
        scope.organization_id, scope.tenant_id, scope.chat_id, expected, String(record.user_id));
      if (Number(result.changes) !== 1) {
        throw fail('WORKFORCE_VERSION_CONFLICT', 'Workforce record changed since it was loaded', 409);
      }
      this.writeAudit(scope, 'member', String(id), 'account_unlinked', {
        previous_user_id: record.user_id, version: expected + 1,
      }, context);
      const row = this.db.prepare(`
        SELECT * FROM workforce_members
        WHERE id = ? AND organization_id = ? AND tenant_id = ? AND chat_id = ?
      `).get(String(id), scope.organization_id, scope.tenant_id, scope.chat_id);
      this.db.exec('COMMIT');
      return fromDatabaseRow(row, TABLES.member.json);
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      throw error;
    }
  }

  listShiftHistory(entity, id, context = {}) {
    if (entity !== 'shift') throw fail('WORKFORCE_ENTITY_INVALID', 'Shift history is supported only for dated shifts');
    const scope = this.assertContext(context);
    this.getForMutation('shift', id, scope, context, 'get');
    const rows = this.db.prepare(`
      SELECT action, entity_type, entity_id, metadata_json, created_at
      FROM audit_events
      WHERE chat_id = ? AND organization_id = ?
        AND entity_type = 'workforce_shift' AND entity_id = ?
        AND action LIKE 'workforce.shift.%'
      ORDER BY id ASC LIMIT 100
    `).all(scope.chat_id, scope.organization_id, String(id));
    return rows.map(row => {
      let metadata = {};
      try { metadata = JSON.parse(row.metadata_json || '{}'); } catch {}
      if (String(metadata.tenant_id || '') !== scope.tenant_id) return null;
      return { action: row.action, created_at: row.created_at, metadata };
    }).filter(Boolean);
  }

  reassignShift(entity, id, input = {}, context = {}) {
    if (entity !== 'shift') throw fail('WORKFORCE_ENTITY_INVALID', 'Reassignment is supported only for dated shifts');
    const scope = this.assertContext(context);
    const expected = Number(input.expected_version);
    const memberId = typeof input.member_id === 'string' ? input.member_id.trim() : '';
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    const validation = validateWorkforceRepositoryOperation('shift', 'update', { ...scope, expected_version: expected });
    if (!validation.valid) throw fail('WORKFORCE_SHIFT_REASSIGNMENT_INVALID', validation.errors.join('; '));
    if (!memberId) throw fail('WORKFORCE_MEMBER_ID_REQUIRED', 'member_id is required to reassign a dated shift');
    if (!reason || reason.length > 500) throw fail('WORKFORCE_SHIFT_REASSIGNMENT_REASON_REQUIRED', 'A reassignment reason of 1 to 500 characters is required');
    const existing = this.getForMutation('shift', id, scope, context, 'update');
    if (Number(existing.version) !== expected) throw fail('WORKFORCE_VERSION_CONFLICT', 'Workforce record changed since it was loaded', 409);
    if (!['PLANNED', 'CONFIRMED'].includes(String(existing.status))) {
      throw fail('WORKFORCE_SHIFT_REASSIGNMENT_STATE_INVALID', 'Only planned or confirmed shifts can be reassigned', 409);
    }
    if (String(existing.member_id) === memberId) throw fail('WORKFORCE_SHIFT_REASSIGNMENT_UNCHANGED', 'The selected professional already owns this shift');

    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.getForMutation('shift', id, scope, context, 'update');
      if (Number(current.version) !== expected) throw fail('WORKFORCE_VERSION_CONFLICT', 'Workforce record changed since it was loaded', 409);
      if (!['PLANNED', 'CONFIRMED'].includes(String(current.status))) {
        throw fail('WORKFORCE_SHIFT_REASSIGNMENT_STATE_INVALID', 'Only planned or confirmed shifts can be reassigned', 409);
      }
      const member = this.db.prepare(`
        SELECT * FROM workforce_members
        WHERE id = ? AND organization_id = ? AND tenant_id = ? AND chat_id = ?
      `).get(memberId, scope.organization_id, scope.tenant_id, scope.chat_id);
      if (!member) throw fail('WORKFORCE_MEMBER_SCOPE_INVALID', 'Replacement professional is outside the active organization and tenant', 422);
      if (String(member.status) !== 'ACTIVE') throw fail('WORKFORCE_MEMBER_NOT_ELIGIBLE', 'Only active Workforce members can receive a reassigned shift', 409);
      if (current.shift_template_id) {
        const template = this.db.prepare(`
          SELECT department_id, position_id FROM workforce_shift_templates
          WHERE id = ? AND organization_id = ? AND tenant_id = ? AND chat_id = ?
        `).get(String(current.shift_template_id), scope.organization_id, scope.tenant_id, scope.chat_id);
        if (!template) throw fail('WORKFORCE_SHIFT_TEMPLATE_SCOPE_INVALID', 'The shift template is outside the active organization and tenant', 422);
        if (template.department_id && String(member.department_id || '') !== String(template.department_id)) {
          throw fail('WORKFORCE_MEMBER_DEPARTMENT_MISMATCH', 'Replacement professional does not match the shift department', 409);
        }
        if (template.position_id && String(member.position_id || '') !== String(template.position_id)) {
          throw fail('WORKFORCE_MEMBER_POSITION_MISMATCH', 'Replacement professional does not match the shift position', 409);
        }
      }
      if (current.location_id && String(member.primary_location_id || '') !== String(current.location_id)) {
        const assignment = this.db.prepare(`
          SELECT id FROM workforce_assignments
          WHERE organization_id = ? AND tenant_id = ? AND chat_id = ? AND member_id = ?
            AND assignment_type = 'LOCATION' AND location_id = ? AND status = 'ACTIVE'
            AND starts_at <= ? AND ends_at >= ? LIMIT 1
        `).get(scope.organization_id, scope.tenant_id, scope.chat_id, memberId,
          String(current.location_id), current.starts_at, current.ends_at);
        if (!assignment) throw fail('WORKFORCE_LOCATION_ASSIGNMENT_REQUIRED', 'Replacement professional must be assigned to the shift location for its full duration', 409);
      }
      const engagement = this.db.prepare(`
        SELECT id FROM workforce_engagements
        WHERE organization_id = ? AND tenant_id = ? AND chat_id = ? AND member_id = ? AND status = 'ACTIVE'
          AND starts_at <= ? AND (ends_at IS NULL OR ends_at >= ?)
        ORDER BY starts_at DESC LIMIT 1
      `).get(scope.organization_id, scope.tenant_id, scope.chat_id, memberId, current.starts_at, current.ends_at);
      if (!engagement) throw fail('WORKFORCE_ACTIVE_ENGAGEMENT_REQUIRED', 'Replacement professional needs an active engagement covering the full shift', 409);
      const overlapping = this.db.prepare(`
        SELECT id, starts_at, ends_at, status FROM workforce_shifts
        WHERE organization_id = ? AND tenant_id = ? AND chat_id = ? AND member_id = ?
          AND id <> ? AND status <> 'CANCELLED' AND starts_at < ? AND ends_at > ?
        ORDER BY starts_at LIMIT 10
      `).all(scope.organization_id, scope.tenant_id, scope.chat_id, memberId,
        String(id), current.ends_at, current.starts_at);
      if (overlapping.length) throw fail('WORKFORCE_CONSTRAINT_CONFLICT', 'Replacement professional has an overlapping dated shift', 409);
      const now = this.clock();
      const result = this.db.prepare(`
        UPDATE workforce_shifts SET member_id = ?, updated_by = ?, updated_at = ?, version = version + 1
        WHERE id = ? AND organization_id = ? AND tenant_id = ? AND chat_id = ? AND version = ? AND member_id = ?
      `).run(memberId, context.actor_id || null, now, String(id),
        scope.organization_id, scope.tenant_id, scope.chat_id, expected, String(current.member_id));
      if (Number(result.changes) !== 1) throw fail('WORKFORCE_VERSION_CONFLICT', 'Workforce record changed since it was loaded', 409);
      this.writeAudit(scope, 'shift', String(id), 'reassigned', {
        from_member_id: current.member_id, to_member_id: memberId, reason, version: expected + 1,
      }, context);
      const row = this.db.prepare(`
        SELECT * FROM workforce_shifts WHERE id = ? AND organization_id = ? AND tenant_id = ? AND chat_id = ?
      `).get(String(id), scope.organization_id, scope.tenant_id, scope.chat_id);
      this.db.exec('COMMIT');
      return fromDatabaseRow(row, TABLES.shift.json);
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      throw error;
    }
  }

  transition(entity, operation, id, input = {}, context = {}) {
    const spec = TABLES[entity];
    const transition = TRANSITIONS[entity]?.[operation];
    if (!spec || !spec.state || !transition) {
      throw fail('WORKFORCE_LIFECYCLE_OPERATION_INVALID', `Unsupported lifecycle operation ${operation} for ${entity}`);
    }
    const scope = this.assertContext(context);
    const expected = Number(input.expected_version);
    const validation = validateWorkforceRepositoryOperation(entity, operation, { ...scope, expected_version: expected });
    if (!validation.valid) throw fail('WORKFORCE_LIFECYCLE_INVALID', validation.errors.join('; '));
    const record = this.getForMutation(entity, id, scope, context, operation);
    if (!transition.from.includes(record[spec.state])) {
      throw fail('WORKFORCE_LIFECYCLE_CONFLICT', `Cannot ${operation} ${entity} from ${record[spec.state]}`, 409);
    }
    if (Number(record.version) !== expected) throw fail('WORKFORCE_VERSION_CONFLICT', 'Workforce record changed since it was loaded', 409);
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if (entity === 'shift' && operation === 'cancel' && (!reason || reason.length > 500)) {
      throw fail('WORKFORCE_SHIFT_CANCELLATION_REASON_REQUIRED', 'A cancellation reason of 1 to 500 characters is required');
    }
    if (entity === 'member' && ['suspend','deactivate'].includes(operation)) {
      const reports = this.db.prepare("SELECT COUNT(*) AS count FROM workforce_members WHERE organization_id=? AND tenant_id=? AND supervisor_member_id=? AND status='ACTIVE'")
        .get(scope.organization_id, scope.tenant_id, String(id)).count;
      if (Number(reports)) throw fail('WORKFORCE_SUPERVISOR_HAS_ACTIVE_REPORTS', 'Reassign active direct reports before suspending or deactivating this supervisor', 409);
    }
    if (entity === 'department' && operation === 'deactivate') {
      const members = this.db.prepare("SELECT COUNT(*) AS count FROM workforce_members WHERE organization_id=? AND tenant_id=? AND department_id=? AND status='ACTIVE'")
        .get(scope.organization_id, scope.tenant_id, String(id)).count;
      const positions = this.db.prepare("SELECT COUNT(*) AS count FROM workforce_positions WHERE organization_id=? AND tenant_id=? AND department_id=? AND status='ACTIVE'")
        .get(scope.organization_id, scope.tenant_id, String(id)).count;
      if (Number(members) || Number(positions)) throw fail('WORKFORCE_DEPARTMENT_HAS_ACTIVE_ASSIGNMENTS', 'Reassign active members and positions before deactivating this department', 409);
      const templates = this.db.prepare("SELECT COUNT(*) AS count FROM workforce_shift_templates WHERE organization_id=? AND tenant_id=? AND department_id=? AND status='ACTIVE'")
        .get(scope.organization_id, scope.tenant_id, String(id)).count;
      if (Number(templates)) throw fail('WORKFORCE_DEPARTMENT_HAS_ACTIVE_SHIFT_TEMPLATES', 'Deactivate or reassign active shift templates before deactivating this department', 409);
    }
    if (entity === 'position' && operation === 'deactivate') {
      const members = this.db.prepare("SELECT COUNT(*) AS count FROM workforce_members WHERE organization_id=? AND tenant_id=? AND position_id=? AND status='ACTIVE'")
        .get(scope.organization_id, scope.tenant_id, String(id)).count;
      if (Number(members)) throw fail('WORKFORCE_POSITION_HAS_ACTIVE_ASSIGNMENTS', 'Reassign active members before deactivating this position', 409);
      const templates = this.db.prepare("SELECT COUNT(*) AS count FROM workforce_shift_templates WHERE organization_id=? AND tenant_id=? AND position_id=? AND status='ACTIVE'")
        .get(scope.organization_id, scope.tenant_id, String(id)).count;
      if (Number(templates)) throw fail('WORKFORCE_POSITION_HAS_ACTIVE_SHIFT_TEMPLATES', 'Deactivate or reassign active shift templates before deactivating this position', 409);
    }
    const now = this.clock();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = this.db.prepare(`
        UPDATE ${spec.table}
        SET ${spec.state} = ?, updated_by = ?, updated_at = ?, version = version + 1
        WHERE id = ? AND organization_id = ? AND tenant_id = ? AND chat_id = ? AND version = ? AND ${spec.state} = ?
      `).run(transition.to,context.actor_id || null,now,String(id),scope.organization_id,scope.tenant_id,scope.chat_id,expected,record[spec.state]);
      if (Number(result.changes) !== 1) throw fail('WORKFORCE_VERSION_CONFLICT', 'Workforce record changed since it was loaded', 409);
      this.writeAudit(scope, entity, String(id), operation, { from: record[spec.state], to: transition.to, version: expected + 1, ...(reason ? { reason } : {}) }, context);
      const row = this.db.prepare(`
        SELECT * FROM ${spec.table}
        WHERE id = ? AND organization_id = ? AND tenant_id = ? AND chat_id = ?
      `).get(String(id),scope.organization_id,scope.tenant_id,scope.chat_id);
      this.db.exec('COMMIT');
      return fromDatabaseRow(row, spec.json);
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      throw error;
    }
  }

  writeAudit(scope, entity, id, action, metadata, context) {
    this.db.prepare(`
      INSERT INTO audit_events
        (chat_id, action, entity_type, entity_id, metadata_json, created_at, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(scope.chat_id,`workforce.${entity}.${action}`,`workforce_${entity}`,id,
      JSON.stringify({ ...metadata, tenant_id: scope.tenant_id, actor_id: context.actor_id || null }),
      this.clock(),scope.organization_id);
  }

  activate(entity, id, input = {}, context = {}) { return this.transition(entity, 'activate', id, input, context); }
  suspend(entity, id, input = {}, context = {}) { return this.transition(entity, 'suspend', id, input, context); }
  deactivate(entity, id, input = {}, context = {}) { return this.transition(entity, 'deactivate', id, input, context); }
  release(entity, id, input = {}, context = {}) { return this.transition(entity, 'release', id, input, context); }
  cancel(entity, id, input = {}, context = {}) { return this.transition(entity, 'cancel', id, input, context); }
  submit(entity, id, input = {}, context = {}) { return this.transition(entity, 'submit', id, input, context); }
  approve(entity, id, input = {}, context = {}) { return this.transition(entity, 'approve', id, input, context); }
  confirm(entity, id, input = {}, context = {}) { return this.transition(entity, 'confirm', id, input, context); }
  start(entity, id, input = {}, context = {}) { return this.transition(entity, 'start', id, input, context); }
  complete(entity, id, input = {}, context = {}) { return this.transition(entity, 'complete', id, input, context); }
  end(entity, id, input = {}, context = {}) { return this.transition(entity, 'end', id, input, context); }
}
