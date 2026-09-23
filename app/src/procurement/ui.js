// R1 productization slice — Supplier Network + Procurement.
// UI only: all authority, persistence, authorization and lifecycle execution
// remain in the existing backend supplier/procurement domains.
import { config, currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';
import { escapeHtml } from '../utils/index.js';

let lastSourcingCandidates = [];
let lastSourcingOpportunities = [];
let lastActiveSupplierRelationships = [];

function baseUrl() { return (config.syncUrl || window.location.origin).replace(/\/$/, ''); }
function headers() { return { 'Content-Type': 'application/json', ...(config.sessionToken ? { Authorization: `Bearer ${config.sessionToken}` } : {}) }; }
async function request(path, options = {}) {
  const res = await fetch(`${baseUrl()}${path}`, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `Request failed (${res.status})`);
  return body;
}
function role() { return currentStaff?.role || 'owner'; }
function can(permission) { return hasPermission(role(), permission); }
function esc(value) { return escapeHtml(value == null ? '' : String(value)); }

function renderSupplyIntelligence(rows) {
  const summary = document.getElementById('sourcingIntelligenceSummary');
  if (!summary) return;
  const candidates = Array.isArray(rows) ? rows : [];
  const capacitySignals = candidates.reduce((n, r) => n + Number(r.availability?.capacitySignalCount || 0), 0);
  const commercialSignals = candidates.reduce((n, r) => n + Number(r.commercialSignals?.commercialTermCount || 0), 0);
  const qualificationEvidence = candidates.reduce((n, r) => n + (Array.isArray(r.qualificationEvidence) ? r.qualificationEvidence.length : 0), 0);
  const trustEvidence = candidates.reduce((n, r) => n + (Array.isArray(r.trustEvidence) ? r.trustEvidence.length : 0), 0);
  const scores = candidates.map(r => Number(r.matchFactors?.score || 0)).filter(Number.isFinite);
  const highest = scores.length ? Math.max(...scores) : 0;
  summary.style.display = 'block';
  summary.innerHTML = `<strong>Derived supply intelligence</strong> · ${candidates.length} supplier candidate(s) · ${capacitySignals} capacity signal(s) · ${commercialSignals} commercial signal(s) · ${qualificationEvidence} qualification evidence item(s) · ${trustEvidence} trust evidence item(s) · highest deterministic discovery score ${esc(highest)}<br><span class="muted">Derived from existing Discovery/Supplier Network evidence; this is not a new ranking, trust, inventory, or procurement authority.</span>`;
}

export async function renderSourcing() {
  const root = document.getElementById('sourcingWorkspace');
  if (!root || !config.chatId || !config.sessionToken) return;
  if (!can('procurement:demand:view') && !can('supplier-network:discovery:discover')) {
    root.innerHTML = '<div class="empty">Sourcing access is not available for this role.</div>';
    return;
  }
  const discovery = document.getElementById('sourcingDiscoveryResults');
  const demands = document.getElementById('sourcingDemandList');
  const rfqs = document.getElementById('sourcingRfqList');
  if (discovery) discovery.innerHTML = '<div class="empty">Search the supplier network to begin.</div>';
  if (demands) demands.innerHTML = '<div class="empty">Loading procurement demands…</div>';
  if (rfqs) rfqs.innerHTML = '<div class="empty">Loading RFQs…</div>';
  await Promise.all([loadDemands(), loadRfqs(), loadRelationships(), renderProcurementCompletion()]);
}

async function loadDemands() {
  const list = document.getElementById('sourcingDemandList');
  if (!list || !can('procurement:demand:view')) return;
  try {
    const data = await request(`/tenants/${encodeURIComponent(config.chatId)}/procurement/demands?limit=100`);
    const rows = data.demands || [];
    list.innerHTML = rows.length ? rows.map(d => `<div class="table-card account-card"><div class="account-name">${esc(d.requestNumber)} · ${esc(d.status)}</div><div class="account-contact">${esc(d.currency)} · ${esc(d.requiredBy || 'No required-by date')} · ${d.items?.length || 0} item(s)</div><div class="account-notes">${esc(d.notes || '')}</div>${d.status === 'DRAFT' && can('procurement:demand:submit') ? `<div class="table-actions"><button type="button" data-demand-action="submit" data-id="${esc(d.id)}">Submit</button></div>` : ''}${d.status === 'SUBMITTED' && can('procurement:demand:sourcing') ? `<div class="table-actions"><button type="button" data-demand-action="sourcing" data-id="${esc(d.id)}">Start sourcing</button></div>` : ''}${d.status === 'SOURCING' && can('procurement:rfq:create') ? `<div class="table-actions"><button type="button" data-demand-rfq-prep="${esc(d.id)}">Prepare RFQ</button></div>` : ''}</div>`).join('') : '<div class="empty">No procurement demands yet.</div>';
  } catch (error) { list.innerHTML = `<div class="empty">${esc(error.message)}</div>`; }
}

async function loadRfqs() {
  const list = document.getElementById('sourcingRfqList');
  if (!list || !can('procurement:rfq:view')) return;
  try {
    const data = await request(`/tenants/${encodeURIComponent(config.chatId)}/procurement/rfqs?limit=100`);
    const rows = data.rfqs || [];
    list.innerHTML = rows.length ? rows.map(r => `<div class="table-card account-card"><div class="account-name">${esc(r.rfqNumber)} · ${esc(r.status)}</div><div class="account-contact">${esc(r.suppliers?.length || 0)} supplier(s) · ${esc(r.responses?.filter(x => x.status === 'SUBMITTED').length || 0)} response(s)</div><div class="account-notes">Demand ${esc(r.demandId)} · ${esc(r.responseDue || 'No response due date')}</div>${r.status === 'DRAFT' && can('procurement:rfq:send') ? `<div class="table-actions"><button type="button" data-rfq-action="send" data-id="${esc(r.id)}">Send RFQ</button></div>` : ''}${r.status === 'SENT' && can('procurement:rfq:close') ? `<div class="table-actions"><button type="button" data-rfq-action="close" data-id="${esc(r.id)}">Close RFQ</button></div>` : ''}${r.status === 'CLOSED' && can('procurement:comparison:create') ? `<div class="table-actions"><button type="button" data-rfq-action="compare" data-id="${esc(r.id)}">Create comparison</button></div>` : ''}</div>`).join('') : '<div class="empty">No RFQs yet.</div>';
  } catch (error) { list.innerHTML = `<div class="empty">${esc(error.message)}</div>`; }
}

async function loadRelationships() {
  const list = document.getElementById('sourcingRelationshipList');
  if (!list || !can('procurement:supplier:relationship:view')) return;
  try {
    const data = await request(`/tenants/${encodeURIComponent(config.chatId)}/procurement/supplier-relationships?direction=buyer&limit=100`);
    const rows = data.relationships || [];
    lastActiveSupplierRelationships = rows.filter(r => String(r.status || '').toUpperCase() === 'ACTIVE');
    list.innerHTML = rows.length ? rows.map(r => `<div class="table-card account-card"><div class="account-name">${esc(r.supplierOrganizationName)} · ${esc(r.status)}</div><div class="account-contact">Source: ${esc(r.source)}</div>${r.status === 'PENDING' && can('procurement:supplier:relationship:manage') ? `<div class="table-actions"><button type="button" data-relationship-action="ACTIVE" data-id="${esc(r.id)}">Activate relationship</button></div>` : ''}</div>`).join('') : '<div class="empty">No supplier relationships yet.</div>';
  } catch (error) { list.innerHTML = `<div class="empty">${esc(error.message)}</div>`; }
}

function prepareAiProposalFromOpportunity(opportunity) {
  const intent = document.getElementById('aiProcurementIntent');
  const context = document.getElementById('aiProcurementContext');
  if (!intent || !context) return;
  const supplierId = opportunity?.candidate?.organizationId || null;
  const evidence = Array.isArray(opportunity?.evidence) ? opportunity.evidence : [];
  const evidenceReferences = evidence.map((item, index) => ({
    source: item?.source || 'discovery-opportunity',
    id: item?.id || item?.evidenceId || `opportunity-${opportunity?.opportunityId || 'unknown'}-${index + 1}`,
    type: item?.type || 'discovery-evidence',
  }));
  const existingIntent = (() => {
    try { return intent.value.trim() ? JSON.parse(intent.value) : {}; } catch { return {}; }
  })();
  intent.value = JSON.stringify({
    ...existingIntent,
    mode: existingIntent.mode || 'SOURCE',
    preferredSupplierReferences: supplierId ? [{ authority: 'supplier_network', id: String(supplierId) }] : (existingIntent.preferredSupplierReferences || []),
    productReference: opportunity?.candidate?.productReference || existingIntent.productReference || undefined,
    evidenceReferences,
    sourcingOpportunityReference: { authority: 'discovery_opportunity', id: String(opportunity?.opportunityId || '') },
  }, null, 2);
  context.value = JSON.stringify({
    discoveryOpportunity: opportunity || {},
    supplyIntelligence: { derived: true, persistence: 'none', ranking: false, deterministic: true },
    procurement: { authority: 'existing procurement authority', authorizationRequired: true },
    evidence: evidenceReferences,
  }, null, 2);
  document.getElementById('aiProcurementCopilot')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('aiProcurementIntent')?.focus();
}

function prepareDemandFromOpportunity(opportunity) {
  const description = document.getElementById('sourcingDemandDescription');
  const quantity = document.getElementById('sourcingDemandQuantity');
  const unit = document.getElementById('sourcingDemandUnit');
  const notes = document.getElementById('sourcingDemandNotes');
  if (!description || !quantity || !unit || !notes) return;
  const intent = opportunity?.intent || {};
  const candidate = opportunity?.candidate || {};
  const label = candidate.label || candidate.productReference?.id || candidate.organizationId || 'sourcing requirement';
  description.value = intent.search || intent.query || label;
  if (intent.quantity != null && Number.isFinite(Number(intent.quantity)) && Number(intent.quantity) > 0) quantity.value = String(intent.quantity);
  if (intent.unit) unit.value = String(intent.unit);
  const supplierId = candidate.organizationId || '';
  notes.value = [
    `Prepared from sourcing opportunity ${String(opportunity?.opportunityId || 'unknown')}.`,
    supplierId ? `Discovered supplier reference: ${supplierId}.` : '',
    'Opportunity is derived discovery context; procurement authorization and demand creation remain in the canonical Procurement authority.',
  ].filter(Boolean).join(' ');
  document.getElementById('sourcingDemandCreate')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  description.focus();
}

function prepareAiProposalFromSupplier(candidate) {
  const intent = document.getElementById('aiProcurementIntent');
  const context = document.getElementById('aiProcurementContext');
  if (!intent || !context) return;
  const supplierId = candidate?.organizationId || candidate?.organization?.id || null;
  if (!supplierId) throw new Error('Selected supplier has no canonical organization reference.');
  const evidence = Array.isArray(candidate?.evidence) ? candidate.evidence : [];
  const evidenceReferences = evidence.map((item, index) => ({
    source: item?.source || 'supplier-network-discovery',
    id: item?.id || item?.evidenceId || `discovery-${supplierId}-${index + 1}`,
    type: item?.type || 'supplier-network-evidence',
  }));
  const existingIntent = (() => {
    try { return intent.value.trim() ? JSON.parse(intent.value) : {}; } catch { return {}; }
  })();
  intent.value = JSON.stringify({
    ...existingIntent,
    mode: existingIntent.mode || 'SOURCE',
    preferredSupplierReferences: [{ authority: 'supplier_network', id: String(supplierId) }],
    evidenceReferences,
  }, null, 2);
  context.value = JSON.stringify({
    discovery: {
      source: 'supplier-network',
      candidateOrganizationId: String(supplierId),
      candidate: candidate || {},
    },
    supplyIntelligence: { derived: true, persistence: 'none', ranking: false },
    procurement: { authority: 'existing procurement authority', authorizationRequired: true },
    evidence: evidenceReferences,
  }, null, 2);
  document.getElementById('aiProcurementCopilot')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('aiProcurementIntent')?.focus();
}

export async function searchSupplierNetwork() {
  const results = document.getElementById('sourcingDiscoveryResults');
  const q = document.getElementById('sourcingSearch')?.value?.trim() || '';
  if (!results || !can('supplier-network:discovery:discover')) return;
  results.innerHTML = '<div class="empty">Searching supplier network…</div>';
  try {
    const data = await request(`/api/discovery?chatId=${encodeURIComponent(config.chatId)}&providers=supplier-network&search=${encodeURIComponent(q)}&limit=25`);
    const rows = data.candidates || [];
    lastSourcingCandidates = rows;
    lastSourcingOpportunities = Array.isArray(data.opportunities) ? data.opportunities : [];
    renderSupplyIntelligence(rows);
    const opportunityCards = lastSourcingOpportunities.length ? `<div class=\"sync-note\" style=\"margin-bottom:10px;\"><strong>Derived sourcing opportunities</strong> · ${lastSourcingOpportunities.length} eligible opportunity(ies). These are derived, persistence-free and non-executing.</div>` + lastSourcingOpportunities.map((o, index) => `<div class=\"table-card account-card\"><div class=\"account-name\">Sourcing opportunity · ${esc(o.candidate?.label || o.candidate?.organizationId || 'candidate')}</div><div class=\"account-contact\">Opportunity ${esc(o.opportunityId)} · match ${esc(o.match?.matchScore ?? '')}</div><div class=\"account-notes\">Derived from deterministic discovery; owning domain remains responsible for execution.</div><div class=\"table-actions\"><button type=\"button\" data-demand-opportunity-index=\"${index}\">Prepare procurement demand</button><button type="button" data-ai-opportunity-index=\"${index}\">Use sourcing opportunity in AI proposal</button></div></div>`).join('') : '';
    const supplierCards = rows.map(r => {
      const supplierActions = r.organizationId
        ? '<div class="table-actions"><button type="button" data-ai-supplier-proposal="' + esc(r.organizationId) + '">Use supplier evidence in AI proposal</button>'
          + ((!r.relationshipActive && can('procurement:supplier:relationship:manage'))
            ? '<button type="button" data-supplier-connect="' + esc(r.organizationId) + '">Create relationship</button>'
            : '')
          + '</div>'
        : '';
      return `<div class="table-card account-card"><div class="account-name">${esc(r.organization?.name || r.organizationName || r.displayName)} · match ${esc(r.score ?? '')}</div><div class="account-contact">${esc(r.profile?.serviceSummary || '')}</div><div class="account-notes">${esc(r.profile?.description || r.description || r.explanation || '')}</div>${supplierActions}</div>`;
    }).join('');
    results.innerHTML = opportunityCards + (rows.length ? supplierCards : '<div class="empty">No matching suppliers found.</div>');
  } catch (error) { results.innerHTML = `<div class="empty">${esc(error.message)}</div>`; }
}

export async function createDemandFromUI() {
  if (!can('procurement:demand:create')) return;
  const description = document.getElementById('sourcingDemandDescription')?.value?.trim();
  const quantity = Number(document.getElementById('sourcingDemandQuantity')?.value);
  const unit = document.getElementById('sourcingDemandUnit')?.value?.trim() || 'unit';
  const currency = (document.getElementById('sourcingDemandCurrency')?.value?.trim() || config.currencyCode || 'ETB').toUpperCase();
  const requiredBy = document.getElementById('sourcingDemandRequiredBy')?.value || null;
  if (!description || !Number.isFinite(quantity) || quantity <= 0) throw new Error('Description and a positive quantity are required.');
  await request(`/tenants/${encodeURIComponent(config.chatId)}/procurement/demands`, { method: 'POST', body: JSON.stringify({ currency, requiredBy, items: [{ description, quantity, unit, currency }], notes: document.getElementById('sourcingDemandNotes')?.value?.trim() || '', idempotencyKey: `ui-demand-${crypto.randomUUID()}` }) });
  document.getElementById('sourcingDemandDescription').value = '';
  document.getElementById('sourcingDemandQuantity').value = '';
  document.getElementById('sourcingDemandNotes').value = '';
  await loadDemands();
}

async function transitionDemand(id, action) {
  const endpoint = action === 'submit' ? 'submit' : 'start-sourcing';
  await request(`/tenants/${encodeURIComponent(config.chatId)}/procurement/demands/${encodeURIComponent(id)}/${endpoint}`, { method: 'POST', body: '{}' });
  await loadDemands();
}

function prepareRfqFromDemand(demandId) {
  const demand = String(demandId || '').trim();
  if (!demand) throw new Error('A procurement demand is required to prepare an RFQ.');
  const demandInput = document.getElementById('sourcingRfqDemandId');
  const supplierInput = document.getElementById('sourcingRfqSuppliers');
  const notesInput = document.getElementById('sourcingRfqNotes');
  if (!demandInput || !supplierInput || !notesInput) return;
  const suppliers = lastActiveSupplierRelationships.map(r => r.supplierOrganizationId || r.supplier_organization_id).filter(Boolean);
  demandInput.value = demand;
  supplierInput.value = suppliers.join(', ');
  notesInput.value = suppliers.length
    ? `Prepared from SOURCING demand ${demand}. Active supplier relationships are prefilled for review; RFQ creation remains the canonical Procurement authority.`
    : `Prepared from SOURCING demand ${demand}. No active supplier relationships were found; add supplier organization IDs before creating the RFQ.`;
  document.getElementById('sourcingRfqCreate')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  supplierInput.focus();
}

async function connectSupplier(id) {
  await request(`/tenants/${encodeURIComponent(config.chatId)}/procurement/supplier-relationships`, { method: 'POST', body: JSON.stringify({ supplierOrganizationId: id, source: 'DISCOVERY' }) });
  await Promise.all([loadRelationships(), searchSupplierNetwork()]);
}

async function transitionRelationship(id, status) {
  await request(`/tenants/${encodeURIComponent(config.chatId)}/procurement/supplier-relationships/${encodeURIComponent(id)}/${status.toLowerCase()}`, { method: 'POST', body: '{}' });
  await Promise.all([loadRelationships(), searchSupplierNetwork()]);
}

export async function createRfqFromUI() {
  if (!can('procurement:rfq:create')) return;
  const demandId = document.getElementById('sourcingRfqDemandId')?.value?.trim();
  const suppliers = (document.getElementById('sourcingRfqSuppliers')?.value || '').split(',').map(v => v.trim()).filter(Boolean);
  if (!demandId || !suppliers.length) throw new Error('Demand ID and at least one supplier organization ID are required.');
  await request(`/tenants/${encodeURIComponent(config.chatId)}/procurement/rfqs`, { method: 'POST', body: JSON.stringify({ demandId, supplierOrganizationIds: suppliers, responseDue: document.getElementById('sourcingRfqDue')?.value || null, notes: document.getElementById('sourcingRfqNotes')?.value?.trim() || '', idempotencyKey: `ui-rfq-${crypto.randomUUID()}` }) });
  await loadRfqs();
}

async function rfqAction(id, action) {
  if (action === 'compare') {
    await request(`/tenants/${encodeURIComponent(config.chatId)}/procurement/comparisons`, { method: 'POST', body: JSON.stringify({ rfqId: id }) });
  } else {
    await request(`/tenants/${encodeURIComponent(config.chatId)}/procurement/rfqs/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: '{}' });
  }
  await loadRfqs();
}

export function bindSourcingUI() {
  document.getElementById('sourcingSearchBtn')?.addEventListener('click', () => searchSupplierNetwork().catch(showError));
  document.getElementById('sourcingDemandCreate')?.addEventListener('click', () => createDemandFromUI().catch(showError));
  document.getElementById('sourcingRfqCreate')?.addEventListener('click', () => createRfqFromUI().catch(showError));
  document.getElementById('sourcingRefresh')?.addEventListener('click', () => renderSourcing().catch(showError));
  document.getElementById('sourcingDiscoveryResults')?.addEventListener('click', event => {
    const demandOpportunityButton = event.target.closest('[data-demand-opportunity-index]');
    if (demandOpportunityButton) {
      const opportunity = lastSourcingOpportunities[Number(demandOpportunityButton.dataset.demandOpportunityIndex)];
      if (opportunity) { try { prepareDemandFromOpportunity(opportunity); } catch (error) { showError(error); } }
      return;
    }
    const proposalOpportunityButton = event.target.closest('[data-ai-opportunity-index]');
    if (proposalOpportunityButton) {
      const opportunity = lastSourcingOpportunities[Number(proposalOpportunityButton.dataset.aiOpportunityIndex)];
      if (opportunity) { try { prepareAiProposalFromOpportunity(opportunity); } catch (error) { showError(error); } }
      return;
    }
    const proposalButton = event.target.closest('[data-ai-supplier-proposal]');
    if (proposalButton) {
      const candidate = lastSourcingCandidates.find(item => String(item.organizationId || item.organization?.id || '') === String(proposalButton.dataset.aiSupplierProposal));
      if (candidate) { try { prepareAiProposalFromSupplier(candidate); } catch (error) { showError(error); } }
      return;
    }
    const b = event.target.closest('[data-supplier-connect]');
    if (b) connectSupplier(b.dataset.supplierConnect).catch(showError);
  });
  document.getElementById('sourcingDemandList')?.addEventListener('click', event => {
    const prep = event.target.closest('[data-demand-rfq-prep]');
    if (prep) { try { prepareRfqFromDemand(prep.dataset.demandRfqPrep); } catch (error) { showError(error); } return; }
    const b = event.target.closest('[data-demand-action]'); if (b) transitionDemand(b.dataset.id, b.dataset.demandAction).catch(showError);
  });
  document.getElementById('sourcingRfqList')?.addEventListener('click', event => { const b = event.target.closest('[data-rfq-action]'); if (b) { const action = b.dataset.rfqAction; if (action === 'compare') createComparison(b.dataset.id).catch(showError); else rfqAction(b.dataset.id, action).catch(showError); } });
  document.getElementById('sourcingAwardCreate')?.addEventListener('click', () => createAwardFromUI().catch(showError));
  document.getElementById('sourcingAwardList')?.addEventListener('click', event => { const b = event.target.closest('[data-award-action]'); if (b) awardAction(b.dataset.id, b.dataset.awardAction, b.dataset.supplier || '').catch(showError); });
  document.getElementById('sourcingProcurementPoList')?.addEventListener('click', event => { const b = event.target.closest('[data-procurement-po-action]'); if (b) transitionProcurementPo(b.dataset.id, b.dataset.procurementPoAction).catch(showError); });
}
function showError(error) { const root = document.getElementById('sourcingWorkspace'); if (root) root.insertAdjacentHTML('afterbegin', `<div class="empty">${esc(error.message || 'Sourcing action failed.')}</div>`); }

async function loadComparisons() {
  const list = document.getElementById('sourcingComparisonList');
  if (!list || !can('procurement:comparison:view')) return;
  try {
    const data = await request(`/tenants/${encodeURIComponent(config.chatId)}/procurement/comparisons?limit=100`);
    const rows = data.comparisons || [];
    list.innerHTML = rows.length ? rows.map(c => `<div class="table-card account-card"><div class="account-name">${esc(c.id)} · ${esc(c.status)} · v${esc(c.version)}</div><div class="account-contact">RFQ ${esc(c.rfqId)} · ${esc(c.currency)} · ${c.suppliers?.length || 0} supplier(s)</div><div class="account-notes">Deterministic comparison policy ${esc(c.policyVersion || '')}</div></div>`).join('') : '<div class="empty">No comparisons yet.</div>';
  } catch (error) { list.innerHTML = `<div class="empty">${esc(error.message)}</div>`; }
}

async function createComparison(id) {
  await request(`/tenants/${encodeURIComponent(config.chatId)}/procurement/comparisons`, { method: 'POST', body: JSON.stringify({ rfqId: id }) });
  await Promise.all([loadComparisons(), loadRfqs()]);
}

async function loadAwards() {
  const list = document.getElementById('sourcingAwardList');
  if (!list || !can('procurement:award:view')) return;
  try {
    const data = await request(`/tenants/${encodeURIComponent(config.chatId)}/procurement/awards?limit=100`);
    const rows = data.awards || [];
    list.innerHTML = rows.length ? rows.map(a => `<div class="table-card account-card"><div class="account-name">${esc(a.awardNumber)} · ${esc(a.status)}</div><div class="account-contact">Demand ${esc(a.demandId)} · RFQ ${esc(a.rfqId)} · comparison ${esc(a.comparisonId)}</div><div class="account-notes">${a.lines?.length || 0} award line(s) · ${esc(a.currency)}</div>${a.status === 'DRAFT' && can('procurement:award:confirm') ? `<div class="table-actions"><button type="button" data-award-action="confirm" data-id="${esc(a.id)}">Confirm award</button><button type="button" class="table-remove" data-award-action="cancel" data-id="${esc(a.id)}">Cancel</button></div>` : ''}${a.status === 'CONFIRMED' && can('procurement:award:execute') ? `<div class="table-actions"><button type="button" data-award-action="po" data-id="${esc(a.id)}" data-supplier="${esc(a.lines?.[0]?.supplierOrganizationId || '')}">Create purchase order</button></div>` : ''}</div>`).join('') : '<div class="empty">No awards yet.</div>';
  } catch (error) { list.innerHTML = `<div class="empty">${esc(error.message)}</div>`; }
}

async function createAwardFromUI() {
  if (!can('procurement:award:create')) return;
  const demandId = document.getElementById('sourcingAwardDemandId')?.value?.trim();
  const rfqId = document.getElementById('sourcingAwardRfqId')?.value?.trim();
  const comparisonId = document.getElementById('sourcingAwardComparisonId')?.value?.trim();
  const currency = (document.getElementById('sourcingAwardCurrency')?.value?.trim() || config.currencyCode || 'ETB').toUpperCase();
  if (!demandId || !rfqId || !comparisonId) throw new Error('Demand ID, RFQ ID and comparison ID are required.');
  let lines;
  try { lines = JSON.parse(document.getElementById('sourcingAwardLines')?.value || '[]'); } catch { throw new Error('Award lines must be valid JSON.'); }
  if (!Array.isArray(lines) || !lines.length) throw new Error('At least one award line is required.');
  await request(`/tenants/${encodeURIComponent(config.chatId)}/procurement/awards`, { method: 'POST', body: JSON.stringify({ demandId, rfqId, comparisonId, currency, lines, idempotencyKey: `ui-award-${crypto.randomUUID()}` }) });
  document.getElementById('sourcingAwardLines').value = '';
  await loadAwards();
}

async function awardAction(id, action, supplierId = '') {
  if (action === 'po') {
    if (!supplierId) throw new Error('A supplier organization is required for PO creation.');
    await request(`/tenants/${encodeURIComponent(config.chatId)}/b2b/purchase-orders`, { method: 'POST', body: JSON.stringify({ sourceType: 'PROCUREMENT_AWARD', procurementAwardId: id, supplierOrganizationId: supplierId }) });
  } else {
    await request(`/tenants/${encodeURIComponent(config.chatId)}/procurement/awards/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: '{}' });
  }
  await Promise.all([loadAwards(), loadProcurementPurchaseOrders()]);
}

async function loadProcurementPurchaseOrders() {
  const list = document.getElementById('sourcingProcurementPoList');
  if (!list || !can('b2b:po:view')) return;
  try {
    const data = await request(`/tenants/${encodeURIComponent(config.chatId)}/b2b/purchase-orders?limit=100`);
    const rows = (data.purchaseOrders || []).filter(po => String(po.sourceType || po.source_type || '').toUpperCase() === 'PROCUREMENT_AWARD');
    list.innerHTML = rows.length ? rows.map(po => `<div class="table-card account-card"><div class="account-name">${esc(po.poNumber)} · ${esc(po.status)}</div><div class="account-contact">Award ${esc(po.procurementAwardId || po.procurement_award_id || '')} · ${esc(po.currency)} ${Number(po.totalMinor || 0).toLocaleString()}</div><div class="account-notes">${po.items?.length || 0} item(s) · supplier ${esc(po.supplierOrganizationId || '')}</div>${po.status === 'DRAFT' && can('b2b:po:create') ? `<div class="table-actions"><button type="button" data-procurement-po-action="submit" data-id="${esc(po.id)}">Submit PO</button></div>` : ''}${po.status === 'SUBMITTED' && can('b2b:po:approve') ? `<div class="table-actions"><button type="button" data-procurement-po-action="approve" data-id="${esc(po.id)}">Approve PO</button></div>` : ''}</div>`).join('') : '<div class="empty">No procurement-origin purchase orders yet.</div>';
  } catch (error) { list.innerHTML = `<div class="empty">${esc(error.message)}</div>`; }
}

async function transitionProcurementPo(id, action) {
  const status = action === 'approve' ? 'APPROVED' : 'SUBMITTED';
  await request(`/tenants/${encodeURIComponent(config.chatId)}/b2b/purchase-orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  await loadProcurementPurchaseOrders();
}

async function loadProcurementReceipts() {
  const list = document.getElementById('sourcingProcurementReceiptList');
  if (!list || !can('procurement:receipt:view')) return;
  try {
    const data = await request(`/tenants/${encodeURIComponent(config.chatId)}/procurement/receipts?limit=100`);
    const rows = data.receipts || [];
    list.innerHTML = `<strong>Procurement receipts</strong>${rows.length ? rows.map(r => `<div class="table-card account-card"><div class="account-name">${esc(r.receiptNumber)} · ${esc(r.status)}</div><div class="account-contact">PO ${esc(r.purchaseOrderId)} · location ${esc(r.locationId)} · ${esc(r.receivedAt || '')}</div><div class="account-notes">${r.lines?.length || 0} line(s)</div></div>`).join('') : '<div class="empty">No procurement receipts yet.</div>'}`;
  } catch (error) { list.innerHTML = `<div class="empty">${esc(error.message)}</div>`; }
}

export async function renderProcurementCompletion() {
  await Promise.all([loadComparisons(), loadAwards(), loadProcurementPurchaseOrders(), loadProcurementReceipts()]);
}
