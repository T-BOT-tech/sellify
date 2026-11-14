/**
 * SC-03.2 Service Resource Availability Contract.
 *
 * Service Pack owns recurring working-hour declarations and date exceptions.
 * This contract validates configuration only. It does not claim a resource is
 * free, evaluate appointment conflicts, reserve time, or confirm a booking.
 */
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(message, code) {
  throw Object.assign(new Error(message), { statusCode: 400, code });
}

export function isIanaTimeZone(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

function validDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function normalizeInterval(input, codePrefix) {
  const startTime = String(input?.startTime ?? input?.start_time ?? '').trim();
  const endTime = String(input?.endTime ?? input?.end_time ?? '').trim();
  if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime) || startTime >= endTime) {
    fail('Availability interval must use valid HH:mm times and end after start on the same local day', codePrefix + '_INTERVAL_INVALID');
  }
  return { startTime, endTime };
}

function assertNoOverlap(intervals, code) {
  const sorted = [...intervals].sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].startTime < sorted[i - 1].endTime) {
      fail('Availability intervals must not overlap', code);
    }
  }
}

export function normalizeWorkingHours(input, timeZone) {
  if (!isIanaTimeZone(timeZone)) fail('A valid IANA organization timezone is required', 'SERVICE_AVAILABILITY_TIMEZONE_INVALID');
  if (!Array.isArray(input)) fail('Working hours must be an array', 'SERVICE_WORKING_HOURS_INVALID');
  const grouped = new Map();
  const entries = input.map((item) => {
    const weekday = Number(item?.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      fail('Working-hours weekday must be an integer from 0 (Sunday) to 6 (Saturday)', 'SERVICE_WORKING_HOURS_WEEKDAY_INVALID');
    }
    const interval = normalizeInterval(item, 'SERVICE_WORKING_HOURS');
    const entry = { weekday, ...interval };
    if (!grouped.has(weekday)) grouped.set(weekday, []);
    grouped.get(weekday).push(entry);
    return entry;
  });
  for (const intervals of grouped.values()) assertNoOverlap(intervals, 'SERVICE_WORKING_HOURS_OVERLAP');
  return { timeZone, entries: entries.sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime)) };
}

export function normalizeAvailabilityExceptions(input) {
  if (!Array.isArray(input)) fail('Availability exceptions must be an array', 'SERVICE_AVAILABILITY_EXCEPTIONS_INVALID');
  const seen = new Set();
  const entries = input.map((item) => {
    const date = String(item?.date ?? '').trim();
    if (!validDate(date)) fail('Availability exception date must be a real YYYY-MM-DD date', 'SERVICE_AVAILABILITY_EXCEPTION_DATE_INVALID');
    const kind = String(item?.kind ?? '').trim().toUpperCase();
    if (!['CLOSED', 'OPEN'].includes(kind)) fail('Availability exception kind must be CLOSED or OPEN', 'SERVICE_AVAILABILITY_EXCEPTION_KIND_INVALID');
    if (seen.has(date)) fail('Only one exception record is allowed per resource and local date', 'SERVICE_AVAILABILITY_EXCEPTION_DUPLICATE');
    seen.add(date);
    if (kind === 'CLOSED') {
      return { date, kind, startTime: null, endTime: null, note: String(item?.note ?? '').trim().slice(0, 500) };
    }
    const interval = normalizeInterval(item, 'SERVICE_AVAILABILITY_EXCEPTION');
    return { date, kind, ...interval, note: String(item?.note ?? '').trim().slice(0, 500) };
  });
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * A configured schedule is only declared working time. Until authoritative
 * resource commitments/conflicts are queried, feasibility must remain UNKNOWN.
 */
export function projectServiceAvailabilityState({ scheduleConfigured = false } = {}) {
  return Object.freeze({
    state: 'UNKNOWN',
    reason: scheduleConfigured ? 'RESOURCE_COMMITMENTS_NOT_EVALUATED' : 'WORKING_HOURS_NOT_CONFIGURED',
    confirmsAvailability: false,
    authorizesBooking: false,
    commitsResource: false,
  });
}

export const SERVICE_AVAILABILITY_CONTRACT_VERSION = '1.0.0';
