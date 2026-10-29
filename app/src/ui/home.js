// ui/home.js — seller-facing home/dashboard.
// Deliberately small: this is a navigation surface, not an analytics product.
import { config, products, orders } from '../state.js';
import { escapeHtml } from '../utils/index.js';
import { t } from './i18n.js';
import { getLowStockProducts, getOutOfStockProducts } from '../warehouse/inventory.js';

function todayOrders() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return orders.filter(o => Number(o.created_at || 0) >= start.getTime());
}

export function renderSellerHome() {
  const el = document.getElementById('sellerHome');
  if (!el) return;
  const todays = todayOrders();
  const queued = todays.filter(o => o.status !== 'synced').length;
  const lowStock = getLowStockProducts().length;
  const outOfStock = getOutOfStockProducts().length;
  const attentionCount = queued + lowStock;
  const business = escapeHtml(config.sellerName || t('setupBusiness'));

  el.innerHTML = `
    <div class="seller-home-head">
      <div>
        <div class="seller-home-kicker">SELLIFY</div>
        <h2>${business}</h2>
        <p>${products.length > 0 ? t('catalogHasItems') : t('firstSaleAddProduct')}</p>
      </div>
      <div class="seller-home-status ${navigator.onLine ? 'online' : 'offline'}">${navigator.onLine ? 'Online' : 'Offline'}</div>
    </div>

    <div class="seller-home-metrics">
      <button class="home-metric ${attentionCount ? 'attention' : ''}" onclick="switchTab('${queued ? 'queue' : 'catalog'}')">
        <span class="home-metric-label">Needs attention</span>
        <strong>${attentionCount}</strong>
      </button>
      <button class="home-metric" onclick="switchTab('queue')">
        <span class="home-metric-label">${t('totalOrders')}</span>
        <strong>${todays.length}</strong>
      </button>
      <button class="home-metric" onclick="switchTab('catalog')">
        <span class="home-metric-label">Products</span>
        <strong>${products.length}</strong>
      </button>
      <button class="home-metric ${lowStock ? 'attention' : ''}" onclick="openLowStockInventory()">
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
