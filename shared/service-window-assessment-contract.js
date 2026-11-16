// SC-03.3 — Shared Service resource declared-window assessment contract.
// Runtime-neutral logic used by the browser projection and backend commitment guard.
// This is a projection over declared working hours and exceptions only.
// It does not inspect appointments/commitments, confirm availability,
// authorize booking, reserve a resource, or mutate any canonical authority.

const WEEKDAYS = Object.freeze({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 });
const ISO_WITH_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

function invalid(message, code = 'SERVICE_WINDOW_ASSESSMENT_INVALID') {
  const error = new TypeError(message);
  error.code = code;
  throw error;
}

function localParts(instant, timeZone) {
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      weekday: 'short', hour: '2-digit', minute: '2-digit',
      second: '2-digit', hourCycle: 'h23',
    });
  } catch {
    invalid('A valid IANA timezone is required', 'SERVICE_WINDOW_TIMEZONE_INVALID');
  }
  const parts = Object.fromEntries(formatter.formatToParts(instant)
    .filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return {
    date: parts.year + '-' + parts.month + '-' + parts.day,
    weekday: WEEKDAYS[parts.weekday],
    minute: Number(parts.hour) * 60 + Number(parts.minute) + Number(parts.second) / 60,
  };
}

function parseInstant(value, field) {
  const text = String(value ?? '').trim();
  if (!text || !ISO_WITH_ZONE.test(text) || !Number.isFinite(Date.parse(text))) {
    invalid(field + ' must be an ISO-8601 timestamp with an explicit timezone');
  }
  return new Date(text);
}

function intervalContains(interval, startMinute, endMinute) {
  const toMinutes = value => {
    if (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)) {
      const [h, m] = value.split(':').map(Number);
      return h * 60 + m;
    }
    return Number(value);
  };
  const startValue = toMinutes(interval.startTime ?? interval.start_time);
  const endValue = toMinutes(interval.endTime ?? interval.end_time);
  return Number.isFinite(startValue) && Number.isFinite(endValue) &&
    startValue <= startMinute && endMinute <= endValue;
}

function result(scheduleAssessment, reason, extra = {}) {
  return Object.freeze({
    contract_version: '1.0',
    scheduleAssessment,
    reason,
    capacityEvaluation: 'UNKNOWN',
    availabilityConfirmed: false,
    feasible: false,
    authorized: false,
    execution: false,
    persistence: 'none',
    mutation: false,
    ...extra,
  });
}

/**
 * Assess whether a requested interval falls inside declared local working
 * hours. A match is not availability: existing commitments are not evaluated.
 */
export function assessServiceResourceDeclaredWindow({
  timeZone, workingHours = [], exceptions = [], start, end,
} = {}) {
  if (!Array.isArray(workingHours) || !Array.isArray(exceptions)) {
    invalid('workingHours and exceptions must be arrays');
  }
  if (!String(timeZone ?? '').trim()) {
    return result('UNKNOWN', 'TIMEZONE_NOT_CONFIGURED');
  }
  const startInstant = parseInstant(start, 'start');
  const endInstant = parseInstant(end, 'end');
  if (endInstant <= startInstant) invalid('end must be later than start', 'SERVICE_WINDOW_INVALID');
  const startLocal = localParts(startInstant, timeZone);
  const endLocal = localParts(endInstant, timeZone);
  if (startLocal.date !== endLocal.date) {
    return result('UNKNOWN', 'CROSS_LOCAL_DATE_WINDOW');
  }
  if (!workingHours.length && !exceptions.some(item => item?.date === startLocal.date)) {
    return result('UNKNOWN', 'NO_DECLARED_SCHEDULE');
  }

  const exception = exceptions.find(item => item?.date === startLocal.date);
  let intervals;
  if (exception?.kind === 'CLOSED') {
    return result('OUTSIDE_DECLARED_HOURS', 'DATE_EXCEPTION_CLOSED');
  }
  if (exception?.kind === 'OPEN') {
    intervals = [exception];
  } else {
    intervals = workingHours.filter(item => Number(item?.weekday) === startLocal.weekday);
  }

  const contained = intervals.some(interval =>
    intervalContains(interval, startLocal.minute, endLocal.minute));
  return contained
    ? result('WITHIN_DECLARED_HOURS', exception?.kind === 'OPEN' ? 'DATE_EXCEPTION_OPEN' : 'WEEKLY_HOURS_MATCH')
    : result('OUTSIDE_DECLARED_HOURS', exception ? 'DATE_EXCEPTION_WINDOW_MISMATCH' : 'NO_MATCHING_WORKING_INTERVAL');
}

/**
 * Convert a datetime-local input to an ISO instant in the supplied IANA zone.
 * Ambiguous daylight-saving times and nonexistent local times fail closed.
 */
export function serviceLocalDateTimeToIso(value, timeZone) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value ?? ''));
  if (!match) invalid('A valid local date and time are required', 'SERVICE_WINDOW_LOCAL_TIME_INVALID');
  const target = match.slice(1).map(Number);
  const naive = Date.UTC(target[0], target[1] - 1, target[2], target[3], target[4]);
  const matches = [];
  for (let delta = -14 * 60; delta <= 14 * 60; delta += 15) {
    const candidate = new Date(naive + delta * 60_000);
    const local = localParts(candidate, timeZone);
    if (local.date === match[1] + '-' + match[2] + '-' + match[3] &&
        Math.floor(local.minute / 60) === target[3] &&
        Math.floor(local.minute % 60) === target[4]) matches.push(candidate);
  }
  if (matches.length !== 1) {
    invalid(matches.length ? 'This local time is ambiguous in the selected timezone' : 'This local time does not exist in the selected timezone', 'SERVICE_WINDOW_LOCAL_TIME_AMBIGUOUS');
  }
  return matches[0].toISOString();
}
