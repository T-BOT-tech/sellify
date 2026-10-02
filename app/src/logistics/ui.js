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
import { config, currentStaff, orders, warehouseLocations } from '../state.js';
import {
  deliveryAssignments, isLogisticsEnabled, selectedFulfillmentType, setSelectedFulfillmentType,
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
import { buildLogisticsOperationalWorkspaceProjection } from '../verticals/logistics/workspace-projection.js';
import { getLogisticsWorkspaceComposition } from '../verticals/logistics/workspace-contract.js';

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

function renderDeliveryWorkloadSummary(assignments) {
  const active = (Array.isArray(assignments) ? assignments : []).filter(a =>
    !['CANCELLED', 'FAILED', 'REASSIGNED'].includes(String(a.status || '').toUpperCase())
  );
  const counts = active.reduce((acc, a) => {
    const key = String(a.status || 'ASSIGNED').toUpperCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const byCourier = active.reduce((acc, a) => {
    const key = String(a.courier_name || a.courier_user_id || 'Unassigned');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const statusSummary = ['ASSIGNED', 'ACCEPTED', 'OUT_FOR_DELIVERY']
    .filter(status => counts[status])
    .map(status => `${status.replaceAll('_', ' ')}: ${counts[status]}`)
    .join(' · ');
  const courierSummary = Object.entries(byCourier)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => `${escapeHtml(name)}: ${count}`)
    .join(' · ');
  if (!active.length) return '';
  return `
    <div class="logistics-meta" style="margin-bottom:10px;padding:8px 10px;">
      <strong>Delivery workload</strong>
      ${statusSummary ? `<span style="margin-left:8px;">${escapeHtml(statusSummary)}</span>` : ''}
      ${courierSummary ? `<div style="margin-top:4px;">By courier: ${courierSummary}</div>` : ''}
    </div>`;
}

let logisticsDispatchFilters = { status: '', courierUserId: '' };

function currentStaffRole() {
  return config.currentStaffRole || config.authRole || 'staff';
}

function renderOperationalWorkspaceSummary(workspace, views) {
  const sections = [];
  if (views.includes('dispatch')) sections.push(`<span>Dispatch: ${workspace.dispatch.length}</span>`);
  if (views.includes('tracking')) sections.push(`<span>Tracking: ${workspace.tracking.length}</span>`);
  if (views.includes('proof')) sections.push(`<span>Proof: ${workspace.proof.length}</span>`);
  if (views.includes('exceptions')) sections.push(`<span>Exceptions: ${workspace.exceptions.length}</span>`);
  if (views.includes('workload')) {
    sections.push(`<span>Active workload: ${workspace.workload.active_count}</span>`);
  }
  if (!sections.length) return '';
  return `
    <div class="logistics-meta" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;"
         data-logistics-workspace-projection="1">
      <strong>Logistics workspace</strong>
      ${sections.join(' · ')}
    </div>`;
}

export function renderLogistics() {
  const list = document.getElementById('logisticsList');
  if (!list) return;
  const canonicalAssignments = Array.isArray(deliveryAssignments) ? deliveryAssignments : [];
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

  const filterBar = `
    <div class="logistics-meta" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
      <select id="logistics-status-filter">
        <option value="">All active statuses</option>
        <option value="ASSIGNED">Assigned</option>
        <option value="ACCEPTED">Accepted</option>
        <option value="OUT_FOR_DELIVERY">Out for delivery</option>
      </select>
      <select id="logistics-courier-filter"><option value="">All couriers</option></select>
      <button type="button" class="btn-secondary" id="logistics-filter-apply">Filter</button>
      <button type="button" class="btn-secondary" id="logistics-filter-clear">Clear</button>
    </div>`;
  const workspaceRole = String(currentStaff?.role || currentStaffRole()).toLowerCase();
  const workspace = buildLogisticsOperationalWorkspaceProjection({
    orders,
    assignments: canonicalAssignments,
  });
  const composition = getLogisticsWorkspaceComposition(workspaceRole);
  let html = filterBar + renderDeliveryWorkloadSummary(canonicalAssignments);
  if (composition.views.some(view => view.id === 'tracking')) {
    html += renderOperationalWorkspaceSummary(workspace, composition.views.map(view => view.id));
  }
  if (pending.length > 0) {
    html += `<div class="settings-section-label">${t('whPendingFulfillment')}</div>` + pending.map(renderCard).join('');
  }
  if (done.length > 0) {
    html += `<div class="settings-section-label">${t('whCompletedFulfillment')}</div>` + done.map(renderCard).join('');
  }
  list.innerHTML = html;

  const statusFilter = list.querySelector('#logistics-status-filter');
  const courierFilter = list.querySelector('#logistics-courier-filter');
  if (statusFilter) statusFilter.value = logisticsDispatchFilters.status;
  if (courierFilter) courierFilter.value = logisticsDispatchFilters.courierUserId;
  if (list.dataset.dispatchFiltersBound !== '1') {
    list.dataset.dispatchFiltersBound = '1';
    list.addEventListener('click', async (event) => {
      if (event.target.closest('#logistics-filter-apply')) {
        logisticsDispatchFilters = {
          status: list.querySelector('#logistics-status-filter')?.value || '',
          courierUserId: list.querySelector('#logistics-courier-filter')?.value || '',
        };
        await refreshDeliveryAssignments(logisticsDispatchFilters);
        return;
      }
      if (event.target.closest('#logistics-filter-clear')) {
        logisticsDispatchFilters = { status: '', courierUserId: '' };
        await refreshDeliveryAssignments(logisticsDispatchFilters);
      }
    });
  }

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
    const allCourierOptions = memberships.filter(m =>
      Array.isArray(m.contextualRoles) && m.contextualRoles.some(r => r.role === 'logistics_courier')
    );
    const courierFilterEl = list.querySelector('#logistics-courier-filter');
    if (courierFilterEl) {
      const current = courierFilterEl.value;
      courierFilterEl.innerHTML = '<option value="">All couriers</option>' + allCourierOptions.map(m =>
        `<option value="${escapeAttr(m.userId)}">${escapeHtml(m.displayName || m.userId)}</option>`
      ).join('');
      courierFilterEl.value = current;
    }
    const couriers = memberships.filter(m =>
      Array.isArray(m.contextualRoles) && m.contextualRoles.some(r => {
        if (r.role !== 'logistics_courier') return false;
        if (String(r.scopeType || '').toUpperCase() !== 'LOCATION') return true;
        return !r.scopeId || !config.locationId || String(r.scopeId) === String(config.locationId);
      })
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
