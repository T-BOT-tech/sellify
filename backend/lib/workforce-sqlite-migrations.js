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
        visibility TEXT NOT NULL DEFAULT 'ORGANIZATION',
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
        status TEXT NOT NULL DEFAULT 'DRAFT',
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
        status TEXT NOT NULL DEFAULT 'ACTIVE',
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
        status TEXT NOT NULL DEFAULT 'ACTIVE',
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
        assignment_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'DRAFT',
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
        state TEXT NOT NULL DEFAULT 'APPROVED',
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
        status TEXT NOT NULL DEFAULT 'RECORDED',
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
