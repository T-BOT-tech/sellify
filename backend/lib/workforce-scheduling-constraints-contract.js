/**
 * Organization-configurable Workforce scheduling constraints.
 *
 * This contract evaluates scheduling feasibility only. It never creates
 * bookings, reservations, payment decisions, resource commitments or delivery
 * commitments. Callers must supply canonical Workforce records.
 */
import { localDateTimeToUtc, isoWeekday } from './workforce-shift-time.js';

export const WORKFORCE_SCHEDULING_CONSTRAINTS_CONTRACT_VERSION = '1.0';
export const WORKFORCE_SCHEDULING_POLICY_STATES = Object.freeze(['DRAFT','ACTIVE','INACTIVE']);
export const WORKFORCE_SCHEDULING_RULE_MODES = Object.freeze(['BLOCK','WARN']);
export const WORKFORCE_SCHEDULING_LOCATION_POLICIES = Object.freeze(['ANY','ASSIGNED_ONLY']);

const NUMERIC_RULES = Object.freeze({
  max_shift_minutes: [1, 1440],
  max_daily_minutes: [1, 1440],
  max_weekly_minutes: [1, 10080],
  minimum_rest_minutes: [0, 10080],
  minimum_break_after_minutes: [1, 1440],
  minimum_break_duration_minutes: [1, 240],
  max_consecutive_days: [1, 31],
});
const ENFORCEMENT_KEYS = Object.freeze([
  'shift_overlap','max_shift_minutes','max_daily_minutes','max_weekly_minutes',
  'minimum_rest_minutes','minimum_break','max_consecutive_days',
  'required_qualifications','location_policy',
]);
const RULE_KEYS = Object.freeze([
  ...Object.keys(NUMERIC_RULES),'required_qualifications','location_policy','enforcement',
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value;
}
function pad(value) { return String(value).padStart(2, '0'); }
function addDays(date, amount) {
  const parsed = new Date(date + 'T00:00:00.000Z');
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return parsed.toISOString().slice(0,10);
}
function localDateAt(epoch, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(epoch));
  const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return values.year + '-' + values.month + '-' + values.day;
}
function dayBounds(date, timezone) {
  const nextDate = addDays(date, 1);
  return {
    start: Date.parse(localDateTimeToUtc(date, '00:00', timezone)),
    end: Date.parse(localDateTimeToUtc(nextDate, '00:00', timezone)),
  };
}
function overlapMinutes(interval, range) {
  return Math.max(0, Math.min(interval.end, range.end) - Math.max(interval.start, range.start)) / 60000;
}
function intervalsFor(candidate, existing) {
  return [
    { start: Date.parse(candidate.starts_at), end: Date.parse(candidate.ends_at), id: candidate.id || 'candidate', candidate: true },
    ...existing.filter(item => String(item.status || '').toUpperCase() !== 'CANCELLED')
      .map(item => ({ start: Date.parse(item.starts_at), end: Date.parse(item.ends_at), id: item.id, candidate: false })),
  ];
}
function datesTouched(interval, timezone) {
  const first = localDateAt(interval.start, timezone);
  const last = localDateAt(Math.max(interval.start, interval.end - 1), timezone);
  const result = [];
  let cursor = first;
  for (let count = 0; count < 32; count += 1) {
    result.push(cursor);
    if (cursor >= last) return result;
    cursor = addDays(cursor, 1);
  }
  throw new Error('Schedule interval exceeds supported assessment horizon');
}
function breakMinutes(rules) {
  if (!Array.isArray(rules)) return null;
  let total = 0;
  for (const rule of rules) {
    const start = typeof rule?.start_local_time === 'string' ? rule.start_local_time : '';
    const end = typeof rule?.end_local_time === 'string' ? rule.end_local_time : '';
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
    const toMinutes = value => Number(value.slice(0,2)) * 60 + Number(value.slice(3,5));
    const duration = (toMinutes(end) - toMinutes(start) + 1440) % 1440;
    if (!duration) return null;
    total += duration;
  }
  return total;
}
function addFinding(findings, rules, code, key, observed, limit, message, unknown = false) {
  const mode = rules.enforcement?.[key] || 'BLOCK';
  const status = unknown ? 'UNKNOWN' : mode === 'WARN' ? 'WARNING' : 'BLOCKING_CONFLICT';
  findings.push(Object.freeze({ code, rule: key, status, observed, limit, message }));
}
function overallState(findings) {
  if (findings.some(item => item.status === 'BLOCKING_CONFLICT')) return 'BLOCKING_CONFLICT';
  if (findings.some(item => item.status === 'UNKNOWN')) return 'UNKNOWN';
  if (findings.some(item => item.status === 'WARNING')) return 'WARNING';
  return 'PASS';
}

export function validateWorkforceSchedulingPolicyRules(input = {}) {
  const errors = [];
  if (!isPlainObject(input)) return Object.freeze({ valid: false, errors: ['rules must be a JSON object'] });
  for (const key of Object.keys(input)) if (!RULE_KEYS.includes(key)) errors.push('Unsupported scheduling rule: ' + key);
  for (const [key, [minimum, maximum]] of Object.entries(NUMERIC_RULES)) {
    if (input[key] !== undefined && (!Number.isInteger(input[key]) || input[key] < minimum || input[key] > maximum)) {
      errors.push(key + ' must be an integer between ' + minimum + ' and ' + maximum);
    }
  }
  if (input.required_qualifications !== undefined) {
    const values = input.required_qualifications;
    if (!Array.isArray(values) || values.length > 30
      || values.some(value => typeof value !== 'string' || !value.trim() || value.trim().length > 120)
      || new Set(values.map(value => value.trim().toLowerCase())).size !== values.length) {
      errors.push('required_qualifications must contain up to 30 unique non-empty strings of at most 120 characters');
    }
  }
  if (input.location_policy !== undefined && !WORKFORCE_SCHEDULING_LOCATION_POLICIES.includes(input.location_policy)) {
    errors.push('location_policy must be ANY or ASSIGNED_ONLY');
  }
  if (input.enforcement !== undefined) {
    if (!isPlainObject(input.enforcement)) errors.push('enforcement must be a JSON object');
    else for (const [key, value] of Object.entries(input.enforcement)) {
      if (!ENFORCEMENT_KEYS.includes(key) || !WORKFORCE_SCHEDULING_RULE_MODES.includes(value)) {
        errors.push('Invalid enforcement mode for ' + key);
      }
    }
  }
  if ((input.minimum_break_after_minutes === undefined) !== (input.minimum_break_duration_minutes === undefined)) {
    errors.push('minimum_break_after_minutes and minimum_break_duration_minutes must be configured together');
  }
  return Object.freeze({ valid: errors.length === 0, errors });
}

export function validateWorkforceSchedulingPolicy(input = {}, { partial = false } = {}) {
  const errors = [];
  if (!partial || input.name !== undefined) {
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 120) {
      errors.push('name must be a non-empty string of at most 120 characters');
    }
  }
  if (!partial || input.effective_from !== undefined) {
    if (!validDate(input.effective_from)) errors.push('effective_from must be a valid YYYY-MM-DD date');
  }
  if (input.effective_until !== undefined && input.effective_until !== null && input.effective_until !== ''
    && !validDate(input.effective_until)) errors.push('effective_until must be a valid YYYY-MM-DD date');
  if (input.effective_from && input.effective_until && input.effective_until < input.effective_from) {
    errors.push('effective_until must be on or after effective_from');
  }
  if (!partial || input.rules !== undefined) errors.push(...validateWorkforceSchedulingPolicyRules(input.rules).errors);
  return Object.freeze({ valid: errors.length === 0, errors });
}

export function evaluateWorkforceSchedulingConstraints({
  policy, candidate, existing_shifts = [], qualifications, eligible_location_ids,
} = {}) {
  const policyVersion = Number(policy?.version || 0);
  const base = { policy_id: policy?.id || null, policy_version: policyVersion || null };
  if (!policy || String(policy.status || '').toUpperCase() !== 'ACTIVE' || !candidate
    || !Array.isArray(existing_shifts) || !candidate.starts_at || !candidate.ends_at
    || !candidate.timezone || !Number.isFinite(Date.parse(candidate.starts_at))
    || !Number.isFinite(Date.parse(candidate.ends_at)) || Date.parse(candidate.starts_at) >= Date.parse(candidate.ends_at)) {
    const finding = Object.freeze({ code: 'SCHEDULING_INPUT_INCOMPLETE', rule: 'assessment', status: 'UNKNOWN',
      observed: null, limit: null, message: 'An active policy and complete candidate and existing-shift data are required' });
    return Object.freeze({ ...base, state: 'UNKNOWN', findings: Object.freeze([finding]), evaluated_at: new Date().toISOString() });
  }
  const rules = policy.rules || {};
  const start = Date.parse(candidate.starts_at), end = Date.parse(candidate.ends_at);
  try { new Intl.DateTimeFormat('en-US', { timeZone: candidate.timezone }).format(new Date(start)); }
  catch {
    const finding = Object.freeze({ code: 'SCHEDULING_TIMEZONE_INVALID', rule: 'timezone', status: 'UNKNOWN',
      observed: candidate.timezone, limit: null, message: 'A valid IANA timezone is required for local scheduling constraints' });
    return Object.freeze({ ...base, state: 'UNKNOWN', findings: Object.freeze([finding]), evaluated_at: new Date().toISOString() });
  }
  const activeExistingShifts = existing_shifts.filter(item => String(item.status || '').toUpperCase() !== 'CANCELLED');
  if (activeExistingShifts.some(item => !Number.isFinite(Date.parse(item.starts_at))
    || !Number.isFinite(Date.parse(item.ends_at)) || Date.parse(item.starts_at) >= Date.parse(item.ends_at))) {
    const finding = Object.freeze({ code: 'SCHEDULE_HISTORY_INVALID', rule: 'assessment', status: 'UNKNOWN',
      observed: null, limit: null, message: 'Existing shift history contains an invalid time interval' });
    return Object.freeze({ ...base, state: 'UNKNOWN', findings: Object.freeze([finding]), evaluated_at: new Date().toISOString() });
  }
  const candidateInterval = { start, end, id: candidate.id || 'candidate', candidate: true };
  const existing = intervalsFor(candidate, activeExistingShifts).slice(1);
  const all = [candidateInterval, ...existing];
  const findings = [];
  const timezone = candidate.timezone;

  const overlapping = existing.filter(item => item.start < end && item.end > start);
  if (overlapping.length) addFinding(findings, rules, 'SHIFT_OVERLAP', 'shift_overlap', overlapping.map(item => item.id), 0,
    'The professional already has an overlapping non-cancelled shift');

  const durationMinutes = (end - start) / 60000;
  if (rules.max_shift_minutes !== undefined && durationMinutes > rules.max_shift_minutes) {
    addFinding(findings, rules, 'MAX_SHIFT_DURATION', 'max_shift_minutes', durationMinutes, rules.max_shift_minutes,
      'The proposed shift exceeds the configured maximum duration');
  }

  if (rules.minimum_rest_minutes !== undefined) {
    const gaps = existing.flatMap(item => item.end <= start ? [ (start - item.end) / 60000 ]
      : item.start >= end ? [ (item.start - end) / 60000 ] : []);
    const nearest = gaps.length ? Math.min(...gaps) : null;
    if (nearest !== null && nearest < rules.minimum_rest_minutes) {
      addFinding(findings, rules, 'MINIMUM_REST', 'minimum_rest_minutes', nearest, rules.minimum_rest_minutes,
        'The rest period between this shift and an adjacent shift is too short');
    }
  }

  let candidateDays = [];
  try { candidateDays = datesTouched(candidateInterval, timezone); }
  catch {
    if (rules.max_daily_minutes !== undefined) addFinding(findings, rules, 'DAILY_WINDOW_UNKNOWN',
      'max_daily_minutes', null, rules.max_daily_minutes,
      'The candidate interval is too wide to assess daily working-time limits', true);
  }
  if (rules.max_daily_minutes !== undefined && candidateDays.length) {
    try {
      for (const date of candidateDays) {
        const bounds = dayBounds(date, timezone);
        const minutes = all.reduce((sum, interval) => sum + overlapMinutes(interval, bounds), 0);
        if (minutes > rules.max_daily_minutes) {
          addFinding(findings, rules, 'MAX_DAILY_HOURS', 'max_daily_minutes', { date, minutes }, rules.max_daily_minutes,
            'Scheduled work exceeds the configured daily limit on ' + date);
        }
      }
    } catch {
      addFinding(findings, rules, 'DAILY_WINDOW_UNKNOWN', 'max_daily_minutes', null, rules.max_daily_minutes,
        'The local day boundary could not be resolved safely for this timezone', true);
    }
  }

  if (rules.max_weekly_minutes !== undefined) {
    try {
      const startDate = localDateAt(start, timezone);
      const monday = addDays(startDate, -(isoWeekday(startDate) - 1));
      const nextMonday = addDays(monday, 7);
      const bounds = { start: Date.parse(localDateTimeToUtc(monday, '00:00', timezone)),
        end: Date.parse(localDateTimeToUtc(nextMonday, '00:00', timezone)) };
      const minutes = all.reduce((sum, interval) => sum + overlapMinutes(interval, bounds), 0);
      if (minutes > rules.max_weekly_minutes) {
        addFinding(findings, rules, 'MAX_WEEKLY_HOURS', 'max_weekly_minutes', minutes, rules.max_weekly_minutes,
          'Scheduled work exceeds the configured weekly limit');
      }
    } catch {
      addFinding(findings, rules, 'WEEKLY_WINDOW_UNKNOWN', 'max_weekly_minutes', null, rules.max_weekly_minutes,
        'The local week boundary could not be resolved safely for this timezone', true);
    }
  }

  if (rules.minimum_break_after_minutes !== undefined && durationMinutes > rules.minimum_break_after_minutes) {
    const breaks = breakMinutes(candidate.break_rules);
    if (breaks === null) {
      addFinding(findings, rules, 'BREAK_EVIDENCE_UNKNOWN', 'minimum_break', null, rules.minimum_break_duration_minutes,
        'Break details are missing or invalid for a shift that requires a break', true);
    } else if (breaks < rules.minimum_break_duration_minutes) {
      addFinding(findings, rules, 'MINIMUM_BREAK', 'minimum_break', breaks, rules.minimum_break_duration_minutes,
        'The proposed shift does not provide the configured minimum break duration');
    }
  }

  if (rules.max_consecutive_days !== undefined) {
    try {
      const days = new Set();
      for (const interval of all) for (const date of datesTouched(interval, timezone)) days.add(date);
      const sorted = [...days].sort();
      let run = 0, maximum = 0, previous = null;
      for (const date of sorted) {
        run = previous && addDays(previous, 1) === date ? run + 1 : 1;
        maximum = Math.max(maximum, run); previous = date;
      }
      if (maximum > rules.max_consecutive_days) addFinding(findings, rules, 'MAX_CONSECUTIVE_DAYS',
        'max_consecutive_days', maximum, rules.max_consecutive_days,
        'The proposed schedule exceeds the configured consecutive working-day limit');
    } catch {
      addFinding(findings, rules, 'CONSECUTIVE_DAYS_UNKNOWN', 'max_consecutive_days', null, rules.max_consecutive_days,
        'The schedule history is too wide to assess consecutive working days', true);
    }
  }

  if (Array.isArray(rules.required_qualifications) && rules.required_qualifications.length) {
    if (!Array.isArray(qualifications)) {
      addFinding(findings, rules, 'QUALIFICATIONS_UNKNOWN', 'required_qualifications', null, rules.required_qualifications,
        'Professional qualifications were not supplied for assessment', true);
    } else {
      const known = new Set(qualifications.map(value => String(value).trim().toLowerCase()));
      const missing = rules.required_qualifications.filter(value => !known.has(value.toLowerCase()));
      if (missing.length) addFinding(findings, rules, 'QUALIFICATION_REQUIRED', 'required_qualifications', missing,
        rules.required_qualifications, 'The professional is missing required qualifications');
    }
  }

  if (rules.location_policy === 'ASSIGNED_ONLY') {
    if (!candidate.location_id || !Array.isArray(eligible_location_ids)) {
      addFinding(findings, rules, 'LOCATION_ELIGIBILITY_UNKNOWN', 'location_policy', null, 'ASSIGNED_ONLY',
        'Location assignment evidence was not supplied for assessment', true);
    } else if (!eligible_location_ids.map(String).includes(String(candidate.location_id))) {
      addFinding(findings, rules, 'LOCATION_NOT_ASSIGNED', 'location_policy', candidate.location_id, eligible_location_ids,
        'The professional is not assigned to the proposed shift location');
    }
  }

  const state = overallState(findings);
  return Object.freeze({ ...base, state, findings: Object.freeze(findings), evaluated_at: new Date().toISOString() });
}

export function workforceSchedulingConstraintsContract() {
  return Object.freeze({
    contract_version: WORKFORCE_SCHEDULING_CONSTRAINTS_CONTRACT_VERSION,
    entity: 'workforce_scheduling_policy',
    organization_scoped: true,
    tenant_scoped: true,
    policy_versioned: true,
    policy_states: WORKFORCE_SCHEDULING_POLICY_STATES,
    configurable_rules: RULE_KEYS,
    evaluation_states: Object.freeze(['PASS','WARNING','BLOCKING_CONFLICT','UNKNOWN']),
    overrides_require_authorization_and_reason: true,
    owns_booking_or_delivery_commitments: false,
  });
}
