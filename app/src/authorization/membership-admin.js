// P1-09 — canonical membership role administration.
// Uses the existing memberships store and server authorization endpoint; no
// client-side role assignment is authoritative.
import { config, currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';
import { authHeaders } from '../auth/tenant.js';

const ROLE_OPTIONS = Object.freeze(['owner','manager','cashier','staff','buyer','viewer']);

function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
async function request(path, options = {}) {
  const base = String(config.syncUrl || '').replace(/\/$/, '');
  if (!base) throw new Error('Sync server URL is not configured');
  const res = await fetch(`${base}${path}`, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Request failed (${res.status})`);
  return data;
}

export async function renderMembershipAdministration(containerId = 'membershipAdministrationPanel') {
  const el = document.getElementById(containerId); if (!el) return;
  if (!config.sessionToken || !config.chatId) { el.innerHTML = '<div class="hint">UNKNOWN — no authenticated membership context.</div>'; return; }
  if (!hasPermission(currentStaff?.role || config.tenantRole || 'owner', 'membership:role:manage')) { el.innerHTML = '<div class="hint">PERMISSION_DENIED — membership administration is not available to this role.</div>'; return; }
  const requestChatId = config.chatId;
  const requestSessionToken = config.sessionToken;
  el.innerHTML = '<div class="settings-section-label">Membership administration</div><div class="hint">Loading canonical memberships…</div>';
  try {
    const data = await request(`/tenants/${encodeURIComponent(requestChatId)}/memberships`);
    if (config.chatId !== requestChatId || config.sessionToken !== requestSessionToken) return;
    const memberships = Array.isArray(data.memberships) ? data.memberships : [];
    const roles = ROLE_OPTIONS;
    el.innerHTML = `<div class="settings-section-label">Membership administration</div>
      <div class="hint">Role changes are server-authorized and audited. You cannot change your own role.</div>
      ${memberships.length ? memberships.map(m => `<div style="padding:10px;border:1px solid var(--line);border-radius:8px;margin-top:8px;">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;"><strong>${esc(m.displayName || 'Member')}</strong><span class="status-badge">${esc(m.role)}</span></div>
        <div class="hint">Membership: ${esc(m.id || 'unknown')}</div>
        ${m.id && m.role !== 'owner' && m.userId !== currentStaff.userId && m.userId !== currentStaff.id ? `<div style="display:flex;gap:8px;margin-top:8px;"><select data-membership-role="${esc(m.id)}">${roles.map(r => `<option value="${r}" ${r===m.role?'selected':''}>${r}</option>`).join('')}</select><button type="button" data-save-membership="${esc(m.id)}">Save role</button></div>` : '<div class="hint" style="margin-top:6px;">Current membership is protected from self/owner reassignment in this surface.</div>'}
      </div>`).join('') : '<div class="hint">No memberships found for this business.</div>'}`;
    el.querySelectorAll('[data-save-membership]').forEach(btn => btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-save-membership'); const select = el.querySelector(`[data-membership-role="${CSS.escape(id)}"]`);
      btn.disabled = true;
      const mutationChatId = config.chatId;
      const mutationSessionToken = config.sessionToken;
      const nextRole = select?.value;
      if (!id || !ROLE_OPTIONS.includes(nextRole)) { btn.disabled=false; btn.textContent='Invalid role'; return; }
      try {
        await request('/auth/membership-role', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ membershipId:id, role:nextRole }) });
        if (config.chatId !== mutationChatId || config.sessionToken !== mutationSessionToken) return;
        btn.textContent='Saved';
        setTimeout(() => {
          if (config.chatId === mutationChatId && config.sessionToken === mutationSessionToken) renderMembershipAdministration(containerId);
        }, 300);
      } catch (e) {
        if (config.chatId !== mutationChatId || config.sessionToken !== mutationSessionToken) return;
        btn.disabled=false; btn.textContent=e.message || 'Failed';
      }
    }));
  } catch (e) { el.innerHTML = `<div class="settings-section-label">Membership administration</div><div class="hint">UNKNOWN — ${esc(e.message || 'Could not load memberships.')}</div>`; }
}
