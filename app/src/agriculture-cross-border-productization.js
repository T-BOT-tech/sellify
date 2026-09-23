// R1 productization — Agriculture + Cross-Border composition surface.
// This module exposes existing deterministic contracts to the Sourcing UI.
// It owns no Agriculture, Inventory, Procurement, Trade, Payment, Logistics,
// Tax, Compliance, persistence, authorization, or provider execution authority.
import { projectAgricultureSupplyContext } from './phase21-agriculture-supply-integration.js';
import { evaluateCrossBorder } from './cross-border-evaluation.js';

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function render(target, title, lines, kind = 'ok') {
  const symbol = kind === 'error' ? '✕' : '✓';
  target.innerHTML = `<div class="sync-note" style="border-left:3px solid var(--line);padding-left:10px;"><strong>${symbol} ${esc(title)}</strong><div style="margin-top:6px;white-space:pre-wrap;word-break:break-word;">${lines.map(esc).join('\n')}</div></div>`;
}

function parseJson(id, label) {
  const raw = $(id)?.value.trim();
  if (!raw) throw new Error(`${label} JSON is required.`);
  return JSON.parse(raw);
}

function reviewAgriculture() {
  const out = $('agricultureSupplyResult');
  try {
    const input = parseJson('agricultureSupplyInput', 'Agriculture supply context');
    const result = projectAgricultureSupplyContext(input);
    render(out, 'Agriculture supply context validated', [
      `Commodity: ${result.commodityReference.id}`,
      `Farm: ${result.farmReference?.id ?? 'not supplied'}`,
      `Crop: ${result.cropReference?.id ?? 'not supplied'}`,
      `Supply: ${result.supplyReference?.id ?? 'not supplied'}`,
      `Harvest: ${result.harvestReference?.id ?? 'not supplied'}`,
      'Persistence: none',
      'Mutation: none',
      'Inventory: existing Inventory authority',
      'Procurement: existing Procurement authority',
    ]);
  } catch (error) {
    render(out, 'Agriculture context rejected', [error?.message || 'Invalid Agriculture context.'], 'error');
  }
}

function evaluateTrade() {
  const out = $('crossBorderResult');
  try {
    const origin = $('crossBorderOrigin').value.trim().toUpperCase();
    const destination = $('crossBorderDestination').value.trim().toUpperCase();
    if (!origin || !destination) throw new Error('Origin and destination country codes are required.');
    const opportunityId = $('crossBorderOpportunity').value.trim();
    const dimension = (id) => $(id).value;
    const result = evaluateCrossBorder({
      opportunityReference: opportunityId ? { id: opportunityId, authority: 'phase21-derived-sourcing-opportunity' } : null,
      origin,
      destination,
      commercial: dimension('cbCommercial'),
      capacity: dimension('cbCapacity'),
      qualification: dimension('cbQualification'),
      requirements: dimension('cbRequirements'),
      currency: dimension('cbCurrency'),
      logistics: dimension('cbLogistics'),
      payment: dimension('cbPayment'),
      provenance: { source: 'sourcing_workspace_user_supplied_evidence' },
    });
    const blockers = result.blockers.map(item => `${item.dimension}: ${item.reason}`);
    const unknown = result.unknown.map(item => `${item.dimension}: ${item.reason}`);
    const review = result.review.map(item => `${item.dimension}: ${item.reason}`);
    render(out, `Cross-border evaluation: ${result.result}`, [
      `Lane: ${result.origin} → ${result.destination}`,
      `Deterministic: ${result.deterministic}`,
      `Blockers: ${blockers.length ? blockers.join('; ') : 'none'}`,
      `Unknown: ${unknown.length ? unknown.join('; ') : 'none'}`,
      `Review required: ${review.length ? review.join('; ') : 'none'}`,
      'Persistence: none',
      'Authorization: none',
      'Execution: none',
      'Next action remains with the owning domain; this surface does not create orders, shipments, payments, or customs/compliance decisions.',
    ]);
  } catch (error) {
    render(out, 'Cross-border evaluation rejected', [error?.message || 'Invalid cross-border input.'], 'error');
  }
}

if ($('agricultureSupplyReview')) $('agricultureSupplyReview').addEventListener('click', reviewAgriculture);
if ($('crossBorderEvaluate')) $('crossBorderEvaluate').addEventListener('click', evaluateTrade);
