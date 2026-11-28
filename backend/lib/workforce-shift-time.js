/**
 * Local wall-clock scheduling helpers. Ambiguous and nonexistent local
 * times are rejected instead of silently shifting a generated shift.
 */

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw Object.assign(new Error('date must use YYYY-MM-DD'), { code: 'WORKFORCE_SHIFT_DATE_INVALID', statusCode: 400 });
  }
  const [year, month, day] = value.split('-').map(Number);
  const epoch = Date.UTC(year, month - 1, day);
  const check = new Date(epoch);
  if (year < 1000 || check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) {
    throw Object.assign(new Error('date must be a real calendar date'), { code: 'WORKFORCE_SHIFT_DATE_INVALID', statusCode: 400 });
  }
  return { year, month, day, epoch };
}

function parseTime(value) {
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw Object.assign(new Error('local time must use HH:MM'), { code: 'WORKFORCE_SHIFT_LOCAL_TIME_INVALID', statusCode: 400 });
  }
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function localParts(epoch, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(epoch));
  const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  return { year: values.year, month: values.month, day: values.day, hour: values.hour, minute: values.minute, second: values.second };
}

function sameLocal(parts, date, time) {
  const parsedDate = parseDate(date);
  const minute = parseTime(time);
  return parts.year === parsedDate.year && parts.month === parsedDate.month && parts.day === parsedDate.day
    && parts.hour === Math.floor(minute / 60) && parts.minute === minute % 60 && parts.second === 0;
}

/**
 * Resolve one local date/time to UTC. Repeated fall-back times and skipped
 * spring-forward times are explicit errors requiring an operator decision.
 */
export function localDateTimeToUtc(date, time, timezone) {
  const parsedDate = parseDate(date);
  const minute = parseTime(time);
  if (typeof timezone !== 'string' || !timezone.trim()) {
    throw Object.assign(new Error('timezone is required'), { code: 'WORKFORCE_TIMEZONE_INVALID', statusCode: 400 });
  }
  const target = parsedDate.epoch + minute * 60000;
  const offsets = new Set();
  try {
    for (let hours = -48; hours <= 48; hours += 6) {
      const sample = target + hours * 3600000;
      const parts = localParts(sample, timezone);
      offsets.add(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - sample);
    }
  } catch {
    throw Object.assign(new Error('timezone must be a valid IANA timezone'), { code: 'WORKFORCE_TIMEZONE_INVALID', statusCode: 400 });
  }
  const matches = [...offsets]
    .map(offset => target - offset)
    .filter(epoch => sameLocal(localParts(epoch, timezone), date, time));
  const unique = [...new Set(matches)].sort((a,b) => a-b);
  if (unique.length === 0) {
    throw Object.assign(new Error('local time does not exist because of a timezone transition'), {
      code: 'WORKFORCE_SHIFT_LOCAL_TIME_NONEXISTENT', statusCode: 422,
    });
  }
  if (unique.length > 1) {
    throw Object.assign(new Error('local time is ambiguous because of a timezone transition'), {
      code: 'WORKFORCE_SHIFT_LOCAL_TIME_AMBIGUOUS', statusCode: 422,
    });
  }
  return new Date(unique[0]).toISOString();
}

export function addLocalMinutes(date, minutes) {
  const parsed = parseDate(date);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 2880) {
    throw Object.assign(new Error('local minute offset is outside the supported shift window'), {
      code: 'WORKFORCE_SHIFT_LOCAL_TIME_INVALID', statusCode: 400,
    });
  }
  const value = new Date(parsed.epoch + minutes * 60000);
  const pad = number => String(number).padStart(2, '0');
  return {
    date: value.toISOString().slice(0, 10),
    time: pad(value.getUTCHours()) + ':' + pad(value.getUTCMinutes()),
  };
}

export function isoWeekday(date) {
  const parsed = parseDate(date);
  const day = new Date(parsed.epoch).getUTCDay();
  return day === 0 ? 7 : day;
}

export function buildShiftWindowFromTemplate(template, localDate) {
  const startMinute = parseTime(template.start_local_time);
  const endMinute = parseTime(template.end_local_time);
  const duration = (endMinute - startMinute + 1440) % 1440;
  if (!duration) throw Object.assign(new Error('shift template duration must be non-zero'), {
    code: 'WORKFORCE_TEMPLATE_DURATION_INVALID', statusCode: 400,
  });
  const start = localDateTimeToUtc(localDate, template.start_local_time, template.timezone);
  const endLocal = addLocalMinutes(localDate, startMinute + duration);
  const end = localDateTimeToUtc(endLocal.date, endLocal.time, template.timezone);
  if (Date.parse(end) <= Date.parse(start)) {
    throw Object.assign(new Error('resolved shift end must be after its start'), {
      code: 'WORKFORCE_SHIFT_WINDOW_INVALID', statusCode: 422,
    });
  }
  const breaks = (Array.isArray(template.break_rules) ? template.break_rules : []).map(rule => {
    const breakStartMinute = parseTime(rule.start_local_time);
    const breakEndMinute = parseTime(rule.end_local_time);
    const offset = (breakStartMinute - startMinute + 1440) % 1440;
    const breakDuration = (breakEndMinute - breakStartMinute + 1440) % 1440;
    if (!breakDuration || offset + breakDuration > duration) {
      throw Object.assign(new Error('break interval must fit inside the shift template'), {
        code: 'WORKFORCE_BREAK_RULES_INVALID', statusCode: 400,
      });
    }
    const breakStartLocal = addLocalMinutes(localDate, startMinute + offset);
    const breakEndLocal = addLocalMinutes(localDate, startMinute + offset + breakDuration);
    const breakStart = localDateTimeToUtc(breakStartLocal.date, breakStartLocal.time, template.timezone);
    const breakEnd = localDateTimeToUtc(breakEndLocal.date, breakEndLocal.time, template.timezone);
    const durationMinutes = (Date.parse(breakEnd) - Date.parse(breakStart)) / 60000;
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      throw Object.assign(new Error('resolved break duration must be positive'), {
        code: 'WORKFORCE_BREAK_RULES_INVALID', statusCode: 422,
      });
    }
    return { starts_at: breakStart, duration_minutes: durationMinutes };
  });
  return Object.freeze({ local_date: localDate, starts_at: start, ends_at: end, timezone: template.timezone, break_rules: breaks });
}
