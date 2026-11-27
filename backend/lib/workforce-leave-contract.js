/** Workforce planned leave and unplanned absence contracts. */
export const WORKFORCE_LEAVE_CONTRACT_VERSION = '1.0';
export const WORKFORCE_LEAVE_CATEGORIES = Object.freeze(['ANNUAL','SICK','PERSONAL','UNPAID','PARENTAL','BEREAVEMENT','OTHER']);
export const WORKFORCE_LEAVE_STATUSES = Object.freeze(['DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','WITHDRAWN','CANCELLED']);
export const WORKFORCE_LEAVE_TRANSITIONS = Object.freeze({
  submit: Object.freeze({ from: ['DRAFT'], to: 'PENDING_APPROVAL' }),
  approve: Object.freeze({ from: ['PENDING_APPROVAL'], to: 'APPROVED' }),
  reject: Object.freeze({ from: ['PENDING_APPROVAL'], to: 'REJECTED' }),
  withdraw: Object.freeze({ from: ['DRAFT','PENDING_APPROVAL'], to: 'WITHDRAWN' }),
  cancel: Object.freeze({ from: ['APPROVED'], to: 'CANCELLED' }),
});
export const WORKFORCE_ABSENCE_TYPES = Object.freeze(['SICKNESS','UNPLANNED','NO_SHOW','OTHER']);
export const WORKFORCE_ABSENCE_STATUSES = Object.freeze(['RECORDED','VOIDED']);
export const WORKFORCE_ABSENCE_TRANSITIONS = Object.freeze({ void: Object.freeze({ from: ['RECORDED'], to: 'VOIDED' }) });

export function isValidWorkforceLeaveCategory(value) { return WORKFORCE_LEAVE_CATEGORIES.includes(String(value || '').trim().toUpperCase()); }
export function isValidWorkforceAbsenceType(value) { return WORKFORCE_ABSENCE_TYPES.includes(String(value || '').trim().toUpperCase()); }
function validTimezone(value) {
  try { if (typeof value !== 'string' || !value.trim()) return false; new Intl.DateTimeFormat('en-US', { timeZone: value }); return true; }
  catch { return false; }
}
function validDateRange(input = {}) {
  const errors = [];
  for (const field of ['starts_at','ends_at']) {
    const value = input[field];
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || !/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
      errors.push(field + ' must be an ISO-8601 timestamp with an explicit timezone');
    }
  }
  if (typeof input.starts_at === 'string' && typeof input.ends_at === 'string'
    && Number.isFinite(Date.parse(input.starts_at)) && Number.isFinite(Date.parse(input.ends_at))
    && Date.parse(input.starts_at) >= Date.parse(input.ends_at)) errors.push('starts_at must be before ends_at');
  if (!validTimezone(input.timezone)) errors.push('timezone must be a valid IANA timezone');
  if (input.all_day !== undefined && typeof input.all_day !== 'boolean') errors.push('all_day must be a boolean');
  return errors;
}
function validReason(value, field = 'reason', required = true) {
  if (value === undefined && !required) return [];
  if (typeof value !== 'string' || (required && !value.trim()) || value.trim().length > 1000) {
    return [field + ' must be a non-empty string of at most 1000 characters'];
  }
  return [];
}
export function validateWorkforceLeaveRequest(input = {}, { partial = false } = {}) {
  const errors = [];
  if (!partial || input.leave_category !== undefined) {
    if (!isValidWorkforceLeaveCategory(input.leave_category)) errors.push('leave_category is not a supported Workforce leave category');
  }
  if (!partial || input.starts_at !== undefined || input.ends_at !== undefined || input.timezone !== undefined) errors.push(...validDateRange(input));
  if (!partial || input.reason !== undefined) errors.push(...validReason(input.reason));
  return Object.freeze({ valid: errors.length === 0, errors });
}
export function validateWorkforceAbsence(input = {}, { partial = false } = {}) {
  const errors = [];
  if (!partial || input.absence_type !== undefined) {
    if (!isValidWorkforceAbsenceType(input.absence_type)) errors.push('absence_type is not a supported Workforce absence type');
  }
  if (!partial || input.starts_at !== undefined || input.ends_at !== undefined || input.timezone !== undefined) errors.push(...validDateRange(input));
  if (!partial || input.reason !== undefined) errors.push(...validReason(input.reason));
  return Object.freeze({ valid: errors.length === 0, errors });
}
export function validateWorkforceLeaveTransition(action, input = {}) {
  const errors = [];
  if (action === 'reject' && (typeof input.decision_reason !== 'string' || !input.decision_reason.trim() || input.decision_reason.trim().length > 500)) {
    errors.push('decision_reason is required for rejection and must not exceed 500 characters');
  }
  if (action === 'approve' && input.decision_reason !== undefined
    && (typeof input.decision_reason !== 'string' || input.decision_reason.trim().length > 500)) {
    errors.push('decision_reason must be a string of at most 500 characters');
  }
  if (['cancel','void'].includes(action) && (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.trim().length > 500)) {
    errors.push('reason is required and must not exceed 500 characters');
  }
  if (action === 'withdraw' && input.reason !== undefined
    && (typeof input.reason !== 'string' || input.reason.trim().length > 500)) errors.push('reason must be a string of at most 500 characters');
  return Object.freeze({ valid: errors.length === 0, errors });
}
export function workforceLeaveAvailabilityEffect(status) {
  return status === 'APPROVED' ? 'UNAVAILABLE' : status === 'PENDING_APPROVAL' ? 'TENTATIVE' : 'NO_EFFECT';
}
export function workforceAbsenceAvailabilityEffect(status) {
  return status === 'RECORDED' ? 'UNAVAILABLE' : 'NO_EFFECT';
}
