// P0-05 — AI Procurement Proposal surface.
// UI-only composition of existing Phase 22 contracts. No AI provider, persistence,
// authorization authority, transaction execution, or database access is introduced.
import { config } from './state.js';
import { defineProcurementIntent } from './phase22-procurement-intent.js';
import { defineProcurementContext } from './phase22-procurement-context.js';
import { defineProcurementPreparation } from './phase22-procurement-preparation.js';
import { defineProcurementActionProposal } from './phase22-action-proposal-authorization.js';

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function render(title, body, state='SUCCESS') {
  const out = $('aiProcurementResult');
  if (!out) return;
  const tone = state === 'FAILURE' ? 'error' : state === 'UNKNOWN' ? 'unknown' : 'ok';
  out.dataset.state = state;
  out.innerHTML = `<div class="sync-note ${tone}" role="status"><strong>${esc(state)} — ${esc(title)}</strong><div style="margin-top:8px;white-space:pre-wrap;word-break:break-word;">${body}</div></div>`;
}

function parseJson(id, fallback) {
  const value = $(id)?.value?.trim();
  if (!value) return fallback;
  return JSON.parse(value);
}

function review() {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      render('AI proposal cannot be verified while offline', 'Reconnect before treating contextual evidence or authorization status as current.', 'UNKNOWN');
      return;
    }
    const parsed = parseJson('aiProcurementIntent', {});
    const organizationId = parsed.organizationId || config.organizationId || config.orgId || config.chatId;
    const intent = defineProcurementIntent({ ...parsed, organizationId });
    const contextInput = parseJson('aiProcurementContext', {
      intent: { authority: 'ai_intent_boundary', id: intent.intentId || 'request-scoped-intent' }
    });
    const context = defineProcurementContext({ ...contextInput, intent: contextInput.intent || { authority: 'ai_intent_boundary', id: intent.intentId || 'request-scoped-intent' } });
    const preparationInput = parseJson('aiProcurementPreparation', {
      intent,
      context,
      items: [{
        description: parsed.notes || parsed.productReference?.id || parsed.commodityReference?.id || 'Requested procurement item',
        quantity: parsed.quantity,
        unit: parsed.unit,
        productReference: parsed.productReference,
        commodityReference: parsed.commodityReference,
      }],
      recipientReferences: parsed.preferredSupplierReferences || []
    });
    const preparation = defineProcurementPreparation({ ...preparationInput, intent, context });
    const proposal = defineProcurementActionProposal({
      type: 'PREPARE',
      targetAuthority: 'procurement',
      targetCapability: $('aiProcurementCapability')?.value || 'procurement.demand',
      targetAction: $('aiProcurementAction')?.value || 'view',
      targetReferences: [{ authority: 'procurement', id: intent.intentId || 'request-scoped-intent' }],
      reason: 'AI-derived procurement proposal prepared for human review',
      evidenceReferences: Array.isArray(parsed.evidenceReferences) ? parsed.evidenceReferences : [],
      status: 'proposed',
      idempotencyKey: parsed.idempotencyKey || null,
    });
    render('Proposal ready for review',
      `<strong>Intent:</strong> ${esc(intent.mode)} · ${esc(intent.quantity)} ${esc(intent.unit)}\n` +
      `<strong>Context:</strong> ${esc(context.state)}\n` +
      `<strong>Preparation:</strong> ${esc(preparation.state)}\n` +
      `<strong>Evidence:</strong> ${esc(parsed.evidenceReferences?.length ? `${parsed.evidenceReferences.length} reference(s)` : 'none supplied')}\n` +
      `<strong>Proposed capability:</strong> ${esc(proposal.targetCapability)} → ${esc(proposal.targetAction)}\n` +
      `<strong>Authorization:</strong> existing procurement authorization required\n` +
      `<strong>Execution:</strong> none in Phase 22\n` +
      `<strong>Persistence:</strong> none in Phase 22\n` +
      `<strong>Canonical authority:</strong> Procurement\n\nThis proposal is not a demand, RFQ, award, PO, payment, inventory mutation, supplier ranking, or authorization decision.`);
  } catch (error) {
    render('Proposal rejected', esc(error?.message || 'Invalid AI procurement proposal.'), 'FAILURE');
  }
}

if ($('aiProcurementReview')) $('aiProcurementReview').addEventListener('click', review);
