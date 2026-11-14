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
 * Re-evaluate a requested interval against the resource's current declared
 * hours inside the Service Booking transaction. This is only one prerequisite
 * to commitment; callers must still perform the authoritative overlap check.
 */
export function assessServiceResourceCommitWindow({ timeZone, workingHours = [], exceptions = [], start, end } = {}) {
  if (!isIanaTimeZone(timeZone)) {
    return { state: 'UNKNOWN', reason: 'TIMEZONE_NOT_CONFIGURED', confirmsAvailability: false };
  }
  const startMs = Date.parse(start), endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    fail('A valid increasing appointment interval is required', 'SERVICE_BOOKING_TIME_WINDOW_INVALID');
  }
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const parts = (instant) => Object.fromEntries(formatter.formatToParts(new Date(instant))
    .filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  const a = parts(startMs), b = parts(endMs);
  const localDate = `${a.year}-${a.month}-${a.day}`;
  if (`${b.year}-${b.month}-${b.day}` !== localDate) {
    return { state: 'UNKNOWN', reason: 'CROSS_LOCAL_DATE_WINDOW', confirmsAvailability: false };
  }
  const weekday = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 })[a.weekday];
  const startMinute = Number(a.hour) * 60 + Number(a.minute);
  const endMinute = Number(b.hour) * 60 + Number(b.minute);
  const exception = exceptions.find(item => item?.date === localDate);
  if (exception?.kind === 'CLOSED') {
    return { state: 'OUTSIDE_DECLARED_HOURS', reason: 'DATE_EXCEPTION_CLOSED', confirmsAvailability: false };
  }
  const intervals = exception?.kind === 'OPEN'
    ? [exception]
    : workingHours.filter(item => Number(item?.weekday) === weekday);
  if (!intervals.length) {
    return { state: 'OUTSIDE_DECLARED_HOURS', reason: 'NO_DECLARED_HOURS_FOR_DATE', confirmsAvailability: false };
  }
  const contained = intervals.some(interval => {
    const from = Number(String(interval.startTime).slice(0, 2)) * 60 + Number(String(interval.startTime).slice(3, 5));
    const to = Number(String(interval.endTime).slice(0, 2)) * 60 + Number(String(interval.endTime).slice(3, 5));
    return startMinute >= from && endMinute <= to;
  });
  return contained
    ? { state: 'WITHIN_DECLARED_HOURS', reason: exception?.kind === 'OPEN' ? 'DATE_EXCEPTION_OPEN' : 'WORKING_HOURS_MATCH', confirmsAvailability: false }
    : { state: 'OUTSIDE_DECLARED_HOURS', reason: 'OUTSIDE_DECLARED_HOURS', confirmsAvailability: false };
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
