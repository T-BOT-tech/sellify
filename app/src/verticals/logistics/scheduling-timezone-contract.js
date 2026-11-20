// L11 scheduling timezone contract.
// Pure local-wall-time conversion using the canonical IANA timezone supplied by
// the server. This module has no browser globals and owns no scheduling state.

export function localDateTimeToIso(value, timeZone) {
  const input = String(value || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(input);
  if (!match || !timeZone) {
    throw Object.assign(new Error('A local date/time and canonical IANA timezone are required'), {
      code: 'SCHEDULING_LOCAL_TIME_REQUIRED',
    });
  }
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const hour = Number(hourText), minute = Number(minuteText);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1
    || calendar.getUTCDate() !== day) {
    throw Object.assign(new Error('The local date is invalid'), { code: 'SCHEDULING_LOCAL_TIME_INVALID' });
  }
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
  } catch {
    throw Object.assign(new Error('The scheduling timezone is invalid'), { code: 'SCHEDULING_TIMEZONE_INVALID' });
  }
  const target = [yearText, monthText, dayText, hourText, minuteText].join('|');
  const base = Date.UTC(year, month - 1, day, hour, minute);
  const matches = [];
  for (let offsetMinutes = -14 * 60; offsetMinutes <= 14 * 60; offsetMinutes += 15) {
    const candidate = new Date(base + offsetMinutes * 60_000);
    const parts = Object.fromEntries(formatter.formatToParts(candidate).map(part => [part.type, part.value]));
    const local = [parts.year, parts.month, parts.day, parts.hour, parts.minute].join('|');
    if (local === target) matches.push(candidate);
  }
  if (matches.length === 0) {
    throw Object.assign(new Error('The selected local time does not exist in this timezone'), {
      code: 'SCHEDULING_LOCAL_TIME_NONEXISTENT',
    });
  }
  if (matches.length > 1) {
    throw Object.assign(new Error('The selected local time is ambiguous in this timezone'), {
      code: 'SCHEDULING_LOCAL_TIME_AMBIGUOUS',
    });
  }
  return matches[0].toISOString();
}

export function normalizeCandidateWindow(startValue, endValue, timeZone) {
  if (!startValue || !endValue || !timeZone) return null;
  try {
    const scheduledStart = localDateTimeToIso(startValue, timeZone);
    const scheduledEnd = localDateTimeToIso(endValue, timeZone);
    if (Date.parse(scheduledEnd) <= Date.parse(scheduledStart)) return null;
    return { scheduledStart, scheduledEnd, timezone: timeZone };
  } catch {
    return null;
  }
}
