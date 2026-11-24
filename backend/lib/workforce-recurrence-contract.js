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
  let guess = target;
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
  } catch {
    return null;
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const actual = Object.fromEntries(formatter.formatToParts(new Date(guess))
      .filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day,
      actual.hour, actual.minute, actual.second, parts.millisecond || 0);
    const delta = target - represented;
    if (delta === 0) break;
    guess += delta;
  }
  const check = localParts(new Date(guess).toISOString(), timeZone);
  if (!check || check.date !== dateKey(parts.year, parts.month, parts.day)
    || check.hour !== parts.hour || check.minute !== parts.minute || check.second !== parts.second) return null;
  return guess;
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
export function workforceAvailabilityCoversBooking(availability, booking) {
  if (!availability || !booking) return false;
  const startMs = Date.parse(booking.requested_start);
  const endMs = Date.parse(booking.requested_end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) return false;

  const ruleResult = validateWorkforceRecurrenceRule(availability.recurrence_rule);
  if (!ruleResult.valid) return false;
  const timeZone = String(availability.timezone || '').trim();
  const anchor = localParts(availability.starts_at, timeZone);
  const availabilityEnd = localParts(availability.ends_at, timeZone);
  const requestedStart = localParts(booking.requested_start, timeZone);
  const requestedEnd = localParts(booking.requested_end, timeZone);
  if (!anchor || !availabilityEnd || !requestedStart || !requestedEnd) return false;

  if (!ruleResult.parsed) {
    const availabilityStartMs = Date.parse(availability.starts_at);
    const availabilityEndMs = Date.parse(availability.ends_at);
    return Number.isFinite(availabilityStartMs) && Number.isFinite(availabilityEndMs)
      && availabilityStartMs <= startMs && availabilityEndMs >= endMs;
  }

  if (requestedStart.date !== requestedEnd.date) return false;
  if (anchor.date !== availabilityEnd.date) return false;
  const anchorEndMinutes = availabilityEnd.hour * 60 + availabilityEnd.minute;
  const anchorStartMinutes = anchor.hour * 60 + anchor.minute;
  if (anchorEndMinutes < anchorStartMinutes
    || (anchorEndMinutes === anchorStartMinutes && availabilityEnd.second <= anchor.second)) return false;
  if (requestedStart.date < anchor.date) return false;

  const from = effectiveDate(availability.effective_from);
  const through = effectiveDate(availability.effective_until);
  if (availability.effective_from && !from) return false;
  if (availability.effective_until && !through) return false;
  if (from && requestedStart.date < from) return false;
  if (through && requestedStart.date > through) return false;

  const parsed = ruleResult.parsed;
  const occurrenceIndex = recurrenceOccurrenceIndex(parsed, anchor, requestedStart);
  if (occurrenceIndex === null || (parsed.count !== null && occurrenceIndex > parsed.count)) return false;

  const occurrenceStart = localDateTimeToUtc({
    ...requestedStart, hour: anchor.hour, minute: anchor.minute,
    second: anchor.second, millisecond: anchor.millisecond,
  }, timeZone);
  const occurrenceEnd = localDateTimeToUtc({
    ...requestedStart, hour: availabilityEnd.hour, minute: availabilityEnd.minute,
    second: availabilityEnd.second, millisecond: availabilityEnd.millisecond,
  }, timeZone);
  if (occurrenceStart === null || occurrenceEnd === null || occurrenceStart >= occurrenceEnd) return false;

  if (parsed.until) {
    if (parsed.until.kind === 'date' && requestedStart.date > parsed.until.value) return false;
    if (parsed.until.kind === 'instant' && occurrenceStart > parsed.until.value) return false;
  }
  return occurrenceStart <= startMs && occurrenceEnd >= endMs;
}
