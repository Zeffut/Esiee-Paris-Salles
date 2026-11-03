// =============================================================================
// ESIEE Salles — noyau partagé par toutes les pages
// (données des salles, calculs d'horaires, suivi analytique, petits utilitaires)
// =============================================================================
'use strict';

// Thème : clair uniquement tant que le sombre n'est pas dessiné.
// La préférence « theme » du localStorage est conservée telle quelle pour plus tard.
document.documentElement.setAttribute('data-theme', 'light');

const App = (window.App = window.App || {});

App.API = 'https://api.zeffut.fr/api';
App.DAY_START = 8;   // bornes de la frise de la journée
App.DAY_END = 20;
App.SNAPSHOT_KEY = 'roomsSnapshot';

// -----------------------------------------------------------------------------
// Utilitaires
// -----------------------------------------------------------------------------

App.esc = function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};

App.$ = (sel, root = document) => root.querySelector(sel);
App.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

App.debounce = function debounce(fn, wait) {
  let t;
  return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), wait); };
};

App.storage = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* quota / mode privé */ }
  },
  remove(key) { try { localStorage.removeItem(key); } catch (e) {} }
};

// Suivi : Rybbit + PostHog, silencieux s'ils ne sont pas chargés.
// Les noms et propriétés des événements existants sont conservés pour comparer avant / après.
App.track = function track(name, props) {
  if (window.rybbit) { try { window.rybbit.event(name, props); } catch (e) {} }
  if (window.posthog) { try { window.posthog.capture(name, props); } catch (e) {} }
};

let toastTimer = null;
App.toast = function toast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
};

// -----------------------------------------------------------------------------
// Salles : épi, étage, libellés
// -----------------------------------------------------------------------------

// Valeurs internes identiques à l'ancien code (« Rue », « Epis 1 »…) : elles
// alimentent les propriétés d'événements PostHog building / epis.
App.roomEpis = function roomEpis(num) {
  num = String(num);
  if (num.length === 3) return 'Rue';
  const d = num.charAt(0);
  return d >= '1' && d <= '7' ? `Epis ${d}` : 'Rue';
};

App.roomFloor = function roomFloor(num) {
  num = String(num);
  if (num.length === 3) return num.charAt(0) === '2' ? '2ème étage' : '1er étage';
  switch (num.charAt(1)) {
    case '0': return 'Sous-sol';
    case '1': return '1er étage';
    case '2': return '2ème étage';
    case '3': return '3ème étage';
    case '4': return '4ème étage';
    default: return 'Étage inconnu';
  }
};

App.episLabel = (epis) => (epis === 'Rue' ? 'Rue' : epis.replace('Epis', 'Épi'));

App.floorLabel = function floorLabel(floor) {
  return { 'Sous-sol': 'Sous-sol', '1er étage': '1er étage', '2ème étage': '2e étage',
    '3ème étage': '3e étage', '4ème étage': '4e étage' }[floor] || floor;
};

App.isAmphi = (room) => /amphi/i.test(room?.type || '');

App.roomMeta = function roomMeta(room, { epi = true, places = true } = {}) {
  const parts = [];
  if (epi) parts.push(App.episLabel(room.epis));
  parts.push(App.floorLabel(room.floor));
  if (places && room.capacity) parts.push(`${room.capacity} places`);
  return parts.join(' · ');
};

// -----------------------------------------------------------------------------
// Temps
// -----------------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');

App.fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

App.fmtDur = function fmtDur(min) {
  min = Math.max(0, Math.round(min));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${pad(m)}` : `${h} h`;
};

App.fmtHeaderDate = function fmtHeaderDate(d) {
  const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return `${s.charAt(0).toUpperCase()}${s.slice(1)} · ${App.fmtTime(d)}`;
};

App.atHour = function atHour(base, h) {
  const d = new Date(base);
  d.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0);
  return d;
};

App.sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

App.localDateISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// -----------------------------------------------------------------------------
// État des salles
// -----------------------------------------------------------------------------

App.data = {
  rooms: {},          // numéro -> { number, name, board, capacity, type, epis, floor }
  numbers: [],        // numéros triés
  schedules: {},      // numéro -> [{ start, end, summary }] (ISO)
  reservations: [],   // réservations actives toutes salles confondues
  loadedAt: null,     // Date de réception des données
  stale: false        // true si on affiche un instantané faute d'API
};

function ingestRooms(list, schedules, reservations) {
  const rooms = {};
  (list || []).forEach((r) => {
    const number = String(r.number);
    rooms[number] = {
      number,
      name: r.name || `Salle ${number}`,
      board: r.board || '',
      capacity: r.capacity ? Number(r.capacity) || r.capacity : null,
      type: r.type || 'Salle classique',
      epis: App.roomEpis(number),
      floor: App.roomFloor(number)
    };
  });
  App.data.rooms = rooms;
  App.data.numbers = Object.keys(rooms).sort((a, b) => a.padStart(4, '0').localeCompare(b.padStart(4, '0')));
  App.data.schedules = schedules || {};
  App.data.reservations = Array.isArray(reservations) ? reservations : [];
}

// On ne garde dans l'instantané que les événements du jour : il reste léger.
function saveSnapshot(list, schedules, reservations) {
  const now = new Date();
  const today = {};
  Object.entries(schedules || {}).forEach(([num, events]) => {
    const kept = (events || []).filter((e) => App.sameDay(new Date(e.start), now) || App.sameDay(new Date(e.end), now));
    if (kept.length) today[num] = kept;
  });
  App.storage.set(App.SNAPSHOT_KEY, {
    at: now.toISOString(),
    rooms_list: (list || []).map((r) => ({ number: r.number, name: r.name, board: r.board, capacity: r.capacity, type: r.type })),
    room_schedules: today,
    reservations: reservations || []
  });
}

function loadSnapshot() {
  const snap = App.storage.get(App.SNAPSHOT_KEY);
  if (!snap || !snap.at || !Array.isArray(snap.rooms_list)) return false;
  const at = new Date(snap.at);
  if (!App.sameDay(at, new Date())) return false; // l'emploi du temps d'un autre jour ne sert à rien
  ingestRooms(snap.rooms_list, snap.room_schedules, snap.reservations);
  App.data.loadedAt = at;
  App.data.stale = true;
  return true;
}

// Charge /rooms et /reservations/active.
// Résultat : { ok: true } ou { ok: false, stale: bool } (stale = instantané affiché).
App.loadRooms = async function loadRooms() {
  try {
    const [roomsRes, resaRes] = await Promise.all([
      fetch(`${App.API}/rooms`),
      fetch(`${App.API}/reservations/active`).catch(() => null)
    ]);
    if (!roomsRes.ok) throw new Error(`HTTP ${roomsRes.status}`);
    const data = await roomsRes.json();
    if (!data || !Array.isArray(data.rooms_list)) throw new Error('Réponse inattendue');

    let reservations = [];
    if (resaRes && resaRes.ok) {
      try {
        const r = await resaRes.json();
        if (r && r.success && Array.isArray(r.reservations)) reservations = r.reservations;
      } catch (e) {}
    }

    ingestRooms(data.rooms_list, data.room_schedules, reservations);
    App.data.loadedAt = new Date();
    App.data.stale = false;
    saveSnapshot(data.rooms_list, data.room_schedules, reservations);
    return { ok: true };
  } catch (error) {
    console.warn('Chargement des salles impossible :', error);
    return { ok: false, stale: loadSnapshot() };
  }
};

App.refreshActiveReservations = async function refreshActiveReservations() {
  try {
    const res = await fetch(`${App.API}/reservations/active`);
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.success && Array.isArray(data.reservations)) App.data.reservations = data.reservations;
  } catch (e) {}
};

// -----------------------------------------------------------------------------
// Calculs d'occupation (événements ISO + réservations actives)
// -----------------------------------------------------------------------------

// Occupations du jour de `now`, triées, chacune { start: Date, end: Date, kind: 'cours'|'resa', summary }.
App.busyToday = function busyToday(num, now = new Date()) {
  const dayStart = App.atHour(now, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600e3);
  const out = [];
  (App.data.schedules[num] || []).forEach((e) => {
    const start = new Date(e.start), end = new Date(e.end);
    if (isNaN(start) || isNaN(end) || end <= dayStart || start >= dayEnd) return;
    out.push({ start, end, kind: 'cours', summary: e.summary || '' });
  });
  App.data.reservations.forEach((r) => {
    if (String(r.room_number) !== String(num)) return;
    const start = new Date(r.start_time), end = new Date(r.end_time);
    if (isNaN(start) || isNaN(end) || end <= dayStart || start >= dayEnd) return;
    out.push({ start, end, kind: 'resa', summary: 'Réservée' });
  });
  return out.sort((a, b) => a.start - b.start);
};

// Fusionne les occupations qui se chevauchent ou se touchent.
App.mergeBusy = function mergeBusy(list) {
  const merged = [];
  list.forEach((b) => {
    const last = merged[merged.length - 1];
    if (last && b.start <= last.end) { if (b.end > last.end) last.end = b.end; }
    else merged.push({ start: b.start, end: b.end });
  });
  return merged;
};

// État d'une salle à l'instant `now`.
//  - libre : until = début de la prochaine occupation du jour (null s'il n'y en a plus),
//            freeMin = minutes de liberté (Infinity si plus rien aujourd'hui)
//  - occupé : freeAt = fin du bloc d'occupation en cours (null s'il dure jusqu'à minuit)
App.roomState = function roomState(num, now = new Date()) {
  const busy = App.mergeBusy(App.busyToday(num, now));
  const current = busy.find((b) => b.start <= now && now < b.end);
  if (current) {
    const midnight = App.atHour(now, 24);
    const freeAt = current.end >= midnight ? null : current.end;
    return { status: 'occupé', freeAt, waitMin: freeAt ? (freeAt - now) / 60000 : Infinity, busy };
  }
  const next = busy.find((b) => b.start > now);
  return {
    status: 'libre',
    until: next ? next.start : null,
    freeMin: next ? (next.start - now) / 60000 : Infinity,
    busy
  };
};

// Libellés « jusqu'à 16:00 » / « encore 3 h 56 » / « libre à 13:00 » / « dans 56 min ».
App.stateLabels = function stateLabels(state, now = new Date()) {
  if (state.status === 'libre') {
    if (!state.until) {
      const end = App.atHour(now, App.DAY_END);
      return {
        until: "jusqu'à ce soir",
        rest: 'plus de cours',
        pill: now < end ? App.fmtDur((end - now) / 60000) : 'ce soir'
      };
    }
    return {
      until: `jusqu'à ${App.fmtTime(state.until)}`,
      rest: `encore ${App.fmtDur(state.freeMin)}`,
      pill: App.fmtDur(state.freeMin)
    };
  }
  if (!state.freeAt) return { until: "occupée jusqu'à ce soir", rest: '', pill: '' };
  return {
    until: `libre à ${App.fmtTime(state.freeAt)}`,
    rest: `dans ${App.fmtDur(state.waitMin)}`,
    pill: ''
  };
};

// Segments de la frise 8 h – 20 h : [{ hours, busy }]
App.daySegments = function daySegments(num, now = new Date()) {
  const from = App.atHour(now, App.DAY_START), to = App.atHour(now, App.DAY_END);
  const busy = App.mergeBusy(App.busyToday(num, now))
    .map((b) => ({ start: b.start < from ? from : b.start, end: b.end > to ? to : b.end }))
    .filter((b) => b.end > b.start);
  const segs = [];
  let t = from;
  busy.forEach((b) => {
    if (b.start > t) segs.push({ hours: (b.start - t) / 3600e3, busy: false });
    segs.push({ hours: (b.end - b.start) / 3600e3, busy: true });
    t = b.end;
  });
  if (t < to) segs.push({ hours: (to - t) / 3600e3, busy: false });
  return segs;
};

// Position (en %) d'une heure sur la frise, ou null hors plage.
App.dayPos = function dayPos(date) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h < App.DAY_START || h > App.DAY_END) return null;
  return ((h - App.DAY_START) / (App.DAY_END - App.DAY_START)) * 100;
};

App.friseHTML = function friseHTML(num, now = new Date(), large = false) {
  const segs = App.daySegments(num, now)
    .map((s) => `<span class="seg${s.busy ? ' is-busy' : ''}" style="flex-grow:${s.hours.toFixed(3)}"></span>`)
    .join('');
  const pos = App.dayPos(now);
  const marker = pos === null ? '' : `<span class="now" style="left:${pos.toFixed(2)}%"></span>`;
  return `<div class="frise${large ? ' frise--lg' : ''}" aria-hidden="true">${segs}${marker}</div>`;
};

// -----------------------------------------------------------------------------
// Icônes (SVG en ligne, sans dépendance)
// -----------------------------------------------------------------------------

App.icon = {
  search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.5-4.5"/></svg>',
  sliders: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  chevronRight: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  chevronLeft: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  closeSm: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  star: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  check: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  alert: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8A3E0C" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 7v6M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>',
  noResult: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#55627A" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.5-4.5M8 10.5h5"/></svg>',
  external: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#55627A" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>'
};

// -----------------------------------------------------------------------------
// Session et connexion Google (reprise de l'ancien script.js)
// Clés localStorage inchangées : user, authToken, csrfToken, lastLoginTime
// -----------------------------------------------------------------------------

App.auth = (function () {
  const GOOGLE_CLIENT_ID = '280602510509-ep76jc9na5ae6qbdmcfm7sria30c0acb.apps.googleusercontent.com';
  const SESSION_MAX_AGE = 7 * 24 * 3600e3;

  let user = null, token = null, csrf = null;
  let loginResolve = null;
  let googleReady = false;
  const listeners = new Set();

  const emit = () => listeners.forEach((cb) => { try { cb(user); } catch (e) { console.error(e); } });
  const emailDomain = (u) => (u && u.email ? u.email.split('@')[1] : 'unknown');

  function persist() {
    try {
      localStorage.setItem('user', JSON.stringify(user));
      if (token) localStorage.setItem('authToken', token); else localStorage.removeItem('authToken');
      if (csrf) localStorage.setItem('csrfToken', csrf); else localStorage.removeItem('csrfToken');
    } catch (e) {}
  }

  function identify() {
    if (!user) return;
    if (window.rybbit) { try { window.rybbit.identify(user.email || user.id, { name: user.name, email: user.email }); } catch (e) {} }
    if (window.posthog) {
      try { window.posthog.identify(user.email || user.id, { name: user.name, email: user.email, email_domain: emailDomain(user) }); } catch (e) {}
    }
  }

  function finishLogin(ok) {
    if (loginResolve) { const r = loginResolve; loginResolve = null; r(ok); }
  }

  function setSession(u, t, c) {
    user = u; token = t || null; csrf = c || null;
    persist();
    try { localStorage.setItem('lastLoginTime', Date.now().toString()); } catch (e) {}
    identify();
    emit();
  }

  function clearLocal() {
    ['user', 'authToken', 'csrfToken', 'lastLoginTime'].forEach((k) => { try { localStorage.removeItem(k); } catch (e) {} });
    user = null; token = null; csrf = null;
  }

  async function backendLogin(body) {
    try {
      const res = await fetch(`${App.API}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const result = await res.json();
      return result && result.success ? result : null;
    } catch (e) {
      console.warn('Backend non disponible :', e);
      return null;
    }
  }

  function parseJwt(jwt) {
    const part = jwt.split('.')[1];
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return JSON.parse(new TextDecoder('utf-8').decode(bytes));
  }

  async function handleCredential(response) {
    try {
      const result = await backendLogin({ credential: response.credential });
      if (result) {
        setSession(result.user, result.session_token, result.csrf_token);
        App.track('login_success', { method: 'backend', email_domain: emailDomain(result.user) });
        finishLogin(true);
        return;
      }
      // Repli : connexion locale sans serveur (réservations et favoris indisponibles)
      const info = parseJwt(response.credential);
      setSession({ id: info.sub, name: info.name, email: info.email, picture: info.picture }, null, null);
      App.track('login_success', { method: 'local', email_domain: emailDomain(user) });
      finishLogin(true);
    } catch (error) {
      console.error('Erreur de connexion :', error);
      App.track('login_error');
      finishLogin(false);
    }
  }

  async function oauthFallback() {
    if (!(window.google && google.accounts && google.accounts.oauth2)) { finishLogin(false); return; }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'profile email',
      callback: async (resp) => {
        if (!resp || !resp.access_token) { finishLogin(false); return; }
        try {
          const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${resp.access_token}` } });
          if (!r.ok) throw new Error('profil');
          const info = await r.json();
          const pseudo = btoa(JSON.stringify({ sub: info.id, name: info.name, email: info.email, picture: info.picture }));
          const result = await backendLogin({ credential: pseudo, oauth_token: resp.access_token });
          if (result) setSession(result.user, result.session_token, result.csrf_token);
          else setSession({ id: info.id, name: info.name, email: info.email, picture: info.picture }, null, null);
          finishLogin(true);
        } catch (e) {
          console.error('Erreur OAuth :', e);
          finishLogin(false);
        }
      },
      error_callback: () => finishLogin(false)
    });
    client.requestAccessToken();
  }

  function initGoogle() {
    if (window.google && google.accounts && google.accounts.id) {
      try {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true
        });
        googleReady = true;
      } catch (e) { console.error('Initialisation Google :', e); }
    } else {
      setTimeout(initGoogle, 800);
    }
  }

  // Ouvre la connexion Google. Résout true si l'utilisateur est connecté à la fin.
  function login() {
    return new Promise((resolve) => {
      if (!googleReady || !window.google) {
        App.toast('La connexion Google n\'est pas encore prête. Réessaie dans un instant.');
        resolve(false);
        return;
      }
      loginResolve = resolve;
      google.accounts.id.prompt((n) => {
        if (n.isNotDisplayed() || n.isSkippedMoment()) oauthFallback();
        else if (n.isDismissedMoment() && n.getDismissedReason() !== 'credential_returned') finishLogin(false);
      });
    });
  }

  async function logout() {
    if (token) {
      try {
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
        if (csrf) headers['X-CSRF-Token'] = csrf;
        await fetch(`${App.API}/auth/logout`, { method: 'POST', headers });
      } catch (e) {}
    }
    App.track('logout');
    if (window.rybbit && window.rybbit.clearUserId) { try { window.rybbit.clearUserId(); } catch (e) {} }
    if (window.posthog && window.posthog.reset) { try { window.posthog.reset(); } catch (e) {} }
    clearLocal();
    if (window.google && google.accounts && google.accounts.id) { try { google.accounts.id.disableAutoSelect(); } catch (e) {} }
    emit();
  }

  // Session expirée côté serveur : même traitement que l'ancien code (signOut, donc
  // événement « logout »), pour que les chiffres restent comparables.
  function expire() {
    logout();
  }

  async function restore() {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem('user') || 'null'); } catch (e) {}
    if (!stored) return;
    const last = Number(localStorage.getItem('lastLoginTime') || 0);
    if (last && Date.now() - last >= SESSION_MAX_AGE) { logout(); return; }
    user = stored;
    token = localStorage.getItem('authToken');
    csrf = localStorage.getItem('csrfToken');
    identify();
    emit();
    if (!token) return;
    try {
      const res = await fetch(`${App.API}/auth/verify`, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      const result = await res.json();
      if (result && result.success) { user = result.user; persist(); emit(); }
      else expire();
    } catch (e) {
      // Réseau indisponible : on garde la session locale
    }
  }

  // Requête authentifiée vers l'API. Lève une erreur { expired: true } si la session n'est plus valide.
  async function request(path, { method = 'GET', body } = {}) {
    if (!token) { const err = new Error('Session absente'); err.expired = true; throw err; }
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    if (csrf) headers['X-CSRF-Token'] = csrf;
    const res = await fetch(`${App.API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (res.status === 401) { expire(); const err = new Error('Session expirée'); err.expired = true; throw err; }
    if (!res.ok || !data || data.success === false) {
      const err = new Error((data && data.error) || `Erreur ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function updateUser(patch) {
    if (!user) return;
    user = Object.assign({}, user, patch);
    persist();
    emit();
  }

  return {
    get user() { return user; },
    get loggedIn() { return !!user; },
    get hasServerSession() { return !!(user && token); },
    onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    init() { initGoogle(); return restore(); },
    login, logout, request, updateUser
  };
})();

// -----------------------------------------------------------------------------
// Favoris (stockés côté API, liés au compte)
// -----------------------------------------------------------------------------

App.favorites = {
  list() { const u = App.auth.user; return (u && Array.isArray(u.favorites)) ? u.favorites : []; },
  has(num) { return this.list().includes(String(num)); },
  async toggle(num) {
    num = String(num);
    const adding = !this.has(num);
    const data = await App.auth.request(`/favorites/${encodeURIComponent(num)}`, { method: adding ? 'PUT' : 'DELETE' });
    App.auth.updateUser({ favorites: data.favorites || [] });
    App.track(adding ? 'favorite_added' : 'favorite_removed', { room: num, count: (data.favorites || []).length });
    return adding;
  }
};
