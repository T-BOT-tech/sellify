/**
 * Workforce SQLite persistence migration.
 *
 * Additive migration 86. The existing tenant, organization, user, location,
 * Service Resource, and Service Booking tables remain canonical authorities.
 */
export const WORKFORCE_SQLITE_MIGRATION_VERSION = 86;

export function runWorkforceSqliteMigrations(db, now = () => new Date().toISOString()) {
  if (!db || typeof db.prepare !== 'function' || typeof db.exec !== 'function') {
    throw new TypeError('A live SQLite DatabaseSync connection is required');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = db.prepare('SELECT version FROM schema_migrations WHERE version = ?')
    .get(WORKFORCE_SQLITE_MIGRATION_VERSION);
  if (applied) return { applied: false, version: WORKFORCE_SQLITE_MIGRATION_VERSION };

  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workforce_members (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        member_type TEXT NOT NULL CHECK (member_type IN ('EMPLOYEE','CONTRACTOR','PROVIDER','VOLUNTEER')),
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','SUSPENDED','INACTIVE')),
        primary_location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
        timezone TEXT,
        display_name TEXT NOT NULL DEFAULT '',
        idempotency_key TEXT,
        request_hash TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE (organization_id, tenant_id, id),
        UNIQUE (organization_id, tenant_id, idempotency_key)
      );

      CREATE TABLE IF NOT EXISTS workforce_profiles (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
        member_id TEXT NOT NULL,
        skills_json TEXT NOT NULL DEFAULT '[]',
        qualifications_json TEXT NOT NULL DEFAULT '[]',
        languages_json TEXT NOT NULL DEFAULT '[]',
        service_capabilities_json TEXT NOT NULL DEFAULT '[]',
        visibility TEXT NOT NULL DEFAULT 'ORGANIZATION' CHECK (visibility IN ('PRIVATE','ORGANIZATION','LOCATION','PUBLIC')),
        notes TEXT NOT NULL DEFAULT '',
        effective_from TEXT,
        effective_until TEXT,
        idempotency_key TEXT,
        request_hash TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE (organization_id, tenant_id, id),
        UNIQUE (organization_id, tenant_id, idempotency_key),
        FOREIGN KEY (organization_id, tenant_id, member_id)
          REFERENCES workforce_members(organization_id, tenant_id, id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workforce_engagements (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
        member_id TEXT NOT NULL,
        engagement_type TEXT NOT NULL CHECK (engagement_type IN ('EMPLOYMENT','CONTRACT','PROVIDER_RELATIONSHIP','VOLUNTEER','INTERNAL_ASSIGNMENT')),
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_APPROVAL','ACTIVE','SUSPENDED','ENDED')),
        starts_at TEXT,
        ends_at TEXT,
        approver_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        terms_reference TEXT,
        idempotency_key TEXT,
        request_hash TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE (organization_id, tenant_id, id),
        UNIQUE (organization_id, tenant_id, idempotency_key),
        FOREIGN KEY (organization_id, tenant_id, member_id)
          REFERENCES workforce_members(organization_id, tenant_id, id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workforce_calendars (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
        member_id TEXT NOT NULL,
        location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
        timezone TEXT NOT NULL,
        weekly_schedule_json TEXT NOT NULL DEFAULT '[]',
        holiday_calendar_json TEXT NOT NULL DEFAULT '[]',
        effective_from TEXT,
        effective_until TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
        idempotency_key TEXT,
        request_hash TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE (organization_id, tenant_id, id),
        UNIQUE (organization_id, tenant_id, idempotency_key),
        FOREIGN KEY (organization_id, tenant_id, member_id)
          REFERENCES workforce_members(organization_id, tenant_id, id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workforce_calendar_exceptions (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
        calendar_id TEXT NOT NULL,
        exception_type TEXT NOT NULL CHECK (exception_type IN ('HOLIDAY','LEAVE','BLACKOUT','TEMPORARY_CHANGE')),
        starts_at TEXT NOT NULL,
        ends_at TEXT,
        all_day INTEGER NOT NULL DEFAULT 0 CHECK (all_day IN (0,1)),
        reason TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','CANCELLED')),
        idempotency_key TEXT,
        request_hash TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE (organization_id, tenant_id, id),
        UNIQUE (organization_id, tenant_id, idempotency_key),
        FOREIGN KEY (organization_id, tenant_id, calendar_id)
          REFERENCES workforce_calendars(organization_id, tenant_id, id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workforce_availability_windows (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
        member_id TEXT NOT NULL,
        resource_id TEXT REFERENCES service_resources(id) ON DELETE SET NULL,
        location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
        availability TEXT NOT NULL CHECK (availability IN ('AVAILABLE','UNAVAILABLE','TENTATIVE','BLACKOUT')),
        starts_at TEXT,
        ends_at TEXT,
        timezone TEXT NOT NULL,
        recurrence_rule TEXT,
        effective_from TEXT,
        effective_until TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
        idempotency_key TEXT,
        request_hash TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE (organization_id, tenant_id, id),
        UNIQUE (organization_id, tenant_id, idempotency_key),
        FOREIGN KEY (organization_id, tenant_id, member_id)
          REFERENCES workforce_members(organization_id, tenant_id, id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workforce_assignments (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
        member_id TEXT NOT NULL,
        resource_id TEXT REFERENCES service_resources(id) ON DELETE SET NULL,
        location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
        assignment_type TEXT NOT NULL CHECK (assignment_type IN ('LOCATION','RESOURCE','BOOKING','OPERATIONAL_TASK')),
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','SUSPENDED','ENDED')),
        starts_at TEXT,
        ends_at TEXT,
        booking_id TEXT REFERENCES service_bookings(id) ON DELETE SET NULL,
        operational_task_id TEXT,
        idempotency_key TEXT,
        request_hash TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE (organization_id, tenant_id, id),
        UNIQUE (organization_id, tenant_id, idempotency_key),
        FOREIGN KEY (organization_id, tenant_id, member_id)
          REFERENCES workforce_members(organization_id, tenant_id, id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workforce_shifts (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
        member_id TEXT NOT NULL,
        resource_id TEXT REFERENCES service_resources(id) ON DELETE SET NULL,
        location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
        starts_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        timezone TEXT NOT NULL,
        break_rules_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED')),
        recurrence_source_id TEXT,
        assignment_source_id TEXT,
        idempotency_key TEXT,
        request_hash TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE (organization_id, tenant_id, id),
        UNIQUE (organization_id, tenant_id, idempotency_key),
        FOREIGN KEY (organization_id, tenant_id, member_id)
          REFERENCES workforce_members(organization_id, tenant_id, id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workforce_allocations (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
        member_id TEXT NOT NULL,
        resource_id TEXT REFERENCES service_resources(id) ON DELETE SET NULL,
        booking_id TEXT REFERENCES service_bookings(id) ON DELETE SET NULL,
        operational_task_id TEXT,
        starts_at TEXT,
        ends_at TEXT,
        state TEXT NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT','PENDING_APPROVAL','COMMITTED','RELEASED','CANCELLED')),
        committed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        committed_at TEXT,
        idempotency_key TEXT,
        request_hash TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE (organization_id, tenant_id, id),
        UNIQUE (organization_id, tenant_id, idempotency_key),
        FOREIGN KEY (organization_id, tenant_id, member_id)
          REFERENCES workforce_members(organization_id, tenant_id, id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workforce_utilization_events (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
        member_id TEXT NOT NULL,
        resource_id TEXT REFERENCES service_resources(id) ON DELETE SET NULL,
        booking_id TEXT REFERENCES service_bookings(id) ON DELETE SET NULL,
        operational_task_id TEXT,
        planned_starts_at TEXT,
        planned_ends_at TEXT,
        actual_starts_at TEXT,
        actual_ends_at TEXT,
        status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED')),
        evidence_source TEXT,
        idempotency_key TEXT,
        request_hash TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE (organization_id, tenant_id, id),
        UNIQUE (organization_id, tenant_id, idempotency_key),
        FOREIGN KEY (organization_id, tenant_id, member_id)
          REFERENCES workforce_members(organization_id, tenant_id, id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_workforce_members_org_status
        ON workforce_members(organization_id, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_workforce_members_tenant_status
        ON workforce_members(tenant_id, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_workforce_members_user
        ON workforce_members(organization_id, tenant_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_workforce_members_location
        ON workforce_members(organization_id, tenant_id, primary_location_id);

      CREATE INDEX IF NOT EXISTS idx_workforce_profiles_member
        ON workforce_profiles(organization_id, tenant_id, member_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_workforce_engagements_member_status
        ON workforce_engagements(organization_id, tenant_id, member_id, status);

      CREATE INDEX IF NOT EXISTS idx_workforce_calendars_member_location
        ON workforce_calendars(organization_id, tenant_id, member_id, location_id, status);
      CREATE INDEX IF NOT EXISTS idx_workforce_calendar_exceptions_calendar_time
        ON workforce_calendar_exceptions(organization_id, tenant_id, calendar_id, starts_at);

      CREATE INDEX IF NOT EXISTS idx_workforce_availability_org_window
        ON workforce_availability_windows(organization_id, tenant_id, availability, starts_at, ends_at);
      CREATE INDEX IF NOT EXISTS idx_workforce_availability_member
        ON workforce_availability_windows(organization_id, tenant_id, member_id, status);
      CREATE INDEX IF NOT EXISTS idx_workforce_availability_resource
        ON workforce_availability_windows(organization_id, tenant_id, resource_id, location_id);

      CREATE INDEX IF NOT EXISTS idx_workforce_assignments_member
        ON workforce_assignments(organization_id, tenant_id, member_id, status, starts_at);
      CREATE INDEX IF NOT EXISTS idx_workforce_assignments_resource
        ON workforce_assignments(organization_id, tenant_id, resource_id, status, starts_at);
      CREATE INDEX IF NOT EXISTS idx_workforce_assignments_location
        ON workforce_assignments(organization_id, tenant_id, location_id, status, starts_at);
      CREATE INDEX IF NOT EXISTS idx_workforce_assignments_booking
        ON workforce_assignments(organization_id, tenant_id, booking_id);
      CREATE INDEX IF NOT EXISTS idx_workforce_assignments_operational_task
        ON workforce_assignments(organization_id, tenant_id, operational_task_id);

      CREATE INDEX IF NOT EXISTS idx_workforce_shifts_member
        ON workforce_shifts(organization_id, tenant_id, member_id, starts_at);
      CREATE INDEX IF NOT EXISTS idx_workforce_shifts_resource
        ON workforce_shifts(organization_id, tenant_id, resource_id, starts_at);
      CREATE INDEX IF NOT EXISTS idx_workforce_shifts_location
        ON workforce_shifts(organization_id, tenant_id, location_id, starts_at);

      CREATE INDEX IF NOT EXISTS idx_workforce_allocations_member
        ON workforce_allocations(organization_id, tenant_id, member_id, state, starts_at);
      CREATE INDEX IF NOT EXISTS idx_workforce_allocations_resource
        ON workforce_allocations(organization_id, tenant_id, resource_id, state, starts_at);
      CREATE INDEX IF NOT EXISTS idx_workforce_allocations_booking
        ON workforce_allocations(organization_id, tenant_id, booking_id);
      CREATE INDEX IF NOT EXISTS idx_workforce_allocations_operational_task
        ON workforce_allocations(organization_id, tenant_id, operational_task_id);

      CREATE INDEX IF NOT EXISTS idx_workforce_utilization_member
        ON workforce_utilization_events(organization_id, tenant_id, member_id, actual_starts_at);
      CREATE INDEX IF NOT EXISTS idx_workforce_utilization_resource
        ON workforce_utilization_events(organization_id, tenant_id, resource_id, actual_starts_at);
      CREATE INDEX IF NOT EXISTS idx_workforce_utilization_booking
        ON workforce_utilization_events(organization_id, tenant_id, booking_id);
      CREATE INDEX IF NOT EXISTS idx_workforce_utilization_operational_task
        ON workforce_utilization_events(organization_id, tenant_id, operational_task_id);
    `);

    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
      .run(WORKFORCE_SQLITE_MIGRATION_VERSION, now());
    db.exec('COMMIT');
    return { applied: true, version: WORKFORCE_SQLITE_MIGRATION_VERSION };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}


/**
 * Add the single optional Workforce reference to the canonical Service
 * Booking record. Service Booking and Service Resource Commitment remain
 * authoritative; Workforce never creates or transitions bookings here.
 */
export const WORKFORCE_SERVICE_BOOKING_MIGRATION_VERSION = 87;

export function runWorkforceServiceBookingMigration(db, now = () => new Date().toISOString()) {
  if (!db || typeof db.prepare !== 'function' || typeof db.exec !== 'function') {
    throw new TypeError('A live SQLite DatabaseSync connection is required');
  }
  const applied = db.prepare('SELECT version FROM schema_migrations WHERE version = ?')
    .get(WORKFORCE_SERVICE_BOOKING_MIGRATION_VERSION);
  if (applied) return { applied: false, version: WORKFORCE_SERVICE_BOOKING_MIGRATION_VERSION };

  db.exec('BEGIN IMMEDIATE');
  try {
    const columns = new Set(db.prepare('PRAGMA table_info(service_bookings)').all()
      .map((column) => String(column.name)));
    if (!columns.has('workforce_member_id')) {
      db.exec('ALTER TABLE service_bookings ADD COLUMN workforce_member_id TEXT REFERENCES workforce_members(id) ON DELETE SET NULL');
    }
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_service_bookings_workforce_member
        ON service_bookings(organization_id, chat_id, workforce_member_id, status);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
      .run(WORKFORCE_SERVICE_BOOKING_MIGRATION_VERSION, now());
    db.exec('COMMIT');
    return { applied: true, version: WORKFORCE_SERVICE_BOOKING_MIGRATION_VERSION };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}


/**
 * Workforce migration 88 — optional Identity link for external professionals.
 *
 * workforce_members is the professional record. A Sellify user is optional;
 * authentication and organization authorization remain owned by Identity
 * and Membership. Rebuild only this table, preserving all IDs and references.
 */
export const WORKFORCE_EXTERNAL_MEMBER_MIGRATION_VERSION = 88;

export function runWorkforceExternalMemberMigration(db, now = () => new Date().toISOString()) {
  if (!db || typeof db.prepare !== 'function' || typeof db.exec !== 'function') {
    throw new TypeError('A live SQLite DatabaseSync connection is required');
  }

  const version = WORKFORCE_EXTERNAL_MEMBER_MIGRATION_VERSION;
  const applied = db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(version);
  if (applied) return { applied: false, version };

  const columns = db.prepare('PRAGMA table_info(workforce_members)').all();
  const userColumn = columns.find(column => String(column.name) === 'user_id');
  if (!userColumn) {
    throw Object.assign(new Error('Workforce member schema is missing user_id'), {
      code: 'WORKFORCE_MEMBER_MIGRATION_SCHEMA_INVALID',
    });
  }

  const foreignKeysEnabled = Number(db.prepare('PRAGMA foreign_keys').get()?.foreign_keys || 0) === 1;
  if (foreignKeysEnabled) db.exec('PRAGMA foreign_keys = OFF');

  try {
    db.exec('BEGIN IMMEDIATE');
    if (Number(userColumn.notnull) === 1) {
      db.exec(`
        CREATE TABLE workforce_members_v88 (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
          chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
          user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
          member_type TEXT NOT NULL CHECK (member_type IN ('EMPLOYEE','CONTRACTOR','PROVIDER','VOLUNTEER')),
          status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','SUSPENDED','INACTIVE')),
          primary_location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
          timezone TEXT,
          display_name TEXT NOT NULL DEFAULT '',
          idempotency_key TEXT,
          request_hash TEXT,
          created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
          UNIQUE (organization_id, tenant_id, id),
          UNIQUE (organization_id, tenant_id, idempotency_key)
        );

        INSERT INTO workforce_members_v88 (
          id, organization_id, tenant_id, chat_id, user_id, member_type, status,
          primary_location_id, timezone, display_name, idempotency_key, request_hash,
          created_by, updated_by, created_at, updated_at, version
        )
        SELECT
          id, organization_id, tenant_id, chat_id, user_id, member_type, status,
          primary_location_id, timezone, display_name, idempotency_key, request_hash,
          created_by, updated_by, created_at, updated_at, version
        FROM workforce_members;

        DROP TABLE workforce_members;
        ALTER TABLE workforce_members_v88 RENAME TO workforce_members;
      `);
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_workforce_members_org_status
        ON workforce_members(organization_id, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_workforce_members_tenant_status
        ON workforce_members(tenant_id, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_workforce_members_user
        ON workforce_members(organization_id, tenant_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_workforce_members_location
        ON workforce_members(organization_id, tenant_id, primary_location_id);
    `);

    const violations = db.prepare('PRAGMA foreign_key_check').all();
    if (violations.length) {
      throw Object.assign(new Error('Workforce member migration failed foreign_key_check (' + violations.length + ' violations)'), {
        code: 'WORKFORCE_MEMBER_MIGRATION_FOREIGN_KEY_CHECK_FAILED',
      });
    }

    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, now());
    db.exec('COMMIT');
    return { applied: true, version };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  } finally {
    if (foreignKeysEnabled) db.exec('PRAGMA foreign_keys = ON');
  }
}


/**
 * Workforce migration 89 — optional employee number with organization uniqueness.
 * Null/blank values remain allowed for external and non-employee professionals.
 */
export const WORKFORCE_EMPLOYEE_NUMBER_MIGRATION_VERSION = 89;

export function runWorkforceEmployeeNumberMigration(db, now = () => new Date().toISOString()) {
  if (!db || typeof db.prepare !== 'function' || typeof db.exec !== 'function') {
    throw new TypeError('A live SQLite DatabaseSync connection is required');
  }
  const version = WORKFORCE_EMPLOYEE_NUMBER_MIGRATION_VERSION;
  const applied = db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(version);
  if (applied) return { applied: false, version };

  db.exec('BEGIN IMMEDIATE');
  try {
    const columns = new Set(db.prepare('PRAGMA table_info(workforce_members)').all()
      .map(column => String(column.name)));
    if (!columns.has('employee_number')) {
      db.exec('ALTER TABLE workforce_members ADD COLUMN employee_number TEXT');
    }
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_workforce_members_org_employee_number
      ON workforce_members(organization_id, employee_number COLLATE NOCASE)
      WHERE employee_number IS NOT NULL AND length(trim(employee_number)) > 0;
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, now());
    db.exec('COMMIT');
    return { applied: true, version };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}



/**
 * M2 / migration 90 — member organizational references.
 * Department, position and supervisor records are created by the following
 * migrations; nullable references preserve all existing members.
 */
export const WORKFORCE_MEMBER_ORG_REFERENCES_MIGRATION_VERSION = 90;

export function runWorkforceMemberOrgReferencesMigration(db, now = () => new Date().toISOString()) {
  const version = WORKFORCE_MEMBER_ORG_REFERENCES_MIGRATION_VERSION;
  if (db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(version)) return { applied: false, version };
  db.exec('BEGIN IMMEDIATE');
  try {
    const columns = new Set(db.prepare('PRAGMA table_info(workforce_members)').all().map(c => String(c.name)));
    if (!columns.has('department_id')) db.exec('ALTER TABLE workforce_members ADD COLUMN department_id TEXT REFERENCES workforce_departments(id) ON DELETE RESTRICT');
    if (!columns.has('position_id')) db.exec('ALTER TABLE workforce_members ADD COLUMN position_id TEXT REFERENCES workforce_positions(id) ON DELETE RESTRICT');
    if (!columns.has('supervisor_member_id')) db.exec('ALTER TABLE workforce_members ADD COLUMN supervisor_member_id TEXT REFERENCES workforce_members(id) ON DELETE RESTRICT');
    db.exec('CREATE INDEX IF NOT EXISTS idx_workforce_members_department ON workforce_members(organization_id, tenant_id, department_id, status); CREATE INDEX IF NOT EXISTS idx_workforce_members_position ON workforce_members(organization_id, tenant_id, position_id, status); CREATE INDEX IF NOT EXISTS idx_workforce_members_supervisor ON workforce_members(organization_id, tenant_id, supervisor_member_id);');
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, now());
    db.exec('COMMIT');
    return { applied: true, version };
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
}

/** M3 / migration 91 — departments. */
export const WORKFORCE_DEPARTMENT_MIGRATION_VERSION = 91;

export function runWorkforceDepartmentMigration(db, now = () => new Date().toISOString()) {
  const version = WORKFORCE_DEPARTMENT_MIGRATION_VERSION;
  if (db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(version)) return { applied: false, version };
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workforce_departments (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
        code TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(code)) BETWEEN 1 AND 40),
        name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
        idempotency_key TEXT, request_hash TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE (organization_id, code),
        UNIQUE (organization_id, tenant_id, id),
        UNIQUE (organization_id, tenant_id, idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS idx_workforce_departments_org_status ON workforce_departments(organization_id, status, name);
      CREATE TRIGGER IF NOT EXISTS workforce_members_department_scope_insert
      BEFORE INSERT ON workforce_members WHEN NEW.department_id IS NOT NULL BEGIN
        SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM workforce_departments d WHERE d.id=NEW.department_id AND d.organization_id=NEW.organization_id AND d.tenant_id=NEW.tenant_id AND d.chat_id=NEW.chat_id AND d.status='ACTIVE') THEN RAISE(ABORT, 'WORKFORCE_DEPARTMENT_SCOPE_INVALID') END;
      END;
      CREATE TRIGGER IF NOT EXISTS workforce_members_department_scope_update
      BEFORE UPDATE OF department_id, organization_id, tenant_id, chat_id ON workforce_members WHEN NEW.department_id IS NOT NULL BEGIN
        SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM workforce_departments d WHERE d.id=NEW.department_id AND d.organization_id=NEW.organization_id AND d.tenant_id=NEW.tenant_id AND d.chat_id=NEW.chat_id AND d.status='ACTIVE') THEN RAISE(ABORT, 'WORKFORCE_DEPARTMENT_SCOPE_INVALID') END;
      END;
      CREATE TRIGGER IF NOT EXISTS workforce_departments_deactivation_guard
      BEFORE UPDATE OF status ON workforce_departments
      WHEN OLD.status='ACTIVE' AND NEW.status='INACTIVE' AND (
        EXISTS (SELECT 1 FROM workforce_members m WHERE m.department_id=OLD.id AND m.status='ACTIVE')
        OR EXISTS (SELECT 1 FROM workforce_positions p WHERE p.department_id=OLD.id AND p.status='ACTIVE')
      ) BEGIN SELECT RAISE(ABORT, 'WORKFORCE_DEPARTMENT_HAS_ACTIVE_ASSIGNMENTS'); END;
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, now());
    db.exec('COMMIT');
    return { applied: true, version };
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
}

/** M4 / migration 92 — positions. */
export const WORKFORCE_POSITION_MIGRATION_VERSION = 92;

export function runWorkforcePositionMigration(db, now = () => new Date().toISOString()) {
  const version = WORKFORCE_POSITION_MIGRATION_VERSION;
  if (db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(version)) return { applied: false, version };
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workforce_positions (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
        code TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(code)) BETWEEN 1 AND 40),
        name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
        description TEXT NOT NULL DEFAULT '',
        department_id TEXT REFERENCES workforce_departments(id) ON DELETE RESTRICT,
        classification TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
        idempotency_key TEXT, request_hash TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE (organization_id, code),
        UNIQUE (organization_id, tenant_id, id),
        UNIQUE (organization_id, tenant_id, idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS idx_workforce_positions_org_department ON workforce_positions(organization_id, tenant_id, department_id, status);
      CREATE TRIGGER IF NOT EXISTS workforce_positions_department_scope_insert
      BEFORE INSERT ON workforce_positions WHEN NEW.department_id IS NOT NULL BEGIN
        SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM workforce_departments d WHERE d.id=NEW.department_id AND d.organization_id=NEW.organization_id AND d.tenant_id=NEW.tenant_id AND d.chat_id=NEW.chat_id AND d.status='ACTIVE') THEN RAISE(ABORT, 'WORKFORCE_DEPARTMENT_SCOPE_INVALID') END;
      END;
      CREATE TRIGGER IF NOT EXISTS workforce_positions_department_scope_update
      BEFORE UPDATE OF department_id, organization_id, tenant_id, chat_id ON workforce_positions WHEN NEW.department_id IS NOT NULL BEGIN
        SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM workforce_departments d WHERE d.id=NEW.department_id AND d.organization_id=NEW.organization_id AND d.tenant_id=NEW.tenant_id AND d.chat_id=NEW.chat_id AND d.status='ACTIVE') THEN RAISE(ABORT, 'WORKFORCE_DEPARTMENT_SCOPE_INVALID') END;
      END;
      CREATE TRIGGER IF NOT EXISTS workforce_members_position_scope_insert
      BEFORE INSERT ON workforce_members WHEN NEW.position_id IS NOT NULL BEGIN
        SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM workforce_positions p WHERE p.id=NEW.position_id AND p.organization_id=NEW.organization_id AND p.tenant_id=NEW.tenant_id AND p.chat_id=NEW.chat_id AND p.status='ACTIVE' AND (p.department_id IS NULL OR p.department_id=NEW.department_id)) THEN RAISE(ABORT, 'WORKFORCE_POSITION_SCOPE_INVALID') END;
      END;
      CREATE TRIGGER IF NOT EXISTS workforce_members_position_scope_update
      BEFORE UPDATE OF position_id, department_id, organization_id, tenant_id, chat_id ON workforce_members WHEN NEW.position_id IS NOT NULL BEGIN
        SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM workforce_positions p WHERE p.id=NEW.position_id AND p.organization_id=NEW.organization_id AND p.tenant_id=NEW.tenant_id AND p.chat_id=NEW.chat_id AND p.status='ACTIVE' AND (p.department_id IS NULL OR p.department_id=NEW.department_id)) THEN RAISE(ABORT, 'WORKFORCE_POSITION_SCOPE_INVALID') END;
      END;
      CREATE TRIGGER IF NOT EXISTS workforce_positions_deactivation_guard
      BEFORE UPDATE OF status ON workforce_positions
      WHEN OLD.status='ACTIVE' AND NEW.status='INACTIVE'
      AND EXISTS (SELECT 1 FROM workforce_members m WHERE m.position_id=OLD.id AND m.status='ACTIVE')
      BEGIN SELECT RAISE(ABORT, 'WORKFORCE_POSITION_HAS_ACTIVE_ASSIGNMENTS'); END;
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, now());
    db.exec('COMMIT');
    return { applied: true, version };
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
}

/** M5 / migration 93 — supervisor references and reporting-cycle integrity. */
export const WORKFORCE_REPORTING_RELATIONSHIP_MIGRATION_VERSION = 93;

export function runWorkforceReportingRelationshipMigration(db, now = () => new Date().toISOString()) {
  const version = WORKFORCE_REPORTING_RELATIONSHIP_MIGRATION_VERSION;
  if (db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(version)) return { applied: false, version };
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS workforce_members_supervisor_scope_insert
      BEFORE INSERT ON workforce_members WHEN NEW.supervisor_member_id IS NOT NULL BEGIN
        SELECT CASE WHEN NEW.supervisor_member_id=NEW.id OR NOT EXISTS (
          SELECT 1 FROM workforce_members s WHERE s.id=NEW.supervisor_member_id
          AND s.organization_id=NEW.organization_id AND s.tenant_id=NEW.tenant_id
          AND s.chat_id=NEW.chat_id AND s.status='ACTIVE'
        ) THEN RAISE(ABORT, 'WORKFORCE_SUPERVISOR_SCOPE_INVALID') END;
      END;
      CREATE TRIGGER IF NOT EXISTS workforce_members_supervisor_scope_update
      BEFORE UPDATE OF supervisor_member_id, organization_id, tenant_id, chat_id ON workforce_members
      WHEN NEW.supervisor_member_id IS NOT NULL BEGIN
        SELECT CASE WHEN NEW.supervisor_member_id=NEW.id OR NOT EXISTS (
          SELECT 1 FROM workforce_members s WHERE s.id=NEW.supervisor_member_id
          AND s.organization_id=NEW.organization_id AND s.tenant_id=NEW.tenant_id
          AND s.chat_id=NEW.chat_id AND s.status='ACTIVE'
        ) THEN RAISE(ABORT, 'WORKFORCE_SUPERVISOR_SCOPE_INVALID') END;
        SELECT CASE WHEN EXISTS (
          WITH RECURSIVE supervisor_chain(id, supervisor_member_id) AS (
            SELECT id, supervisor_member_id FROM workforce_members WHERE id=NEW.supervisor_member_id
            UNION ALL
            SELECT m.id, m.supervisor_member_id FROM workforce_members m
            JOIN supervisor_chain c ON m.id=c.supervisor_member_id
            WHERE c.supervisor_member_id IS NOT NULL
          )
          SELECT 1 FROM supervisor_chain WHERE id=NEW.id
        ) THEN RAISE(ABORT, 'WORKFORCE_REPORTING_CYCLE_INVALID') END;
      END;
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, now());
    db.exec('COMMIT');
    return { applied: true, version };
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
}

export const WORKFORCE_ORGANIZATION_STRUCTURE_MIGRATION_VERSION = WORKFORCE_REPORTING_RELATIONSHIP_MIGRATION_VERSION;

export function runWorkforceOrganizationStructureMigration(db, now = () => new Date().toISOString()) {
  const results = [
    runWorkforceMemberOrgReferencesMigration(db, now),
    runWorkforceDepartmentMigration(db, now),
    runWorkforcePositionMigration(db, now),
    runWorkforceReportingRelationshipMigration(db, now),
  ];
  return { applied: results.some(result => result.applied), version: WORKFORCE_ORGANIZATION_STRUCTURE_MIGRATION_VERSION };
}


/** M6 / migration 94 — reusable, organization-scoped shift templates. */
export const WORKFORCE_SHIFT_TEMPLATE_MIGRATION_VERSION = 94;

export function runWorkforceShiftTemplateMigration(db, now = () => new Date().toISOString()) {
  const version = WORKFORCE_SHIFT_TEMPLATE_MIGRATION_VERSION;
  if (db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(version)) return { applied: false, version };
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workforce_shift_templates (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
        name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
        start_local_time TEXT NOT NULL CHECK (length(start_local_time)=5),
        end_local_time TEXT NOT NULL CHECK (length(end_local_time)=5),
        timezone TEXT NOT NULL CHECK (length(trim(timezone)) BETWEEN 1 AND 80),
        break_rules_json TEXT NOT NULL DEFAULT '[]'
          CHECK (json_valid(break_rules_json) AND json_type(break_rules_json)='array'),
        work_days_json TEXT NOT NULL DEFAULT '[1,2,3,4,5]'
          CHECK (json_valid(work_days_json) AND json_type(work_days_json)='array'),
        department_id TEXT REFERENCES workforce_departments(id) ON DELETE RESTRICT,
        position_id TEXT REFERENCES workforce_positions(id) ON DELETE RESTRICT,
        location_id TEXT REFERENCES locations(id) ON DELETE RESTRICT,
        effective_from TEXT NOT NULL CHECK (length(effective_from)=10),
        effective_until TEXT CHECK (effective_until IS NULL OR length(effective_until)=10),
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
        idempotency_key TEXT,
        request_hash TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        CHECK (effective_until IS NULL OR effective_until >= effective_from),
        UNIQUE (organization_id, tenant_id, id),
        UNIQUE (organization_id, tenant_id, idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS idx_workforce_shift_templates_org_status
        ON workforce_shift_templates(organization_id, tenant_id, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_workforce_shift_templates_department
        ON workforce_shift_templates(organization_id, tenant_id, department_id, status);
      CREATE INDEX IF NOT EXISTS idx_workforce_shift_templates_position
        ON workforce_shift_templates(organization_id, tenant_id, position_id, status);
      CREATE INDEX IF NOT EXISTS idx_workforce_shift_templates_location
        ON workforce_shift_templates(organization_id, tenant_id, location_id, status);
      CREATE TRIGGER IF NOT EXISTS workforce_shift_templates_department_scope_insert
      BEFORE INSERT ON workforce_shift_templates BEGIN
        SELECT CASE WHEN NEW.department_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM workforce_departments d WHERE d.id=NEW.department_id
          AND d.organization_id=NEW.organization_id AND d.tenant_id=NEW.tenant_id
          AND d.chat_id=NEW.chat_id AND d.status='ACTIVE'
        ) THEN RAISE(ABORT, 'WORKFORCE_TEMPLATE_DEPARTMENT_SCOPE_INVALID') END;
        SELECT CASE WHEN NEW.position_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM workforce_positions p WHERE p.id=NEW.position_id
          AND p.organization_id=NEW.organization_id AND p.tenant_id=NEW.tenant_id
          AND p.chat_id=NEW.chat_id AND p.status='ACTIVE'
          AND (p.department_id IS NULL OR p.department_id=NEW.department_id)
        ) THEN RAISE(ABORT, 'WORKFORCE_TEMPLATE_POSITION_SCOPE_INVALID') END;
        SELECT CASE WHEN NEW.location_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM locations l WHERE l.id=NEW.location_id AND l.organization_id=NEW.organization_id
        ) THEN RAISE(ABORT, 'WORKFORCE_TEMPLATE_LOCATION_SCOPE_INVALID') END;
      END;
      CREATE TRIGGER IF NOT EXISTS workforce_shift_templates_reference_scope_update
      BEFORE UPDATE OF department_id, position_id, location_id, organization_id, tenant_id, chat_id
      ON workforce_shift_templates BEGIN
        SELECT CASE WHEN NEW.department_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM workforce_departments d WHERE d.id=NEW.department_id
          AND d.organization_id=NEW.organization_id AND d.tenant_id=NEW.tenant_id
          AND d.chat_id=NEW.chat_id AND d.status='ACTIVE'
        ) THEN RAISE(ABORT, 'WORKFORCE_TEMPLATE_DEPARTMENT_SCOPE_INVALID') END;
        SELECT CASE WHEN NEW.position_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM workforce_positions p WHERE p.id=NEW.position_id
          AND p.organization_id=NEW.organization_id AND p.tenant_id=NEW.tenant_id
          AND p.chat_id=NEW.chat_id AND p.status='ACTIVE'
          AND (p.department_id IS NULL OR p.department_id=NEW.department_id)
        ) THEN RAISE(ABORT, 'WORKFORCE_TEMPLATE_POSITION_SCOPE_INVALID') END;
        SELECT CASE WHEN NEW.location_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM locations l WHERE l.id=NEW.location_id AND l.organization_id=NEW.organization_id
        ) THEN RAISE(ABORT, 'WORKFORCE_TEMPLATE_LOCATION_SCOPE_INVALID') END;
      END;
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, now());
    db.exec('COMMIT');
    return { applied: true, version };
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
}


/** M7 / migration 95 — prevent deactivation of structure used by active templates. */
export const WORKFORCE_SHIFT_TEMPLATE_REFERENCE_GUARD_MIGRATION_VERSION = 95;

export function runWorkforceShiftTemplateReferenceGuardMigration(db, now = () => new Date().toISOString()) {
  const version = WORKFORCE_SHIFT_TEMPLATE_REFERENCE_GUARD_MIGRATION_VERSION;
  if (db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(version)) return { applied: false, version };
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS workforce_departments_shift_template_deactivation_guard
      BEFORE UPDATE OF status ON workforce_departments
      WHEN OLD.status='ACTIVE' AND NEW.status='INACTIVE'
      AND EXISTS (
        SELECT 1 FROM workforce_shift_templates t
        WHERE t.department_id=OLD.id AND t.organization_id=OLD.organization_id
        AND t.tenant_id=OLD.tenant_id AND t.status='ACTIVE'
      )
      BEGIN SELECT RAISE(ABORT, 'WORKFORCE_DEPARTMENT_HAS_ACTIVE_SHIFT_TEMPLATES'); END;
      CREATE TRIGGER IF NOT EXISTS workforce_positions_shift_template_deactivation_guard
      BEFORE UPDATE OF status ON workforce_positions
      WHEN OLD.status='ACTIVE' AND NEW.status='INACTIVE'
      AND EXISTS (
        SELECT 1 FROM workforce_shift_templates t
        WHERE t.position_id=OLD.id AND t.organization_id=OLD.organization_id
        AND t.tenant_id=OLD.tenant_id AND t.status='ACTIVE'
      )
      BEGIN SELECT RAISE(ABORT, 'WORKFORCE_POSITION_HAS_ACTIVE_SHIFT_TEMPLATES'); END;
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, now());
    db.exec('COMMIT');
    return { applied: true, version };
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
}


/** M8 / migration 96 — preserve template provenance on generated dated shifts. */
export const WORKFORCE_SHIFT_INSTANCE_PROVENANCE_MIGRATION_VERSION = 96;

export function runWorkforceShiftInstanceProvenanceMigration(db, now = () => new Date().toISOString()) {
  const version = WORKFORCE_SHIFT_INSTANCE_PROVENANCE_MIGRATION_VERSION;
  if (db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(version)) return { applied: false, version };
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      ALTER TABLE workforce_shifts ADD COLUMN shift_template_id TEXT
        REFERENCES workforce_shift_templates(id) ON DELETE RESTRICT;
      ALTER TABLE workforce_shifts ADD COLUMN template_version INTEGER
        CHECK (template_version IS NULL OR template_version > 0);
      ALTER TABLE workforce_shifts ADD COLUMN generated_local_date TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_workforce_shifts_template_member_date
        ON workforce_shifts(organization_id, tenant_id, shift_template_id, member_id, generated_local_date)
        WHERE shift_template_id IS NOT NULL AND generated_local_date IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_workforce_shifts_template
        ON workforce_shifts(organization_id, tenant_id, shift_template_id, generated_local_date);
      CREATE TRIGGER IF NOT EXISTS workforce_shifts_template_provenance_insert
      BEFORE INSERT ON workforce_shifts BEGIN
        SELECT CASE WHEN
          (NEW.shift_template_id IS NULL AND (NEW.template_version IS NOT NULL OR NEW.generated_local_date IS NOT NULL))
          OR (NEW.shift_template_id IS NOT NULL AND (NEW.template_version IS NULL OR NEW.generated_local_date IS NULL))
          THEN RAISE(ABORT, 'WORKFORCE_SHIFT_TEMPLATE_PROVENANCE_INVALID') END;
        SELECT CASE WHEN NEW.shift_template_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM workforce_shift_templates t
          WHERE t.id=NEW.shift_template_id AND t.organization_id=NEW.organization_id
          AND t.tenant_id=NEW.tenant_id AND t.chat_id=NEW.chat_id
        ) THEN RAISE(ABORT, 'WORKFORCE_SHIFT_TEMPLATE_SCOPE_INVALID') END;
      END;
      CREATE TRIGGER IF NOT EXISTS workforce_shifts_template_provenance_update
      BEFORE UPDATE OF shift_template_id, template_version, generated_local_date, organization_id, tenant_id, chat_id
      ON workforce_shifts BEGIN
        SELECT CASE WHEN
          (NEW.shift_template_id IS NULL AND (NEW.template_version IS NOT NULL OR NEW.generated_local_date IS NOT NULL))
          OR (NEW.shift_template_id IS NOT NULL AND (NEW.template_version IS NULL OR NEW.generated_local_date IS NULL))
          THEN RAISE(ABORT, 'WORKFORCE_SHIFT_TEMPLATE_PROVENANCE_INVALID') END;
        SELECT CASE WHEN NEW.shift_template_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM workforce_shift_templates t
          WHERE t.id=NEW.shift_template_id AND t.organization_id=NEW.organization_id
          AND t.tenant_id=NEW.tenant_id AND t.chat_id=NEW.chat_id
        ) THEN RAISE(ABORT, 'WORKFORCE_SHIFT_TEMPLATE_SCOPE_INVALID') END;
      END;
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, now());
    db.exec('COMMIT');
    return { applied: true, version };
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
}


/** M9 / migration 97 — separate planned leave requests from recorded absences. */
export const WORKFORCE_LEAVE_ABSENCE_MIGRATION_VERSION = 97;

export function runWorkforceLeaveAbsenceMigration(db, now = () => new Date().toISOString()) {
  const version = WORKFORCE_LEAVE_ABSENCE_MIGRATION_VERSION;
  if (db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(version)) return { applied: false, version };
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workforce_leave_requests (
        id TEXT NOT NULL PRIMARY KEY,
        organization_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        leave_category TEXT NOT NULL CHECK (leave_category IN ('ANNUAL','SICK','PERSONAL','UNPAID','PARENTAL','BEREAVEMENT','OTHER')),
        starts_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        timezone TEXT NOT NULL CHECK (length(trim(timezone)) > 0),
        all_day INTEGER NOT NULL DEFAULT 0 CHECK (all_day IN (0,1)),
        reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','WITHDRAWN','CANCELLED')),
        requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        submitted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        submitted_at TEXT,
        decided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        decided_at TEXT,
        decision_reason TEXT,
        withdrawn_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        withdrawn_at TEXT,
        withdrawal_reason TEXT,
        cancelled_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        cancelled_at TEXT,
        cancellation_reason TEXT,
        idempotency_key TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        CHECK (starts_at < ends_at),
        CHECK (decided_by IS NULL OR decided_by <> requested_by),
        UNIQUE (organization_id, tenant_id, idempotency_key),
        UNIQUE (id, organization_id, tenant_id, chat_id),
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        FOREIGN KEY (chat_id) REFERENCES tenants(chat_id) ON DELETE CASCADE,
        FOREIGN KEY (organization_id, tenant_id, member_id)
          REFERENCES workforce_members(organization_id, tenant_id, id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_workforce_leave_member_status_start
        ON workforce_leave_requests(organization_id, tenant_id, member_id, status, starts_at);
      CREATE INDEX IF NOT EXISTS idx_workforce_leave_approval_inbox
        ON workforce_leave_requests(organization_id, tenant_id, status, starts_at);

      CREATE TABLE IF NOT EXISTS workforce_absences (
        id TEXT NOT NULL PRIMARY KEY,
        organization_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        absence_type TEXT NOT NULL CHECK (absence_type IN ('SICKNESS','UNPLANNED','NO_SHOW','OTHER')),
        starts_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        timezone TEXT NOT NULL CHECK (length(trim(timezone)) > 0),
        all_day INTEGER NOT NULL DEFAULT 0 CHECK (all_day IN (0,1)),
        reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
        status TEXT NOT NULL DEFAULT 'RECORDED' CHECK (status IN ('RECORDED','VOIDED')),
        recorded_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        voided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        voided_at TEXT,
        void_reason TEXT,
        idempotency_key TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        CHECK (starts_at < ends_at),
        UNIQUE (organization_id, tenant_id, idempotency_key),
        UNIQUE (id, organization_id, tenant_id, chat_id),
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        FOREIGN KEY (chat_id) REFERENCES tenants(chat_id) ON DELETE CASCADE,
        FOREIGN KEY (organization_id, tenant_id, member_id)
          REFERENCES workforce_members(organization_id, tenant_id, id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_workforce_absences_member_status_start
        ON workforce_absences(organization_id, tenant_id, member_id, status, starts_at);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, now());
    db.exec('COMMIT');
    return { applied: true, version };
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
}


/** M10 / migration 98 — organization-scoped, versioned scheduling policies. */
export const WORKFORCE_SCHEDULING_POLICY_MIGRATION_VERSION = 98;

export function runWorkforceSchedulingPolicyMigration(db, now = () => new Date().toISOString()) {
  const version = WORKFORCE_SCHEDULING_POLICY_MIGRATION_VERSION;
  if (db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(version)) return { applied: false, version };
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workforce_scheduling_policies (
        id TEXT NOT NULL PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
        name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
        rules_json TEXT NOT NULL CHECK (json_valid(rules_json) AND json_type(rules_json)='object'),
        effective_from TEXT NOT NULL CHECK (length(effective_from)=10),
        effective_until TEXT CHECK (effective_until IS NULL OR length(effective_until)=10),
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','INACTIVE')),
        idempotency_key TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        CHECK (effective_until IS NULL OR effective_until >= effective_from),
        UNIQUE (organization_id, tenant_id, idempotency_key),
        UNIQUE (id, organization_id, tenant_id, chat_id)
      );
      CREATE INDEX IF NOT EXISTS idx_workforce_scheduling_policies_scope_status
        ON workforce_scheduling_policies(organization_id, tenant_id, status, effective_from DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_workforce_scheduling_policy_active_org
        ON workforce_scheduling_policies(organization_id, tenant_id) WHERE status='ACTIVE';
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, now());
    db.exec('COMMIT');
    return { applied: true, version };
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
}
