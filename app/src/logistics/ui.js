// logistics/ui.js
// Phase 6 extraction (see modularization plan §5): the Logistics tab list
// and the Order-tab fulfillment-type picker — moved out of main.js
// unchanged.
//
// NOTE on the `../main.js` import below: switchTab still lives in main.js
// at this phase. Importing it back from main.js creates a harmless
// circular import, the same temporary pattern storage/json.js established
// — see that file for the fuller explanation. See fulfillment.js for the
// matching note on the circular import in the other direction.
import { escapeHtml, escapeAttr } from '../utils/index.js';
import { config, orders, warehouseLocations } from '../state.js';
import {
  isLogisticsEnabled, selectedFulfillmentType, setSelectedFulfillmentType,
  nextFulfillmentStatus, isFulfillmentFinal, fulfillmentStatusLabel, canonicalDeliveryAssignment,
  refreshDeliveryAssignments, transitionDeliveryAssignmentForOrder, assignDeliveryCourierForOrder, listLogisticsStaff
} from './fulfillment.js';
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { t } from '../ui/i18n.js';
import { switchTab } from '../ui/tabs.js';

export function applyLogisticsUI() {
  const enabled = isLogisticsEnabled();
  const navBtn = document.getElementById('navLogistics');
  if (navBtn) navBtn.style.display = enabled ? '' : 'none';

  const activeLogistics = document.getElementById('tab-logistics');
  if (!enabled && activeLogistics && activeLogistics.style.display === 'block') {
    switchTab('order');
  }
  renderOrderFulfillmentPicker();
  refreshDeliveryAssignments();
}

export function renderOrderFulfillmentPicker() {
  const wrap = document.getElementById('fulfillmentPickerWrap');
  if (!wrap) return;
  if (!isLogisticsEnabled()) {
    wrap.style.display = 'none';
    setSelectedFulfillmentType(null);
    return;
  }
  wrap.style.display = 'block';
  document.querySelectorAll('.fulfillment-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.ftype === selectedFulfillmentType);
  });
  document.getElementById('fulfillmentDeliveryFields').style.display = (selectedFulfillmentType === 'delivery') ? 'block' : 'none';
  document.getElementById('fulfillmentPickupFields').style.display = (selectedFulfillmentType === 'pickup') ? 'block' : 'none';

  const locSel = document.getElementById('fulfillmentPickupLocation');
  if (locSel) {
    locSel.innerHTML = `<option value="">—</option>` + warehouseLocations.map(l => `<option value="${escapeAttr(l.name)}">${escapeHtml(l.name)}</option>`).join('');
  }
}

export function setFulfillmentType(type) {
  setSelectedFulfillmentType(selectedFulfillmentType === type ? null : type);
  renderOrderFulfillmentPicker();
}

export function renderLogistics() {
  const list = document.getElementById('logisticsList');
  if (!list) return;
  const pending = orders.filter(o => o.fulfillment_type && !isFulfillmentFinal(o.fulfillment_status));
  const done = orders.filter(o => o.fulfillment_type && isFulfillmentFinal(o.fulfillment_status)).slice(0, 20);

  if (pending.length === 0 && done.length === 0) {
    list.innerHTML = `<div class="empty">${t('whNoLogisticsOrders')}</div>`;
    return;
  }

  const renderCard = (o) => {
    const isDelivery = o.fulfillment_type === 'delivery';
    const next = nextFulfillmentStatus(o);
    const assignment = canonicalDeliveryAssignment(o);
    const authRoles = new Set([
      ...(Array.isArray(config.authRoles) ? config.authRoles : []),
      ...(Array.isArray(config.contextualRoles) ? config.contextualRoles.map(r => r.role) : []),
    ]);
    const canDispatch = authRoles.has('owner') || authRoles.has('manager') || authRoles.has('logistics_manager') || authRoles.has('logistics_dispatcher');
    const canCourierAct = authRoles.has('logistics_courier');
    const assignmentLine = isDelivery && assignment
      ? `<div class="logistics-meta"><svg class="icon icon-sm"><use href="#i-truck"/></svg> ${escapeHtml(assignment.courier_name || assignment.courier_user_id || 'Assigned courier')} · ${escapeHtml(assignment.status)}</div>`
      : '';
    const assignmentControls = isDelivery && canDispatch
      ? `<div class="logistics-meta" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <select class="delivery-courier-select" data-order-id="${escapeAttr(o.id)}"><option value="">Assign courier…</option></select>
          <button type="button" class="btn-secondary delivery-assign-btn" data-order-id="${escapeAttr(o.id)}">${assignment ? 'Reassign' : 'Assign'}</button>
        </div>`
      : '';
    const courierControls = isDelivery && canCourierAct && assignment
      ? `<div class="logistics-meta" style="display:flex;gap:6px;flex-wrap:wrap;">
          ${assignment.status === 'ASSIGNED' ? `<button type="button" class="btn-secondary delivery-action-btn" data-action="ACCEPTED" data-order-id="${escapeAttr(o.id)}">Accept</button>` : ''}
          ${assignment.status === 'ACCEPTED' ? `<button type="button" class="btn-secondary delivery-action-btn" data-action="OUT_FOR_DELIVERY" data-order-id="${escapeAttr(o.id)}">Start delivery</button>` : ''}
          ${assignment.status === 'OUT_FOR_DELIVERY' ? `<input class="delivery-proof-input" data-order-id="${escapeAttr(o.id)}" placeholder="Proof / reference" style="max-width:150px;"><button type="button" class="btn-secondary delivery-action-btn" data-action="DELIVERED" data-order-id="${escapeAttr(o.id)}">Complete</button>` : ''}
        </div>`
      : '';
    const itemsSummary = (o.items || []).map(i => `${i.qty}× ${escapeHtml(i.name)}`).join(', ');
    const destLine = isDelivery
      ? (o.delivery_address ? `<svg class="icon icon-sm"><use href="#i-pin"/></svg> ${escapeHtml(o.delivery_address)}` : '')
      : (o.pickup_location ? `<svg class="icon icon-sm"><use href="#i-pin"/></svg> ${escapeHtml(o.pickup_location)}` : '');
    const scheduledLine = o.scheduled_time ? `<svg class="icon icon-sm"><use href="#i-clock"/></svg> ${escapeHtml(o.scheduled_time)}` : '';
    const customerLine = o.customer_name ? `<svg class="icon icon-sm"><use href="#i-user"/></svg> ${escapeHtml(o.customer_name)}${o.customer_phone ? ' · ' + escapeHtml(o.customer_phone) : ''}` : '';
    return `
      <div class="logistics-card">
        <div class="logistics-top">
          <span class="logistics-type"><svg class="icon icon-sm"><use href="#i-${isDelivery ? 'truck' : 'store'}"/></svg> ${t(isDelivery ? 'whDelivery' : 'whPickup')}</span>
          <span class="logistics-status status-${o.fulfillment_status}">${fulfillmentStatusLabel(o.fulfillment_status)}</span>
        </div>
        <div class="logistics-items">${itemsSummary}</div>
        ${customerLine ? `<div class="logistics-meta">${customerLine}</div>` : ''}
        ${destLine ? `<div class="logistics-meta">${destLine}</div>` : ''}
        ${scheduledLine ? `<div class="logistics-meta">${scheduledLine}</div>` : ''}
        ${assignmentLine}
        ${assignmentControls}
        ${courierControls}
        ${next ? `<button type="button" class="btn-secondary" style="width:auto; margin:8px 0 0; padding:8px 14px;" onclick="advanceFulfillmentOrder('${o.id}')">${t('whAdvanceTo')} ${fulfillmentStatusLabel(next)}</button>` : ''}
      </div>`;
  };

  let html = '';
  if (pending.length > 0) {
    html += `<div class="settings-section-label">${t('whPendingFulfillment')}</div>` + pending.map(renderCard).join('');
  }
  if (done.length > 0) {
    html += `<div class="settings-section-label">${t('whCompletedFulfillment')}</div>` + done.map(renderCard).join('');
  }
  list.innerHTML = html;

  if (list.dataset.deliveryHandlersBound !== '1') {
    list.dataset.deliveryHandlersBound = '1';
    list.addEventListener('click', async (event) => {
      const assignBtn = event.target.closest('.delivery-assign-btn');
      const actionBtn = event.target.closest('.delivery-action-btn');
      try {
        if (assignBtn) {
          const order = orders.find(o => String(o.id) === String(assignBtn.dataset.orderId));
          const select = list.querySelector(`.delivery-courier-select[data-order-id="${CSS.escape(assignBtn.dataset.orderId)}"]`);
          if (!order || !select?.value) return;
          assignBtn.disabled = true;
          const currentAssignment = canonicalDeliveryAssignment(order);
          if (currentAssignment) {
            await transitionDeliveryAssignmentForOrder(order, 'REASSIGNED', {
              targetCourierUserId: select.value,
              idempotencyKey: `delivery:${order.server_order_id}:reassign:${select.value}`,
            });
          } else {
            await assignDeliveryCourierForOrder(order, select.value);
          }
        } else if (actionBtn) {
          const order = orders.find(o => String(o.id) === String(actionBtn.dataset.orderId));
          if (!order) return;
          const input = list.querySelector(`.delivery-proof-input[data-order-id="${CSS.escape(actionBtn.dataset.orderId)}"]`);
          const proof = input?.value?.trim();
          if (actionBtn.dataset.action === 'DELIVERED' && !proof) { alert('Delivery proof is required.'); return; }
          actionBtn.disabled = true;
          await transitionDeliveryAssignmentForOrder(order, actionBtn.dataset.action, { proof });
        }
      } catch (error) {
        alert(error.message || 'Delivery action failed.');
      } finally {
        renderLogistics();
      }
    });
  }

  listLogisticsStaff().then(memberships => {
    const couriers = memberships.filter(m =>
      Array.isArray(m.contextualRoles) && m.contextualRoles.some(r => r.role === 'logistics_courier' && r.status === 'active')
    );
    list.querySelectorAll('.delivery-courier-select').forEach(select => {
      couriers.forEach(m => {
        const option = document.createElement('option');
        option.value = m.userId;
        option.textContent = m.displayName || m.userId;
        select.appendChild(option);
      });
    });
  }).catch(() => {});
}
