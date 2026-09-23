// config/payment-methods.js
// Phase 3 extraction (see modularization plan §5): payment-method config
// helpers (settings-tab CRUD over config.paymentMethods), moved out of
// main.js unchanged.
import { config, currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';
import { escapeHtml, escapeAttr } from '../utils/index.js';

// ---------- Payment methods ----------
// (DEFAULT_PAYMENT_METHODS now comes from constants.js.)
export function renderPaymentMethodsSettings() {
  const canManage = hasPermission(currentStaff ? currentStaff.role : 'owner', 'paymethods:manage');
  const container = document.getElementById('paymentMethodsList');
  container.innerHTML = (config.paymentMethods || []).map((pm, idx) => `
    <div class="paymethod-row">
      <input type="checkbox" ${pm.enabled ? 'checked' : ''} ${canManage ? '' : 'disabled'} onchange="togglePaymentMethodEnabled(${idx})">
      <span class="pm-name">${escapeHtml(pm.name)}</span>
      ${pm.type !== 'cash' ? `<input type="text" class="pm-details" value="${escapeAttr(pm.details || '')}" placeholder="Account / number" ${canManage ? '' : 'disabled'} onchange="updatePaymentMethodDetails(${idx}, this.value)">` : ''}
      ${(pm.type !== 'cash' && canManage) ? `<button type="button" class="pm-remove" onclick="removePaymentMethod(${idx})" title="Remove"><svg class="icon icon-sm"><use href="#i-close"/></svg></button>` : ''}
    </div>
  `).join('');
}

export function togglePaymentMethodEnabled(idx) {
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'paymethods:manage')) return;
  config.paymentMethods[idx].enabled = !config.paymentMethods[idx].enabled;
}

export function updatePaymentMethodDetails(idx, value) {
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'paymethods:manage')) return;
  config.paymentMethods[idx].details = value;
}

export function removePaymentMethod(idx) {
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'paymethods:manage')) return;
  config.paymentMethods.splice(idx, 1);
  renderPaymentMethodsSettings();
}

export function addCustomPaymentMethod() {
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'paymethods:manage')) return;
  const input = document.getElementById('newPayMethodName');
  const name = input.value.trim();
  if (!name) return;
  const id = 'pm_' + name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
  config.paymentMethods.push({ id, name, enabled: true, type: 'digital', details: '' });
  input.value = '';
  renderPaymentMethodsSettings();
}
