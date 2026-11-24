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
