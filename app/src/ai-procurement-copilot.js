// Phase 22 productization — AI Procurement Copilot review boundary.
// This UI consumes structured AI output only. It does not implement an AI
// provider, persistence, authorization, transaction execution, or database
// access. Existing Phase 22 contracts remain the authority boundary.
import { config } from './state.js';
import { defineProcurementIntent } from './phase22-procurement-intent.js';
import { defineProcurementActionProposal } from './phase22-action-proposal-authorization.js';

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function resultHtml(title, body, kind='ok') {
  const symbol = kind === 'error' ? '✕' : '✓';
  return `<div class="sync-note" style="border-left:3px solid var(--line);padding-left:10px;"><strong>${symbol} ${esc(title)}</strong><div style="margin-top:6px;white-space:pre-wrap;word-break:break-word;">${body}</div></div>`;
}

function review() {
  const out = $('aiProcurementResult');
  try {
    const raw = $('aiProcurementIntent').value.trim();
    if (!raw) throw new Error('Structured procurement intent is required.');
    const parsed = JSON.parse(raw);
    const intent = defineProcurementIntent({
      ...parsed,
      organizationId: parsed.organizationId || config.organizationId || config.orgId || config.chatId,
    });
    const proposal = defineProcurementActionProposal({
      type: 'PREPARE',
      targetAuthority: 'procurement',
      targetCapability: $('aiProcurementCapability').value,
      targetAction: $('aiProcurementAction').value,
      targetReferences: [{ authority: 'procurement', id: intent.intentId || 'request-scoped-intent' }],
      reason: 'Prepared from reviewed structured procurement intent',
      evidenceReferences: Array.isArray(parsed.evidenceReferences) ? parsed.evidenceReferences : [],
      status: 'proposed',
      idempotencyKey: parsed.idempotencyKey || null,
    });
    out.innerHTML = resultHtml('Intent valid — proposal prepared',
      `<strong>Mode:</strong> ${esc(intent.mode)}\n` +
      `<strong>Quantity:</strong> ${esc(intent.quantity)} ${esc(intent.unit)}\n` +
      `<strong>Currency:</strong> ${esc(intent.currency || 'unspecified')}\n` +
      `<strong>Confidence:</strong> ${esc(intent.confidence)}\n` +
      `<strong>Target:</strong> ${esc(proposal.targetCapability)} → ${esc(proposal.targetAction)}\n` +
      `<strong>Execution:</strong> none\n` +
      `<strong>Persistence:</strong> none\n` +
      `<strong>Authorization:</strong> existing procurement authorization required`);
  } catch (error) {
    out.innerHTML = resultHtml('Intent rejected', esc(error?.message || 'Invalid structured procurement intent.'), 'error');
  }
}

if ($('aiProcurementReview')) $('aiProcurementReview').addEventListener('click', review);
