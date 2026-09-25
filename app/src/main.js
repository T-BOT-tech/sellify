/*
 * Stall Ledger — offline-first order taking for sellers.
 *
 * Everything is stored in localStorage on THIS device. No network call is
 * ever required to take an order — only "Sync now" reaches out, and it
 * fails gracefully (order just stays queued) if there's no connection.
 */

// Phase 1 extraction (see modularization plan §5): leaf utilities, pure
// constant data, translation tables, and the Theme controller now live in
// their own modules. Everything else is unchanged and still lives here —
// this phase only moves code, it doesn't change behavior.
import {
  STORAGE_KEYS, LEDGER_MIGRATION_FLAG_KEY, IDB_DB_NAME, IDB_DB_VERSION,
  IDB_STORE_NAME, DEFAULT_PAYMENT_METHODS,
  defaultSyncServerUrl
} from './constants.js';
import {
  uid, escapeHtml, escapeAttr, capitalize, formatElapsed, formatElapsedShort
} from './utils/index.js';
import { Theme } from './theme/branding.js';
// Phase 9 extraction (see modularization plan §5): the raw
// `window.Telegram.WebApp` checks that used to live inline in this file's
// boot sequence below (ready()/expand(), theme ingestion, buyer-profile
// extraction, the start_param deep-link read) now live behind
// platform/telegram.js, reached through this registry so a future
// WhatsApp/SMS/native adapter can occupy the same slot later without
// another inline `if (window.X)` block here.
import { getActivePlatform, initPlatform } from './platform/index.js';
import { bootstrapTenantAuth, closeOnboarding, selectOnboardingTenant, createOnboardingTenant, pairThisDevice, showPairing, createDevicePairing, showJoinByInvite, submitStaffInvite, createStaffInvite, addOnboardingProduct, skipOnboardingProduct, finishOnboarding, submitSettingsInvite, switchActiveTenant } from './auth/tenant.js';
import { renderCustomers, openCustomerModal, closeCustomerModal, saveCustomerModal } from './customers.js';
export { renderCustomers, openCustomerModal, closeCustomerModal, saveCustomerModal };
export { bootstrapTenantAuth, closeOnboarding, selectOnboardingTenant, createOnboardingTenant, pairThisDevice, showPairing, createDevicePairing, showJoinByInvite, submitStaffInvite, createStaffInvite, addOnboardingProduct, skipOnboardingProduct, finishOnboarding, submitSettingsInvite, switchActiveTenant };

// Re-exported so window-bridge.js's `import { ... } from './main.js'` keeps
// working unchanged (Phase 1 keeps every existing onclick="..." wired the
// same way — see modularization plan §2). This narrows in a later phase
// once window-bridge.js imports straight from utils/index.js instead.
export { uid, escapeHtml, escapeAttr, capitalize, formatElapsed, formatElapsedShort };

// Phase 3 extraction (see modularization plan §5): role permissions, the
// staff PIN modal/invite-code flow, and the small config helpers (niche
// presets, business-model taxonomy, currency symbol, payment-method CRUD)
// now live in auth/*.js and config/*.js. Every name below is still used
// throughout this file exactly as before — only its home changed — and is
// re-exported at the bottom of this block so window-bridge.js's import from
// './main.js' keeps working unchanged (same pattern Phases 1–2 established).
import { hasPermission, applyRolePermissions } from './auth/permissions.js';
import {
  openPinModal, closePinModal, verifyPinAndSwitch, handleLocalStationJoinCode,
  ensureStaffPinsHashed
} from './auth/pin.js';
import { getNichePreset, getBusinessModel, isRestaurant } from './config/niche.js';
import { CS } from './config/currency.js';
import {
  renderPaymentMethodsSettings, togglePaymentMethodEnabled,
  updatePaymentMethodDetails, removePaymentMethod, addCustomPaymentMethod
} from './config/payment-methods.js';
export {
  hasPermission, applyRolePermissions,
  openPinModal, closePinModal, verifyPinAndSwitch, handleLocalStationJoinCode,
  getNichePreset, getBusinessModel, isRestaurant, CS,
  renderPaymentMethodsSettings, togglePaymentMethodEnabled,
  updatePaymentMethodDetails, removePaymentMethod, addCustomPaymentMethod
};

// Phase 2 extraction (see modularization plan §5): state.js is now the
// single source of truth (Rule 1, §1), and the IndexedDB / migration /
// hydration / storage-hardening code that used to live inline here has
// moved into storage/*.js. Every name below is still used throughout this
// file exactly as before — only its home changed — and is re-exported at
// the bottom of this block so window-bridge.js's import from './main.js'
// keeps working unchanged.
import {
  idbOpen, idbGet, idbSet, idbDelete, idbGetAll
} from './storage/idb.js';
import {
  ledgerIsMigrated, ledgerMarkMigrated, migrateOneKey, runLedgerMigration
} from './storage/migration.js';
import { loadJSON, saveJSON } from './storage/json.js';
import {
  reapplyConfigDefaults, hydrateFromIndexedDB
} from './storage/hydrate.js';
import {
  requestLedgerStoragePersistence, formatBytes, updateStorageInfoDisplay, exportLedgerData
} from './storage/persistence.js';
import {
  config, setConfig, products, setProducts, orders, setOrders,
  orderViewMode, setOrderViewModeValue, staffList, setStaffList,
  currentStaff, setCurrentStaff, currentOrder, setCurrentOrder,
  currentOrderNotes, setCurrentOrderNotes
} from './state.js';
export {
  idbOpen, idbGet, idbSet, idbDelete, idbGetAll,
  ledgerIsMigrated, ledgerMarkMigrated, migrateOneKey, runLedgerMigration,
  loadJSON, saveJSON, reapplyConfigDefaults, hydrateFromIndexedDB,
  requestLedgerStoragePersistence, formatBytes, updateStorageInfoDisplay, exportLedgerData
};

// Phase 4 extraction (see modularization plan §5): the product catalog
// (grid/list rendering, search/filter, the image-preview modal, restaurant
// item-modifiers, and the catalog-tab CRUD form) and the order lifecycle
// (cart, Telegram/local checkout, the order queue, receipts, and
// camera-captured payment proof) now live in products/*.js and orders/*.js.
// Every name below is still used throughout this file exactly as before —
// only its home changed — and is re-exported at the bottom of this block so
// window-bridge.js's import from './main.js' keeps working unchanged (same
// pattern Phases 1–3 established). setSelectedOrderTableId /
// setSelectedOrderCourse / setSelectedB2BAccountId / setSelectedFulfillmentType
// are new: orders/checkout.js's saveOrder() needs to reset that
// not-yet-extracted restaurant/B2B/logistics state from outside this file
// (see the setter definitions further down for why).
import {
  setOrderViewMode, updateViewToggleButtons, renderProducts,
  productPriceMarkup, stockBadgeMarkup, patchProductCard
} from './products/render.js';
import {
  searchQuery, activeCategory, onSearchInput, clearSearch, setCategory, renderCategoryPills
} from './products/search-filter.js';
import {
  openProductImageModal, openImageModal, closeImageModal, handleImageModalBackdrop,
  handleNewProdImageSelect, handleEditProdImageSelect
} from './products/images.js';
import {
  modifierNoteMarkup, openModifierNoteModal, closeModifierNoteModal, saveModifierNote
} from './products/modifiers.js';
import {
  renderCatalog, startProductEdit, cancelProductEdit, saveProductEdit,
  renderProductFormSelects, toggleNewProdTag, onNewProdCategoryChange,
  addProduct, removeProduct
} from './products/catalog.js';
import {
  setCashTendered, updateCartStickyBar, scrollToOrderSummary, onCashInput,
  updateChangeDisplay, changeQty, updateOrderSummary
} from './orders/cart.js';
import {
  checkoutTelegramWebApp, recordTelegramSentOrder, saveOrder
} from './orders/checkout.js';
import {
  renderDailySummary, renderQueue, ticketInnerHtml, createTicketNode, updateTicketNode,
  removeTicketNode, getOrderById, deleteOrder, undoDeleteOrder, finalizeOrderDelete, advanceMarketplaceOrderStatus, cancelMarketplaceOrder
} from './orders/queue.js';
import {
  formatReceiptText, copyReceipt, fallbackCopy, shareReceipt, printReceipt,
  drawCanvasReceipt, generateAndShareImageReceipt, downloadImageFile
} from './orders/receipts.js';
import {
  viewPaymentProof, onOrderPayMethodChange, openPaymentProofModal,
  closePaymentProofModal, confirmOrderWithProof, compressImage
} from './orders/payment-proof.js';
export {
  setOrderViewMode, updateViewToggleButtons, renderProducts,
  productPriceMarkup, stockBadgeMarkup, patchProductCard,
  onSearchInput, clearSearch, setCategory, renderCategoryPills,
  openProductImageModal, openImageModal, closeImageModal, handleImageModalBackdrop,
  handleNewProdImageSelect, handleEditProdImageSelect,
  openModifierNoteModal, closeModifierNoteModal, saveModifierNote, modifierNoteMarkup,
  renderCatalog, startProductEdit, cancelProductEdit, saveProductEdit,
  renderProductFormSelects, toggleNewProdTag, onNewProdCategoryChange,
  addProduct, removeProduct,
  setCashTendered, updateCartStickyBar, scrollToOrderSummary, onCashInput,
  updateChangeDisplay, changeQty, updateOrderSummary,
  checkoutTelegramWebApp, recordTelegramSentOrder, saveOrder,
  renderDailySummary, renderQueue, ticketInnerHtml, createTicketNode, updateTicketNode,
  removeTicketNode, getOrderById, deleteOrder, undoDeleteOrder, finalizeOrderDelete, advanceMarketplaceOrderStatus, cancelMarketplaceOrder,
  formatReceiptText, copyReceipt, fallbackCopy, shareReceipt, printReceipt,
  drawCanvasReceipt, generateAndShareImageReceipt, downloadImageFile,
  viewPaymentProof, onOrderPayMethodChange, openPaymentProofModal,
  closePaymentProofModal, confirmOrderWithProof, compressImage
};

// Phase 5 extraction (see modularization plan §5): the manual "Sync now"
// trigger, the queued-order push, the catalog push/pull, and the
// trust-boundary sanitizers for anything arriving from a synced
// catalog/marketplace feed now live in sync/*.js. Every name below is still
// used throughout this file exactly as before — only its home changed —
// and is re-exported at the bottom of this block so window-bridge.js's
// import from './main.js' keeps working unchanged (same pattern Phases
// 1–4 established). sanitizeRemoteListings is still used below by
// fetchMarketplaceListings, which hasn't moved to marketplace/*.js yet
// (that's Phase 6).
import { syncNow } from './sync/index.js';
import { syncOrders } from './sync/orders.js';
import {
  syncCatalog, fetchRemoteCatalogAndBranding,
  sanitizeId, sanitizeRemoteProducts, sanitizeRemoteListings
} from './sync/catalog.js';
export {
  syncNow, syncOrders, syncCatalog, fetchRemoteCatalogAndBranding,
  sanitizeId, sanitizeRemoteProducts, sanitizeRemoteListings
};

// Phase 6 extraction (see modularization plan §5): the vertical feature
// modules — warehouse, wholesale/B2B, logistics, restaurant (tables +
// kitchen), and marketplace — now live in warehouse/*.js, b2b/*.js,
// logistics/*.js, restaurant/*.js, and marketplace/*.js. Every name below
// is still used throughout this file exactly as before — only its home
// changed — and is re-exported at the bottom of this block so
// window-bridge.js's import from './main.js' keeps working unchanged (same
// pattern Phases 1–5 established).
import {
  isWholesaleEnabled, getB2BAccountById, saveB2BAccounts,
  selectedB2BAccountId, setSelectedB2BAccountId
} from './b2b/accounts.js';
import {
  isVolumeDiscountEnabled, getPricingTierById, savePricingTiers,
  saveVolumeDiscountTiers, getVolumeDiscountForQty, effectiveUnitPrice
} from './b2b/pricing.js';
import {
  applyWholesaleUI, renderOrderAccountSelect, onOrderAccountChange,
  renderAccountTierOptions, renderAccounts, openAccountModal, closeAccountModal,
  saveAccountModal, removeAccount, renderPricingTiersSettings, addPricingTier,
  removePricingTier, onWholesaleToggle, renderVolumeDiscountSettings,
  addVolumeDiscountTier, removeVolumeDiscountTier, onVolumeDiscountToggle
} from './b2b/ui.js';
import {
  isWarehouseEnabled, isStockTracked, getLowStockProducts, getOutOfStockProducts,
  saveStockTransactions, applyStockChange
} from './warehouse/inventory.js';
import { saveWarehouseLocations, addWarehouseLocation, removeWarehouseLocation, loadOrganizationLocations, selectOrganizationLocation, openOrganizationLocationModal, closeOrganizationLocationModal, saveOrganizationLocationModal } from './warehouse/locations.js';
import {
  applyWarehouseUI, switchWarehouseSubtab, warehouseActiveSubtab, renderWarehouseInventory,
  renderWarehouseReceiving, renderWarehouseTransactions, txItemMarkup, renderWarehouseLocationsList,
  warehouseProductOptions, selectWarehouseLocation, openStockAdjustModal, onStockAdjustProductChange, closeStockAdjustModal,
  saveStockAdjustModal, openReceiveModal, closeReceiveModal, saveReceiveModal, onWarehouseToggle
} from './warehouse/ui.js';
import {
  isLogisticsEnabled, nextFulfillmentStatus, isFulfillmentFinal, fulfillmentStatusLabel,
  advanceFulfillmentOrder, selectedFulfillmentType, setSelectedFulfillmentType, deliveryAssignments,
  canonicalDeliveryAssignment, refreshDeliveryAssignments, transitionDeliveryAssignmentForOrder
} from './logistics/fulfillment.js';
import {
  applyLogisticsUI, renderOrderFulfillmentPicker, setFulfillmentType, renderLogistics
} from './logistics/ui.js';
import {
  restaurantTables, selectedOrderTableId, setSelectedOrderTableId,
  selectedOrderCourse, setSelectedOrderCourse, saveTables, addTable, openTableModal,
  closeTableModal, saveTableModal, editTable, cycleTableStatus, removeTable, renderTables,
  transferTable, closeTableTransferModal, confirmTransfer, renderOrderTableSelect,
  renderOrderCourseSelect, onOrderCourseChange
} from './restaurant/tables.js';
import {
  updateKitchenBadge, setKitchenSort, renderKitchen, kitchenBodyHtml, kitchenNodeClassName,
  createKitchenNode, updateKitchenNode, removeKitchenNode, updateKitchenTimer, setKitchenStatus,
  optimisticMarkServed, undoMarkServed, finalizeServed, setKitchenPriority,
  startKitchenTimer, stopKitchenTimer
} from './restaurant/kitchen.js';
import {
  fetchMarketplaceListings, onMarketSearchInput, clearMarketSearch, setMarketCategory, renderMarketplace
} from './marketplace/listings.js';
import { updateMarketCartQty, updateMultiCartBar } from './marketplace/cart.js';
import {
  openMarketCheckoutModal, closeMarketCheckoutModal, submitMarketplaceOrder
} from './marketplace/checkout.js';
export {
  isWholesaleEnabled, getB2BAccountById, saveB2BAccounts, selectedB2BAccountId, setSelectedB2BAccountId,
  isVolumeDiscountEnabled, getPricingTierById, savePricingTiers, saveVolumeDiscountTiers,
  getVolumeDiscountForQty, effectiveUnitPrice,
  applyWholesaleUI, renderOrderAccountSelect, onOrderAccountChange, renderAccountTierOptions,
  renderAccounts, openAccountModal, closeAccountModal, saveAccountModal, removeAccount,
  renderPricingTiersSettings, addPricingTier, removePricingTier, onWholesaleToggle,
  renderVolumeDiscountSettings, addVolumeDiscountTier, removeVolumeDiscountTier, onVolumeDiscountToggle,
  isWarehouseEnabled, isStockTracked, getLowStockProducts, getOutOfStockProducts,
  saveStockTransactions, applyStockChange, saveWarehouseLocations, addWarehouseLocation,
  removeWarehouseLocation, loadOrganizationLocations, selectOrganizationLocation, openOrganizationLocationModal, closeOrganizationLocationModal, saveOrganizationLocationModal, applyWarehouseUI, switchWarehouseSubtab, renderWarehouseInventory,
  renderWarehouseReceiving, renderWarehouseTransactions, txItemMarkup, renderWarehouseLocationsList,
  warehouseProductOptions, selectWarehouseLocation, openStockAdjustModal, onStockAdjustProductChange, closeStockAdjustModal,
  saveStockAdjustModal, openReceiveModal, closeReceiveModal, saveReceiveModal, onWarehouseToggle,
  isLogisticsEnabled, nextFulfillmentStatus, isFulfillmentFinal, fulfillmentStatusLabel,
  advanceFulfillmentOrder, selectedFulfillmentType, setSelectedFulfillmentType,
  applyLogisticsUI, renderOrderFulfillmentPicker, setFulfillmentType, renderLogistics,
  restaurantTables, selectedOrderTableId, setSelectedOrderTableId, selectedOrderCourse,
  setSelectedOrderCourse, saveTables, addTable, openTableModal, closeTableModal, saveTableModal,
  editTable, cycleTableStatus, removeTable, renderTables, transferTable, closeTableTransferModal,
  confirmTransfer, renderOrderTableSelect, renderOrderCourseSelect, onOrderCourseChange,
  updateKitchenBadge, setKitchenSort, renderKitchen, kitchenBodyHtml, kitchenNodeClassName,
  createKitchenNode, updateKitchenNode, removeKitchenNode, updateKitchenTimer, setKitchenStatus,
  optimisticMarkServed, undoMarkServed, finalizeServed, setKitchenPriority, startKitchenTimer,
  stopKitchenTimer, fetchMarketplaceListings, onMarketSearchInput, clearMarketSearch,
  setMarketCategory, renderMarketplace, updateMarketCartQty, updateMultiCartBar,
  openMarketCheckoutModal, closeMarketCheckoutModal, submitMarketplaceOrder
};

// Phase 7 extraction (see modularization plan §5): the last of main.js's
// inline logic — i18n helpers, the generic list-patcher + renderAll() fan-out,
// the remote-branding engine, tab switching + the More sheet, the Settings
// modal, and toast/undo-toast — now live in ui/*.js. What's left below this
// block is genuinely just the bootstrap: Telegram WebApp lifecycle, URL
// param parsing, first-run prompt, and kicking off hydration/persistence/sync
// at startup. Every name is still used throughout the app exactly as
// before — only its home changed — and is re-exported here so
// window-bridge.js's import from './main.js' keeps working unchanged (same
// pattern Phases 1–6 established). ui/modals.js and the nav-overflow
// observer inside ui/tabs.js are imported solely for their document-level
// side effects (they export nothing) — see the comments in those files.
//
// Phase 8 (see modularization plan §5): every feature module that used to
// import showToast/t/renderAll/switchTab/etc. from '../main.js' — because
// this file re-exported them from their real Phase 1–7 homes — now imports
// them directly from that real home instead (ui/i18n.js, ui/toast.js,
// ui/render.js, ui/tabs.js, ui/branding.js, ui/settings.js, b2b/*.js,
// restaurant/tables.js, logistics/fulfillment.js, warehouse/inventory.js,
// products/render.js). This file's imports below are now one-directional:
// main.js imports FROM feature modules to re-export for window-bridge.js,
// but no feature module imports main.js back. window-bridge.js is the only
// remaining importer of './main.js'.
import { getLang, t, changeLanguage, updateI18n } from './ui/i18n.js';
import { showToast, showUndoToast, handleToastUndo } from './ui/toast.js';
import { patchList, renderAll, renderBrand, renderStatus } from './ui/render.js';
import { renderSellerHome } from './ui/home.js';
import { applyStoreBranding } from './ui/branding.js';
import { switchTab, openMoreSheet, closeMoreSheet } from './ui/tabs.js';
import {
  renderNicheSelect, onNicheChange, updateNicheFieldVisibility, onBusinessModelChange,
  applyBusinessModelUI, openSettings, onCurrencyCodeChange, saveSettings,
  renderDeviceList, revokeDeviceInList, renderStorefrontBranding, updateBrandingPreview, saveStorefrontBranding
} from './ui/settings.js';
import './ui/modals.js';
export {
  getLang, t, changeLanguage, updateI18n,
  showToast, showUndoToast, handleToastUndo,
  patchList, renderAll, renderBrand, renderStatus, renderSellerHome,
  applyStoreBranding,
  switchTab, openMoreSheet, closeMoreSheet,
  renderNicheSelect, onNicheChange, updateNicheFieldVisibility, onBusinessModelChange,
  applyBusinessModelUI, openSettings, onCurrencyCodeChange, saveSettings,
  renderDeviceList, revokeDeviceInList, renderStorefrontBranding, updateBrandingPreview, saveStorefrontBranding
};

// ---------- IndexedDB / migration / hydration / storage-hardening ----------
// Phase 2 extraction (see modularization plan §5): all of this now lives in
// storage/idb.js, storage/migration.js, storage/hydrate.js, and
// storage/persistence.js — imported at the top of this file and re-exported
// below so window-bridge.js's `import { ... } from './main.js'` keeps
// working unchanged (same pattern Phase 1 established for i18n/utils/theme).

// (Business-type niche presets and business-model taxonomy now come from
// config/niche.js — NICHE_PRESETS, getNichePreset, BUSINESS_MODELS,
// getBusinessModel, isRestaurant.)
// (RESTAURANT_COURSES now comes from constants.js.)
// (staffList / currentStaff now come from state.js.)
// (Staff PIN modal + invite-code handling now come from auth/pin.js —
// openPinModal, closePinModal, verifyPinAndSwitch, handleLocalStationJoinCode.)
// (Role permissions now come from auth/permissions.js — hasPermission,
// applyRolePermissions.)

// (loadJSON / saveJSON now come from storage/json.js.)
// (defaultSyncServerUrl now comes from constants.js.)

// ---------- Currency ----------
// (CURRENCY_SYMBOLS now comes from constants.js. CS() now comes from
// config/currency.js.)

// ---------- Payment methods ----------
// (DEFAULT_PAYMENT_METHODS now comes from constants.js. The settings-tab
// CRUD over config.paymentMethods now comes from config/payment-methods.js —
// renderPaymentMethodsSettings, togglePaymentMethodEnabled,
// updatePaymentMethodDetails, removePaymentMethod, addCustomPaymentMethod.)

// (config / products / orders / orderViewMode now come from state.js.)

// (Wholesale/B2B accounts + pricing tiers, warehouse inventory + UI, and
// logistics/fulfillment now come from b2b/*.js, warehouse/*.js, and
// logistics/*.js — see the Phase 6 import block near the top of this file.)

// (currentOrder / currentOrderNotes now come from state.js.)


// (The Escape-key handler and the generic modal-sheet focus trap now come
// from ui/modals.js, imported for its side effect near the top of this
// file.)

// (i18n helpers — getLang, t, changeLanguage, updateI18n — now come from
// ui/i18n.js.)

// (patchList and the renderAll()/renderBrand()/renderStatus() fan-out now
// come from ui/render.js.)

// (Product rendering, the item-modifiers UI, cart/checkout/queue/receipts,
// and payment-proof capture now live in products/*.js and orders/*.js —
// see the Phase 4 import block near the top of this file.)

// (syncNow, syncOrders, syncCatalog, fetchRemoteCatalogAndBranding, and the
// sanitizeId/sanitizeRemoteProducts/sanitizeRemoteListings trust-boundary
// helpers now live in sync/*.js — see the Phase 5 import block near the top
// of this file.)

// (The "Dynamic Store Theme & Branding Engine" — applyStoreBranding — now
// comes from ui/branding.js. escapeAttr() comes from utils/index.js.)

// (Tab switching and the More overflow sheet — switchTab, openMoreSheet,
// closeMoreSheet, and the nav-visibility/badge observer that drives it —
// now come from ui/tabs.js. capitalize() comes from utils/index.js.)

// (The "Global Hybrid Marketplace Client Engine" — listings, cart, and
// checkout — now comes from marketplace/*.js — see the Phase 6 import
// block near the top of this file.)

// (Niche selection, business-model switching, and the Settings modal —
// renderNicheSelect, onNicheChange, updateNicheFieldVisibility,
// onBusinessModelChange, applyBusinessModelUI, openSettings,
// onCurrencyCodeChange, saveSettings — now come from ui/settings.js.)

// (Wholesale/B2B accounts UI, pricing-tier settings, and volume-discount
// settings now come from b2b/ui.js — see the Phase 6 import block near the
// top of this file.)

// (Restaurant mode — table CRUD/transfer and the Kitchen ticket board —
// now comes from restaurant/tables.js and restaurant/kitchen.js — see the
// Phase 6 import block near the top of this file.)

// (renderPaymentMethodsSettings, togglePaymentMethodEnabled,
// updatePaymentMethodDetails, removePaymentMethod, addCustomPaymentMethod
// now come from config/payment-methods.js — imported/re-exported above.)

// (showToast, showUndoToast, handleToastUndo now come from ui/toast.js.
// escapeHtml() comes from utils/index.js.)

// (Theme controller now comes from theme/branding.js.)

// Apply immediately so there is no flash of the wrong theme.
Theme.apply();

// ---------- Init ----------
window.addEventListener('online', renderStatus);
window.addEventListener('offline', renderStatus);

// Platform bootstrap (see modularization plan §5, Phase 9): resolves the
// active platform adapter (Telegram today; web.js as the fallback for
// everyone else) and runs its one-time init() hook — ready()/expand(),
// theme ingestion, and buyer-profile extraction for Telegram; a no-op for
// every other adapter until one of them gets a real implementation.
initPlatform();

// Auto-detect seller parameter and deep-links from URL (?seller=SC9821, ?startapp=BUY_..., or ?chat_id=SC9821)
try {
  const urlParams = new URLSearchParams(window.location.search);
  const twaStartParam = getActivePlatform().getStartParam();
  const startAppParam = urlParams.get('startapp') || urlParams.get('start_param') || twaStartParam;
  const sellerParam = urlParams.get('seller') || urlParams.get('chat_id');

  if (startAppParam) {
    if (startAppParam.toUpperCase().startsWith('BUY_')) {
      const parts = startAppParam.split('_');
      if (parts.length >= 2) {
        config.chatId = parts[1];
        if (!config.syncUrl) config.syncUrl = window.location.origin;
        saveJSON(STORAGE_KEYS.config, config);
      }
      if (parts.length >= 3) {
        const itemKey = parts.slice(2).join('_').toLowerCase();
        setTimeout(() => {
          const prod = products.find(p => p.id.toLowerCase() === itemKey || p.name.toLowerCase().replace(/ /g, '_') === itemKey || p.name.toLowerCase().includes(itemKey));
          if (prod) {
            currentOrder[prod.id] = (currentOrder[prod.id] || 0) + 1;
            renderAll();
            showToast(`Added ${prod.name} to cart 🛒`);
          }
        }, 500);
      }
    } else if (startAppParam.startsWith('JOIN_')) {
      handleLocalStationJoinCode(startAppParam);
    } else if (startAppParam.toUpperCase() === 'MARKETPLACE' || startAppParam.toUpperCase() === 'MARKET') {
      setTimeout(() => switchTab('marketplace'), 150);
    } else if (startAppParam) {
      config.chatId = startAppParam.trim();
      if (!config.syncUrl) config.syncUrl = window.location.origin;
      saveJSON(STORAGE_KEYS.config, config);
    }
  } else if (urlParams.get('tab') === 'marketplace' || urlParams.get('tab') === 'market') {
    setTimeout(() => switchTab('marketplace'), 150);
  } else if (sellerParam) {
    config.chatId = sellerParam.trim();
    if (!config.syncUrl) {
      config.syncUrl = window.location.origin;
    }
    saveJSON(STORAGE_KEYS.config, config);
  }
} catch (e) {
  console.error('Error parsing URL parameters:', e);
}

let tenantAuthPromise = Promise.resolve({ authenticated: !!config.sessionToken });
// Capability check, not a platform name — asks the active adapter whether
// it can authenticate silently on load (see platform/telegram.js's
// authMode note) instead of hardcoding `id === 'telegram'`. bootstrapTenantAuth()
// itself still only knows how to do Telegram's specific silent-auth exchange
// (POST /auth/telegram via getInitData()) — a second 'silent' adapter would
// need its own exchange, branched inside bootstrapTenantAuth or moved onto
// the adapter itself, but this fork already won't need to change to pick it up.
if (getActivePlatform().authMode === 'silent') {
  tenantAuthPromise = bootstrapTenantAuth().then(result => {
    if (!result.authenticated && result.onboarding) return result;
    if (!result.authenticated && !config.sellerName && !config.chatId) {
      setTimeout(openSettings, 300);
    }
    return result;
  });
} else if (!config.sessionToken) {
  setTimeout(showPairing, 300);
}

renderAll();

// Phase 3: kick off migration + IndexedDB hydration in the background. This is
// deliberately NOT awaited before the renderAll() above — right now IndexedDB
// can only hold a copy of what localStorage already gave us synchronously (see
// the comment on hydrateFromIndexedDB), so there is nothing to visibly wait
// for yet, and blocking first paint on it would cost real time on slow devices
// for zero benefit until Phase 4 lands. Once Phase 4 makes IndexedDB the sole
// write target, this becomes the step that actually matters, and a loading
// state may be worth adding then instead of here.
hydrateFromIndexedDB().then(changed => {
  if (changed) renderAll();
  // Phase 3 fix (see modularization plan §5, Phase 3): runs after
  // hydration resolves, not before, so it operates on whichever copy of
  // staffList actually won (IndexedDB vs. the localStorage-loaded default)
  // instead of possibly generating PINs for a station that's about to be
  // overwritten a moment later.
  return ensureStaffPinsHashed();
}).catch(e => {
  console.error('Unexpected hydration/PIN-hash error', e);
});

// Phase 5: request persistent storage once at boot (best-effort, non-blocking —
// see requestLedgerStoragePersistence() for why this can't be awaited-and-relied-on
// across all browsers). Settings reads ledgerStoragePersisted whenever it's opened.
requestLedgerStoragePersistence();

tenantAuthPromise.then(result => {
  if (result?.authenticated && config.chatId && config.syncUrl) return fetchRemoteCatalogAndBranding();
  return null;
}).catch(() => null);

if ('serviceWorker' in navigator) {
  let sellifyServiceWorkerRegistration = null;
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SELLIFY_UPDATE_READY') {
      const shouldRefresh = window.confirm('A new Sellify update is ready. Reload now?');
      const waitingWorker = sellifyServiceWorkerRegistration && sellifyServiceWorkerRegistration.waiting;
      if (shouldRefresh && waitingWorker) {
        navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
        waitingWorker.postMessage({ type: 'SELLIFY_SKIP_WAITING' });
      }
    }
  });
  navigator.serviceWorker.register('service-worker.js').then((registration) => {
    sellifyServiceWorkerRegistration = registration;
    registration.update().catch(() => {});
  }).catch(() => {});
}
