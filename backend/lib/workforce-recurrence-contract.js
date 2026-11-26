/**
 * Bounded recurrence contract for Workforce availability windows.
 *
 * DTSTART is availability.starts_at in availability.timezone. The occurrence
 * duration is the same local wall-clock interval on each matching date.
 * Supported rules are deliberately limited to DAILY and WEEKLY; unsupported
 * RFC 5545 features fail closed instead of being silently approximated.
 */

const DAY_CODES = Object.freeze(['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']);
const DAY_INDEX = new Map(DAY_CODES.map((value, index) => [value, index]));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UNTIL_DATE_RE = /^(\d{4})(\d{2})(\d{2})$/;
const UNTIL_UTC_RE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/;

function validDateParts(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function parseUntil(value) {
  const dateMatch = UNTIL_DATE_RE.exec(value);
  if (dateMatch) {
    const [, year, month, day] = dateMatch.map(Number);
    if (!validDateParts(year, month, day)) return null;
    return { kind: 'date', value: `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` };
  }
  const dateTimeMatch = UNTIL_UTC_RE.exec(value);
  if (!dateTimeMatch) return null;
  const [, year, month, day, hour, minute, second] = dateTimeMatch.map(Number);
  if (!validDateParts(year, month, day) || hour > 23 || minute > 59 || second > 59) return null;
  return {
    kind: 'instant',
    value: Date.UTC(year, month - 1, day, hour, minute, second),
  };
}

export function validateWorkforceRecurrenceRule(rule) {
  if (rule == null || rule === '') return Object.freeze({ valid: true, errors: [], parsed: null });
  const errors = [];
  if (typeof rule !== 'string' || rule.length > 256) {
    return Object.freeze({ valid: false, errors: ['recurrence_rule must be a string of at most 256 characters'], parsed: null });
  }

  const fields = {};
  for (const token of rule.split(';')) {
    const separator = token.indexOf('=');
    if (separator < 1 || separator === token.length - 1) {
      errors.push('recurrence_rule contains an invalid key/value component');
      continue;
    }
    const key = token.slice(0, separator).trim().toUpperCase();
    const value = token.slice(separator + 1).trim().toUpperCase();
    if (!['FREQ', 'INTERVAL', 'BYDAY', 'COUNT', 'UNTIL'].includes(key)) {
      errors.push(`recurrence_rule does not support ${key || 'an empty key'}`);
    } else if (Object.hasOwn(fields, key)) {
      errors.push(`recurrence_rule repeats ${key}`);
    } else {
      fields[key] = value;
    }
  }

  if (!['DAILY', 'WEEKLY'].includes(fields.FREQ)) {
    errors.push('recurrence_rule FREQ must be DAILY or WEEKLY');
  }
  const interval = fields.INTERVAL === undefined ? 1 : Number(fields.INTERVAL);
  if (!Number.isInteger(interval) || interval < 1 || interval > 366) {
    errors.push('recurrence_rule INTERVAL must be an integer from 1 to 366');
  }

  let byDay = null;
  if (fields.BYDAY !== undefined) {
    const values = fields.BYDAY.split(',');
    if (fields.FREQ !== 'WEEKLY' || !values.length
      || values.some(value => !DAY_INDEX.has(value))
      || new Set(values).size !== values.length) {
      errors.push('recurrence_rule BYDAY is supported only for WEEKLY rules and must contain unique weekday codes');
    } else {
      byDay = values.map(value => DAY_INDEX.get(value)).sort((a, b) => a - b);
    }
  }

  const count = fields.COUNT === undefined ? null : Number(fields.COUNT);
  if (fields.COUNT !== undefined && (!Number.isInteger(count) || count < 1 || count > 10000)) {
    errors.push('recurrence_rule COUNT must be an integer from 1 to 10000');
  }
  const until = fields.UNTIL === undefined ? null : parseUntil(fields.UNTIL);
  if (fields.UNTIL !== undefined && !until) {
    errors.push('recurrence_rule UNTIL must be YYYYMMDD or YYYYMMDDTHHmmssZ');
  }
  if (count !== null && until !== null) {
    errors.push('recurrence_rule cannot combine COUNT and UNTIL');
  }

  const parsed = errors.length ? null : Object.freeze({
    frequency: fields.FREQ,
    interval,
    by_day: byDay,
    count,
    until,
  });
  return Object.freeze({ valid: errors.length === 0, errors, parsed });
}

function dateKey(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function localParts(value, timeZone) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
  } catch {
    return null;
  }
  const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp))
    .filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  return {
    year: parts.year, month: parts.month, day: parts.day,
    hour: parts.hour, minute: parts.minute, second: parts.second,
    millisecond: new Date(timestamp).getUTCMilliseconds(),
    date: dateKey(parts.year, parts.month, parts.day),
    weekday: new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay(),
  };
}

function localDateTimeToUtc(parts, timeZone) {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day,
    parts.hour, parts.minute, parts.second, parts.millisecond || 0);
  const offsets = new Set();
  try {
    // Sample both sides of nearby timezone transitions. A single iterative
    // guess can silently choose one side of a repeated fall-back wall time.
    for (let hours = -48; hours <= 48; hours += 6) {
      const sample = target + hours * 3600000;
      const represented = localParts(new Date(sample).toISOString(), timeZone);
      if (!represented) return null;
      offsets.add(Date.UTC(represented.year, represented.month - 1, represented.day,
        represented.hour, represented.minute, represented.second, represented.millisecond) - sample);
    }
  } catch {
    return null;
  }
  const matches = [...offsets].map(offset => target - offset).filter(epoch => {
    const check = localParts(new Date(epoch).toISOString(), timeZone);
    return check && check.date === dateKey(parts.year, parts.month, parts.day)
      && check.hour === parts.hour && check.minute === parts.minute
      && check.second === parts.second && check.millisecond === (parts.millisecond || 0);
  });
  const unique = [...new Set(matches)];
  // Exactly one UTC instant must represent a local boundary. Zero means a
  // spring-forward gap; more than one means a fall-back ambiguity.
  return unique.length === 1 ? unique[0] : null;
}

function dayNumber(date) {
  const [year, month, day] = date.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function effectiveDate(value) {
  if (value == null || value === '') return null;
  const date = String(value).slice(0, 10);
  if (!DATE_RE.test(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  return validDateParts(year, month, day) ? date : null;
}

function recurrenceOccurrenceIndex(parsed, anchor, candidate) {
  const anchorDay = dayNumber(anchor.date);
  const candidateDay = dayNumber(candidate.date);
  const dayDifference = candidateDay - anchorDay;
  if (dayDifference < 0) return null;

  if (parsed.frequency === 'DAILY') {
    if (dayDifference % parsed.interval !== 0) return null;
    return dayDifference / parsed.interval + 1;
  }

  const anchorWeekStart = anchorDay - ((anchor.weekday + 6) % 7);
  const candidateWeekStart = candidateDay - ((candidate.weekday + 6) % 7);
  const weekDifference = Math.floor((candidateWeekStart - anchorWeekStart) / 7);
  if (weekDifference < 0 || weekDifference % parsed.interval !== 0) return null;
  const weekdays = parsed.by_day || [anchor.weekday];
  if (!weekdays.includes(candidate.weekday)) return null;

  const cycleIndex = weekDifference / parsed.interval;
  const firstWeekCount = weekdays.filter(day => day >= anchor.weekday).length;
  const priorOccurrences = cycleIndex === 0
    ? 0
    : firstWeekCount + (cycleIndex - 1) * weekdays.length;
  const currentWeekOccurrences = weekdays.filter(day =>
    day <= candidate.weekday && (cycleIndex > 0 || day >= anchor.weekday)).length;
  return priorOccurrences + currentWeekOccurrences;
}

/**
 * Returns true only when the complete requested booking interval is contained
 * in a concrete occurrence. Invalid rules, invalid local times, unsupported
 * features, and timezone gaps all fail closed.
 */
/**
 * Enumerates concrete occurrences intersecting a requested interval using the
 * existing bounded RRULE parser and timezone conversion rules. Invalid rules,
 * invalid windows, and nonexistent local times return valid:false.
 */
export function workforceAvailabilityOccurrencesInRange(availability, startsAt, endsAt) {
  if (!availability) return { valid: false, reason: 'Availability window is required', occurrences: [] };
  const startMs = Date.parse(startsAt);
  const endMs = Date.parse(endsAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
    return { valid: false, reason: 'A valid requested interval is required', occurrences: [] };
  }
  const ruleResult = validateWorkforceRecurrenceRule(availability.recurrence_rule);
  if (!ruleResult.valid) return { valid: false, reason: ruleResult.errors.join('; '), occurrences: [] };
  if (!ruleResult.parsed) {
    const windowStart = Date.parse(availability.starts_at);
    const windowEnd = Date.parse(availability.ends_at);
    if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowStart >= windowEnd) {
      return { valid: false, reason: 'One-time availability window must have a valid bounded interval', occurrences: [] };
    }
    return { valid: true, occurrences: windowStart < endMs && windowEnd > startMs
      ? [{ starts_at: new Date(windowStart).toISOString(), ends_at: new Date(windowEnd).toISOString() }] : [] };
  }

  const timeZone = String(availability.timezone || '').trim();
  const anchor = localParts(availability.starts_at, timeZone);
  const availabilityEnd = localParts(availability.ends_at, timeZone);
  const requestedStart = localParts(new Date(startMs).toISOString(), timeZone);
  const requestedEnd = localParts(new Date(endMs - 1).toISOString(), timeZone);
  if (!anchor || !availabilityEnd || !requestedStart || !requestedEnd) {
    return { valid: false, reason: 'Availability or requested timestamps could not be resolved in the IANA timezone', occurrences: [] };
  }
  if (anchor.date !== availabilityEnd.date) {
    return { valid: false, reason: 'Recurring availability windows must begin and end on the same local date', occurrences: [] };
  }
  const anchorEndMinutes = availabilityEnd.hour * 60 + availabilityEnd.minute;
  const anchorStartMinutes = anchor.hour * 60 + anchor.minute;
  if (anchorEndMinutes < anchorStartMinutes
    || (anchorEndMinutes === anchorStartMinutes
      && (availabilityEnd.second < anchor.second
        || (availabilityEnd.second === anchor.second && availabilityEnd.millisecond <= anchor.millisecond)))) {
    return { valid: false, reason: 'Recurring availability window end must be after its local start', occurrences: [] };
  }
  const from = effectiveDate(availability.effective_from);
  const through = effectiveDate(availability.effective_until);
  if ((availability.effective_from && !from) || (availability.effective_until && !through)) {
    return { valid: false, reason: 'Availability effective dates are invalid', occurrences: [] };
  }
  const dayCount = dayNumber(requestedEnd.date) - dayNumber(requestedStart.date) + 1;
  if (dayCount < 1 || dayCount > 366) {
    return { valid: false, reason: 'Requested interval exceeds the bounded recurrence evaluation window', occurrences: [] };
  }
  const occurrences = [];
  let date = requestedStart.date;
  while (date <= requestedEnd.date) {
    const [year, month, day] = date.split('-').map(Number);
    const candidate = {
      year, month, day, date, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
      hour: 0, minute: 0, second: 0, millisecond: 0,
    };
    if (date >= anchor.date && (!from || date >= from) && (!through || date <= through)) {
      const occurrenceIndex = recurrenceOccurrenceIndex(ruleResult.parsed, anchor, candidate);
      if (occurrenceIndex !== null && (ruleResult.parsed.count === null || occurrenceIndex <= ruleResult.parsed.count)) {
        const occurrenceStart = localDateTimeToUtc({
          ...candidate, hour: anchor.hour, minute: anchor.minute,
          second: anchor.second, millisecond: anchor.millisecond,
        }, timeZone);
        const occurrenceEnd = localDateTimeToUtc({
          ...candidate, hour: availabilityEnd.hour, minute: availabilityEnd.minute,
          second: availabilityEnd.second, millisecond: availabilityEnd.millisecond,
        }, timeZone);
        if (occurrenceStart === null || occurrenceEnd === null || occurrenceStart >= occurrenceEnd) {
          return { valid: false, reason: 'A recurring local-time boundary is nonexistent or invalid in the IANA timezone', occurrences: [] };
        }
        if (ruleResult.parsed.until && (ruleResult.parsed.until.kind === 'date'
          ? date > ruleResult.parsed.until.value : occurrenceStart > ruleResult.parsed.until.value)) {
          date = addDays(date, 1);
          continue;
        }
        if (occurrenceStart < endMs && occurrenceEnd > startMs) {
          occurrences.push({ starts_at: new Date(occurrenceStart).toISOString(), ends_at: new Date(occurrenceEnd).toISOString() });
        }
      }
    }
    date = addDays(date, 1);
  }
  return { valid: true, occurrences };
}

function addDays(date, count) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + count)).toISOString().slice(0, 10);
}

/**
 * Returns true only when one concrete availability occurrence contains the
 * complete requested interval. The occurrence enumeration is shared with
 * Workforce's four-state availability assessment.
 */
export function workforceAvailabilityCoversBooking(availability, booking) {
  if (!booking) return false;
  const startMs = Date.parse(booking.requested_start);
  const endMs = Date.parse(booking.requested_end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) return false;
  const result = workforceAvailabilityOccurrencesInRange(availability, booking.requested_start, booking.requested_end);
  return result.valid && result.occurrences.some(item =>
    Date.parse(item.starts_at) <= startMs && Date.parse(item.ends_at) >= endMs);
}
