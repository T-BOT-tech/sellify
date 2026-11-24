import crypto from 'node:crypto';
import {
  WORKFORCE_REPOSITORY_ENTITY_OPERATIONS,
  validateWorkforceRepositoryOperation,
} from './workforce-repository-contract.js';

const TABLES = Object.freeze({
  member: {
    table: 'workforce_members', id: 'id', state: 'status',
    fields: ['user_id','member_type','primary_location_id','timezone','display_name'],
    json: [],
  },
  profile: {
    table: 'workforce_profiles', id: 'id',
    fields: ['member_id','skills_json','qualifications_json','languages_json','service_capabilities_json','visibility','notes','effective_from','effective_until'],
    json: ['skills_json','qualifications_json','languages_json','service_capabilities_json'],
  },
  engagement: {
    table: 'workforce_engagements', id: 'id', state: 'status',
    fields: ['member_id','engagement_type','starts_at','ends_at','approver_user_id','terms_reference'],
    json: [],
  },
  calendar: {
    table: 'workforce_calendars', id: 'id', state: 'status',
    fields: ['member_id','location_id','timezone','weekly_schedule_json','holiday_calendar_json','effective_from','effective_until'],
    json: ['weekly_schedule_json','holiday_calendar_json'],
  },
  calendar_exception: {
    table: 'workforce_calendar_exceptions', id: 'id', state: 'status',
    fields: ['calendar_id','exception_type','starts_at','ends_at','all_day','reason'],
    json: [],
  },
  availability: {
    table: 'workforce_availability_windows', id: 'id', state: 'status',
    fields: ['member_id','resource_id','location_id','availability','starts_at','ends_at','timezone','recurrence_rule','effective_from','effective_until'],
    json: [],
  },
  assignment: {
    table: 'workforce_assignments', id: 'id', state: 'status',
    fields: ['member_id','resource_id','location_id','assignment_type','starts_at','ends_at','booking_id','operational_task_id'],
    json: [],
  },
  shift: {
    table: 'workforce_shifts', id: 'id', state: 'status',
    fields: ['member_id','resource_id','location_id','starts_at','ends_at','timezone','break_rules_json','recurrence_source_id','assignment_source_id'],
    json: ['break_rules_json'],
  },
  allocation: {
    table: 'workforce_allocations', id: 'id', state: 'state',
    fields: ['member_id','resource_id','booking_id','operational_task_id','starts_at','ends_at'],
    json: [],
  },
  utilization: {
    table: 'workforce_utilization_events', id: 'id', state: 'status',
    fields: ['member_id','resource_id','booking_id','operational_task_id','planned_starts_at','planned_ends_at','actual_starts_at','actual_ends_at','evidence_source'],
    json: [],
  },
});

const INITIAL_STATES = Object.freeze({
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
  member: {
    activate: { from: ['DRAFT','SUSPENDED'], to: 'ACTIVE' },
    suspend: { from: ['ACTIVE'], to: 'SUSPENDED' },
    deactivate: { from: ['ACTIVE','SUSPENDED'], to: 'INACTIVE' },
  },
  engagement: {
    submit: { from: ['DRAFT'], to: 'PENDING_APPROVAL' },
    activate: { from: ['PENDING_APPROVAL'], to: 'ACTIVE' },
    suspend: { from: ['ACTIVE'], to: 'SUSPENDED' },
    end: { from: ['DRAFT','PENDING_APPROVAL','ACTIVE','SUSPENDED'], to: 'ENDED' },
    cancel: { from: ['DRAFT','PENDING_APPROVAL'], to: 'ENDED' },
  },
  calendar: {
    deactivate: { from: ['ACTIVE'], to: 'INACTIVE' },
  },
  calendar_exception: {
    cancel: { from: ['ACTIVE'], to: 'CANCELLED' },
  },
  availability: {
    activate: { from: ['INACTIVE'], to: 'ACTIVE' },
    deactivate: { from: ['ACTIVE'], to: 'INACTIVE' },
    cancel: { from: ['ACTIVE'], to: 'INACTIVE' },
  },
  assignment: {
    activate: { from: ['DRAFT','SUSPENDED'], to: 'ACTIVE' },
    suspend: { from: ['ACTIVE'], to: 'SUSPENDED' },
    end: { from: ['ACTIVE','SUSPENDED','DRAFT'], to: 'ENDED' },
    cancel: { from: ['DRAFT'], to: 'ENDED' },
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
const FILTER_COLUMNS = new Set([
  'member_id','resource_id','location_id','booking_id','operational_task_id',
  'calendar_id','status','state','availability','exception_type','assignment_type',
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

  assertReferences(entity, data, scope) {
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
    if (data.user_id) {
      const user = this.db.prepare(`
        SELECT u.id FROM users u
        JOIN memberships m ON m.user_id = u.id
        WHERE u.id = ? AND m.chat_id = ? AND m.status = 'active'
      `).get(String(data.user_id), scope.chat_id);
      if (!user) throw fail('WORKFORCE_USER_MEMBERSHIP_REQUIRED', 'User must have an active membership in this tenant', 422);
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
    if (context.provider_user_id) {
      const member = row.member_id
        ? this.db.prepare('SELECT user_id FROM workforce_members WHERE id = ? AND organization_id = ? AND tenant_id = ?')
          .get(String(row.member_id), String(context.organization_id), String(context.tenant_id))
        : null;
      if (entity === 'member' && String(row.user_id) !== String(context.provider_user_id)) throw scopedError();
      if (member && String(member.user_id) !== String(context.provider_user_id)) throw scopedError();
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
    if (context.member_id && ['profile','engagement','calendar','calendar_exception','availability','assignment','shift','allocation','utilization'].includes(entity)) {
      clauses.push('member_id = ?');
      values.push(String(context.member_id));
    }
    if (context.provider_user_id) {
      if (entity === 'member') {
        clauses.push('user_id = ?');
        values.push(String(context.provider_user_id));
      } else if (spec.fields.includes('member_id')) {
        clauses.push('member_id IN (SELECT id FROM workforce_members WHERE organization_id = ? AND tenant_id = ? AND user_id = ?)');
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
    for (const field of spec.fields) if (Object.hasOwn(payload, field)) data[field] = payload[field];
    this.assertReferences(entity, data, scope);
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
        this.db.exec('COMMIT');
        return { record: fromDatabaseRow(race, spec.json), duplicate: true };
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
      if (String(error?.code || '').startsWith('SQLITE_CONSTRAINT')) {
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
    for (const field of spec.fields) if (Object.hasOwn(input, field)) data[field] = input[field];
    if (Object.keys(data).length === 0) throw fail('WORKFORCE_UPDATE_EMPTY', 'At least one mutable Workforce field is required');
    this.assertReferences(entity, data, scope);
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
    const now = this.clock();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = this.db.prepare(`
        UPDATE ${spec.table}
        SET ${spec.state} = ?, updated_by = ?, updated_at = ?, version = version + 1
        WHERE id = ? AND organization_id = ? AND tenant_id = ? AND chat_id = ? AND version = ? AND ${spec.state} = ?
      `).run(transition.to,context.actor_id || null,now,String(id),scope.organization_id,scope.tenant_id,scope.chat_id,expected,record[spec.state]);
      if (Number(result.changes) !== 1) throw fail('WORKFORCE_VERSION_CONFLICT', 'Workforce record changed since it was loaded', 409);
      this.writeAudit(scope, entity, String(id), operation, { from: record[spec.state], to: transition.to, version: expected + 1 }, context);
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
