// auth/pin.js
// Phase 3 extraction (see modularization plan §5): staff PIN modal + invite
// code handling, moved out of main.js unchanged.
//
// NOTE on the `../main.js` import below: verifyPinAndSwitch shows a toast on
// too-many-failed-attempts (`showToast(...)`), and showToast still lives in
// main.js at this phase (it moves out in Phase 7 per the plan's migration
// order — ui/toast.js). Importing it back from main.js creates a harmless
// circular import, the same temporary pattern storage/json.js and
// storage/persistence.js already use — see storage/json.js for the full
// explanation. It goes away once showToast has its own module.
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { showToast } from '../ui/toast.js';
import { STORAGE_KEYS } from '../constants.js';
import { saveJSON } from '../storage/json.js';
import { staffList, currentStaff, setCurrentStaff } from '../state.js';
import { applyRolePermissions } from './permissions.js';

// ---------- PIN hashing (Phase 3 fix, see modularization plan §5, Phase 3 /
// audit "Real authorization, not UI-only") ----------
//
// PINs used to be stored as plain text in staffList — including the old
// hardcoded seed data (1234/2222/0000, guessable on sight, and until this
// fix, spelled out for anyone who fat-fingered the pinModal). Hashing them
// closes the specific exposure of "anyone with read access to
// localStorage/IndexedDB, a synced backup, or a browser extension sees
// every staff PIN at a glance."
//
// What this does NOT do: make a 4-digit PIN resistant to brute force
// against a stolen hash — there are only 10,000 possible values, so an
// offline guesser with the salt and the hash gets in almost immediately
// regardless of hashing. That's exactly why staffList/pin.js keep saying
// this is a local convenience, not authentication, and why it's never
// used as the credential for anything server-side (see server.js's
// apiKey-based auth model for what actually gates writes).
const PIN_SALT_KEY = 'ledger_pin_salt_v1';

function getOrCreatePinSalt() {
  let salt;
  try {
    salt = localStorage.getItem(PIN_SALT_KEY);
  } catch (e) {
    salt = null;
  }
  if (!salt) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    salt = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem(PIN_SALT_KEY, salt); } catch (e) { /* best effort — worst case a fresh salt is generated next boot too */ }
  }
  return salt;
}

async function hashPin(pin) {
  const salt = getOrCreatePinSalt();
  const data = new TextEncoder().encode(salt + ':' + pin);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomFourDigitPin() {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return String(1000 + (bytes[0] % 9000));
}

// Runs once at boot (see main.js, after IndexedDB hydration so it operates
// on whichever copy of staffList — localStorage or IDB — actually won).
// Two jobs:
//   1. Any staff member still carrying a plain-text `pin` (pre-Phase-3
//      data, including anyone who never updated past the old hardcoded
//      seed) gets it hashed into `pinHash`, and the plain-text field is
//      deleted.
//   2. Any staff member with neither `pin` nor `pinHash` (a fresh
//      install's seed data, which no longer ships with default PINs)
//      gets a random one generated on the spot.
// Since step 2 is the only moment a freshly-generated PIN exists anywhere
// in the clear, it's surfaced via a blocking alert — same pattern
// handleLocalStationJoinCode already uses below for invite-created stations —
// rather than the auto-dismissing toast, so it can't be missed.
export async function ensureStaffPinsHashed() {
  let dirty = false;
  const newlyGenerated = [];
  for (const staff of staffList) {
    if (staff.pin) {
      staff.pinHash = await hashPin(staff.pin);
      delete staff.pin;
      dirty = true;
    } else if (!staff.pinHash) {
      const pin = randomFourDigitPin();
      staff.pinHash = await hashPin(pin);
      dirty = true;
      newlyGenerated.push({ staff, pin });
    }
  }
  if (dirty) saveJSON(STORAGE_KEYS.staff, staffList);
  if (newlyGenerated.length) {
    const lines = newlyGenerated.map(({ staff, pin }) => `${staff.name} (${staff.role.toUpperCase()}): ${pin}`).join('\n');
    setTimeout(() => {
      alert(
        `Station PINs have been generated for this device:\n\n${lines}\n\n` +
        `Write these down — they won't be shown again. PINs are a local ` +
        `convenience for switching staff profiles on this device, not a ` +
        `security credential: anyone with physical access to this device ` +
        `and a few minutes to guess a 4-digit number can still get in.`
      );
    }, 400);
  }
}

export function openPinModal() {
  const select = document.getElementById('pinStaffSelect');
  if (select) {
    select.innerHTML = staffList.map(s =>
      `<option value="${s.id}" ${s.id === currentStaff.id ? 'selected' : ''}>${s.name} (${s.role.toUpperCase()})</option>`
    ).join('');
  }
  const pinIn = document.getElementById('pinInput');
  if (pinIn) pinIn.value = '';
  const err = document.getElementById('pinError');
  if (err) err.style.display = 'none';
  document.getElementById('pinModal').style.display = 'flex';
}

export function closePinModal() {
  document.getElementById('pinModal').style.display = 'none';
}

let pinAttempts = 0;
export async function verifyPinAndSwitch() {
  const staffId = document.getElementById('pinStaffSelect').value;
  const pinEntered = document.getElementById('pinInput').value.trim();
  const selectedStaff = staffList.find(s => s.id === staffId);

  if (!selectedStaff) return;

  // SECURITY (local-convenience scope only — see ensureStaffPinsHashed's
  // comment above): only the selected staff member's own PIN is accepted,
  // no shared master codes. Phase 3 fix: compares against the hashed PIN
  // now, not plain text — falls back to a stray plain-text `pin` field
  // only if hashing somehow hasn't run yet (shouldn't happen once
  // ensureStaffPinsHashed has completed at boot), so a station mid-migration
  // doesn't lock its owner out.
  const isMatch = selectedStaff.pinHash
    ? selectedStaff.pinHash === await hashPin(pinEntered)
    : !!(selectedStaff.pin && selectedStaff.pin === pinEntered);

  if (!isMatch) {
    pinAttempts += 1;
    const err = document.getElementById('pinError');
    if (err) err.style.display = 'block';
    if (pinAttempts >= 5) {
      pinAttempts = 0;
      showToast('Too many failed attempts. Try again later.');
      closePinModal();
    }
    return;
  }

  pinAttempts = 0;
  setCurrentStaff(selectedStaff);
  saveJSON(STORAGE_KEYS.activeStaff, currentStaff);
  closePinModal();
  applyRolePermissions(currentStaff.role);
  showToast(`Station unlocked: ${currentStaff.name} (${currentStaff.role.toUpperCase()})`);
}

// Handles a `JOIN_<role>_<name>` deep link (e.g. from a Telegram invite button) by
// registering a new LOCAL PIN STATION on this device — not a tenant
// membership. There's no server-side identity check here — like the rest
// of the staff/PIN system, this is a per-device convenience for shared
// hardware (e.g. a shop's shared tablet), not real authentication (see the
// access-control note from the code review). It intentionally does not
// touch users/memberships/sessions in lib/store-sqlite.js — for a real,
// server-verified staff identity, use createStaffInvite/acceptStaffInvite
// in auth/tenant.js instead. Because this is the only moment the PIN
// exists anywhere, it's shown via a blocking alert() rather than the
// auto-dismissing toast, so it can't be missed before it scrolls away.
export async function handleLocalStationJoinCode(startAppParam) {
  const parts = startAppParam.split('_');
  const roleRaw = (parts[1] || '').toLowerCase();
  const validRoles = ['owner', 'manager', 'cashier', 'buyer'];
  let role = validRoles.includes(roleRaw) ? roleRaw : 'cashier';
  // Phase 3 fix (see modularization plan §5, Phase 3): a JOIN_ link is
  // just a URL — anyone who can construct or guess one (e.g. a bot's
  // public username plus "JOIN_owner_Name") could mint themselves a
  // brand-new OWNER station with full permissions, with no server-side
  // identity check whatsoever. Deep-link invites can no longer create an
  // owner station at all; getting owner access on a new device now
  // requires someone who already holds an owner PIN on an existing
  // station to set it up in person, not a link.
  if (role === 'owner') role = 'manager';
  const rawName = parts.slice(2).join(' ').replace(/\+/g, ' ').trim();
  const name = rawName || `${role.charAt(0).toUpperCase()}${role.slice(1)} Station ${staffList.length + 1}`;
  const pin = String(Math.floor(1000 + Math.random() * 9000));
  const pinHash = await hashPin(pin);

  staffList.push({ id: 'staff_' + Date.now(), name, role, pinHash });
  saveJSON(STORAGE_KEYS.staff, staffList);

  setTimeout(() => {
    alert(`Welcome, ${name}!\n\nYour station PIN: ${pin}\n\nWrite this down — it won't be shown again. Use it to unlock this station from the staff badge in the top bar.`);
    openPinModal();
  }, 400);
}
