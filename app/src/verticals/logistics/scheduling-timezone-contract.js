// L11 scheduling local-time conversion boundary.
// Uses the canonical IANA timezone supplied by the server; never the browser timezone.
export function logisticsLocalDateTimeToIso(value, timeZone) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match) {
    throw Object.assign(new TypeError('Local date-time must use YYYY-MM-DDTHH:mm'), {
      code: 'SCHEDULING_LOCAL_TIME_INVALID',
    });
  }
  if (!timeZone) {
    throw Object.assign(new TypeError('Canonical scheduling timezone is required'), {
      code: 'SCHEDULING_TIMEZONE_REQUIRED',
    });
  }

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const [year, month, day, hour, minute] = [yearText, monthText, dayText, hourText, minuteText].map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(target);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month
      || check.getUTCDate() !== day || check.getUTCHours() !== hour
      || check.getUTCMinutes() !== minute) {
    throw Object.assign(new TypeError('Invalid local date-time'), {
      code: 'SCHEDULING_LOCAL_TIME_INVALID',
    });
  }

  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
  } catch {
    throw Object.assign(new TypeError('Invalid canonical scheduling timezone'), {
      code: 'SCHEDULING_TIMEZONE_INVALID',
    });
  }

  const matches = [];
  for (let offsetMinutes = -14 * 60; offsetMinutes <= 14 * 60; offsetMinutes += 15) {
    const instant = target + offsetMinutes * 60_000;
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant))
      .filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
    if (parts.year === year && parts.month === month && parts.day === day
        && parts.hour === hour && parts.minute === minute) matches.push(instant);
  }

  if (matches.length === 0) {
    throw Object.assign(new TypeError('Local time does not exist in the canonical timezone'), {
      code: 'SCHEDULING_LOCAL_TIME_NONEXISTENT',
    });
  }
  if (matches.length > 1) {
    throw Object.assign(new TypeError('Local time is ambiguous in the canonical timezone'), {
      code: 'SCHEDULING_LOCAL_TIME_AMBIGUOUS',
    });
  }
  return new Date(matches[0]).toISOString();
}
