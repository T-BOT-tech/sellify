// ui/home.js — seller-facing home/dashboard.
// Deliberately small: this is a navigation surface, not an analytics product.
import { config, products, orders } from '../state.js';
import { CS } from '../config/currency.js';
import { formatMoney } from '../utils/money.js';
import { escapeHtml } from '../utils/index.js';
import { t } from './i18n.js';
import { getBusinessReadiness } from '../experience/business-readiness.js';

function todayOrders() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return orders.filter(o => Number(o.created_at || 0) >= start.getTime());
}

function renderBusinessReadiness(readiness) {
  const actionLabels = {
    settings: 'Complete business profile',
    catalog: 'Add your first item',
    order: 'Take your first order',
  };
  const title = readiness.readyToTakeOrders
    ? 'You’re ready to take orders'
    : readiness.status === 'in_progress'
      ? 'Finish setting up your business'
      : 'Let’s get your business ready';
  const detail = readiness.readyToTakeOrders
    ? 'Your business profile and catalog are set up. You can start taking orders.'
    : 'Complete these basics to get from setup to your first sale.';
  const steps = readiness.steps.map(step => `
    <li class="business-readiness-step ${step.complete ? 'complete' : 'pending'}">
      <span aria-hidden="true">${step.complete ? '✓' : '○'}</span>
      <span><strong>${escapeHtml(step.label)}</strong><small>${escapeHtml(step.detail)}</small></span>
    </li>`).join('');
  const action = readiness.nextAction === 'settings'
    ? 'openSettings()'
    : `switchTab('${readiness.nextAction}')`;
  return `
    <section class="seller-home-note business-readiness" aria-label="Business readiness">
      <div>
        <strong>${title}</strong>
        <span>${detail}</span>
      </div>
      <p class="business-readiness-progress">${readiness.completedSteps} of ${readiness.totalSteps} setup steps complete</p>
      <ul class="business-readiness-steps">${steps}</ul>
      <button class="home-action primary" onclick="${action}">
        <span class="home-action-icon">${readiness.readyToTakeOrders ? '＋' : '→'}</span>
        <span><strong>${actionLabels[readiness.nextAction]}</strong><small>${readiness.readyToTakeOrders ? 'Your next step is to make a sale.' : 'Continue where it matters most.'}</small></span>
      </button>
    </section>`;
}

export function renderSellerHome() {
  const el = document.getElementById('sellerHome');
  if (!el) return;
  const todays = todayOrders();
  const sales = todays.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const queued = todays.filter(o => o.status !== 'synced').length;
  const lowStock = products.filter(p => {
    const n = Number(p.stock);
    return Number.isFinite(n) && n >= 0 && n <= 5;
  }).length;
  const outOfStock = products.filter(p => Number(p.stock) === 0).length;
  const business = escapeHtml(config.sellerName || t('setupBusiness'));
  const readiness = getBusinessReadiness({ config, catalogItems: products });

  el.innerHTML = `
    <div class="seller-home-head">
      <div>
        <div class="seller-home-kicker">SELLIFY</div>
        <h2>${business}</h2>
        <p>${navigator.onLine ? (readiness.readyToTakeOrders ? 'Ready to take orders' : 'Business setup in progress') : 'Working offline'}</p>
      </div>
      <div class="seller-home-status ${navigator.onLine ? 'online' : 'offline'}">${navigator.onLine ? 'Online' : 'Offline'}</div>
    </div>

    ${renderBusinessReadiness(readiness)}

    <div class="seller-home-metrics">
      <button class="home-metric" onclick="switchTab('queue')">
        <span class="home-metric-label">${t('todaySales')}</span>
        <strong>${CS()}${formatMoney(sales, config.currencyCode)}</strong>
      </button>
      <button class="home-metric" onclick="switchTab('queue')">
        <span class="home-metric-label">${t('totalOrders')}</span>
        <strong>${todays.length}</strong>
      </button>
      <button class="home-metric" onclick="switchTab('catalog')">
        <span class="home-metric-label">Products</span>
        <strong>${products.length}</strong>
      </button>
      <button class="home-metric ${lowStock ? 'attention' : ''}" onclick="switchTab('catalog')">
        <span class="home-metric-label">Low stock</span>
        <strong>${lowStock}</strong>
      </button>
    </div>

    <div class="seller-home-actions">
      <button class="home-action primary" onclick="switchTab('order')">
        <span class="home-action-icon">＋</span><span><strong>Take an order</strong><small>Start selling now</small></span>
      </button>
      <button class="home-action" onclick="switchTab('catalog')">
        <span class="home-action-icon">□</span><span><strong>Manage catalog</strong><small>${products.length} products · ${outOfStock} out of stock</small></span>
      </button>
      <button class="home-action" onclick="switchTab('queue')">
        <span class="home-action-icon">↥</span><span><strong>Orders & sync</strong><small>${queued ? `${queued} waiting to sync` : 'Everything is synced'}</small></span>
      </button>
    </div>

    <div class="seller-home-note">
      <strong>Built for your next sale.</strong>
      <span>Catalog, orders and stock stay available offline and sync when you're back online.</span>
    </div>`;
}
