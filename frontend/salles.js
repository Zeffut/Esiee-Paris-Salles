// =============================================================================
// ESIEE Salles — onglet « Salles » : accueil, recherche, filtres, fiche salle
// =============================================================================
'use strict';

(function () {
  const { $, $$, esc, track } = App;

  // ---------------------------------------------------------------------------
  // Filtres
  // ---------------------------------------------------------------------------

  const DEFAULT_FILTERS = { availability: 'free', minFree: 0, epis: [], floors: [], types: [], minPlaces: 0 };
  const EPIS = ['Rue', 'Epis 1', 'Epis 2', 'Epis 3', 'Epis 4', 'Epis 5', 'Epis 6', 'Epis 7'];
  const FLOORS = [['Sous-sol', 'Sous-sol'], ['1er étage', '1er'], ['2ème étage', '2e'], ['3ème étage', '3e'], ['4ème étage', '4e']];
  const TYPES = [['cours', 'Salle de cours'], ['amphi', 'Amphithéâtre']];
  const DURATIONS = [[0, 'Peu importe'], [30, '30 min'], [60, '1 h'], [120, '2 h']];
  const PLACES = [[0, 'Peu importe'], [20, '20 +'], [30, '30 +'], [50, '50 +']];

  const clone = (f) => JSON.parse(JSON.stringify(f));
  let filters = clone(DEFAULT_FILTERS);
  let draft = null; // copie éditée dans la feuille Filtres

  const roomType = (room) => (App.isAmphi(room) ? 'amphi' : 'cours');

  function matches(num, state, f) {
    const room = App.data.rooms[num];
    if (!room) return false;
    if (f.availability === 'free' && state.status !== 'libre') return false;
    if (f.minFree && state.status === 'libre' && state.freeMin < f.minFree) return false;
    if (f.epis.length && !f.epis.includes(room.epis)) return false;
    if (f.floors.length && !f.floors.includes(room.floor)) return false;
    if (f.types.length && !f.types.includes(roomType(room))) return false;
    if (f.minPlaces && !(Number(room.capacity) >= f.minPlaces)) return false;
    return true;
  }

  // Tri : libres d'abord (les plus longtemps libres en tête), puis occupées (les plus tôt libérées).
  function byAvailability(a, b) {
    if (a.state.status !== b.state.status) return a.state.status === 'libre' ? -1 : 1;
    if (a.state.status === 'libre') {
      if (a.state.freeMin !== b.state.freeMin) return b.state.freeMin - a.state.freeMin;
    } else if (a.state.waitMin !== b.state.waitMin) return a.state.waitMin - b.state.waitMin;
    return a.num.padStart(4, '0').localeCompare(b.num.padStart(4, '0'));
  }

  function compute(f, now = new Date()) {
    return App.data.numbers
      .map((num) => ({ num, room: App.data.rooms[num], state: App.roomState(num, now) }))
      .filter((it) => matches(it.num, it.state, f))
      .sort(byAvailability);
  }

  // Propriétés de filter_applied : mêmes clés et vocabulaire qu'avant (status, type, epis, floors),
  // complétées par les nouveaux critères.
  function filterProps(f, source) {
    const props = {
      status: f.availability === 'free' ? 'libre' : 'libre,occupé',
      type: (f.types.length ? f.types : ['cours', 'amphi']).map((t) => (t === 'amphi' ? 'Amphithéâtre' : 'Salle classique')).join(','),
      epis: (f.epis.length ? f.epis : EPIS).join(','),
      floors: (f.floors.length ? f.floors : FLOORS.map((x) => x[0])).join(','),
      min_free_minutes: f.minFree,
      min_places: f.minPlaces,
      source
    };
    return props;
  }

  // Pastilles rapides de l'accueil (maquette : « 1 h et + », « Rue », « Épi 1 », « Amphis »).
  const QUICK = [
    { key: 'min60', label: '1 h et +', on: (f) => f.minFree === 60, toggle: (f) => { f.minFree = f.minFree === 60 ? 0 : 60; } },
    { key: 'rue', label: 'Rue', on: (f) => f.epis.includes('Rue'), toggle: (f) => toggleIn(f.epis, 'Rue') },
    { key: 'epi1', label: 'Épi 1', on: (f) => f.epis.includes('Epis 1'), toggle: (f) => toggleIn(f.epis, 'Epis 1') },
    { key: 'amphi', label: 'Amphis', on: (f) => f.types.length === 1 && f.types[0] === 'amphi', toggle: (f) => { f.types = f.types.length === 1 && f.types[0] === 'amphi' ? [] : ['amphi']; } }
  ];

  function toggleIn(list, value) {
    const i = list.indexOf(value);
    if (i >= 0) list.splice(i, 1); else list.push(value);
  }

  // Critères actifs qui ne sont pas couverts par une pastille rapide → pastilles retirables.
  function activeExtras(f) {
    const out = [];
    if (f.availability === 'all') out.push({ label: 'Toutes les salles', remove: (x) => { x.availability = 'free'; } });
    if (f.minFree && f.minFree !== 60) out.push({ label: `${App.fmtDur(f.minFree)} et +`, remove: (x) => { x.minFree = 0; } });
    f.epis.filter((e) => e !== 'Rue' && e !== 'Epis 1').forEach((e) => out.push({ label: App.episLabel(e), remove: (x) => toggleIn(x.epis, e) }));
    f.floors.forEach((fl) => out.push({ label: App.floorLabel(fl), remove: (x) => toggleIn(x.floors, fl) }));
    if (f.types.length === 1 && f.types[0] === 'cours') out.push({ label: 'Salles de cours', remove: (x) => { x.types = []; } });
    if (f.minPlaces) out.push({ label: `${f.minPlaces} places et +`, remove: (x) => { x.minPlaces = 0; } });
    return out;
  }

  function activeCount(f) {
    return activeExtras(f).length + QUICK.filter((q) => q.on(f)).length;
  }

  function applyFilters(next, source) {
    filters = next;
    const props = filterProps(filters, source);
    if (activeCount(filters) === 0) track('filter_reset', { source });
    else track('filter_applied', props);
    renderHome();
  }

  // ---------------------------------------------------------------------------
  // Accueil
  // ---------------------------------------------------------------------------

  const homeContent = $('#homeContent');
  const chipRow = $('#chipRow');
  let loadState = 'loading'; // loading | ok | stale | error

  function renderChips() {
    const count = activeCount(filters);
    const extras = activeExtras(filters);
    const html = [
      `<button type="button" class="chip" id="openFilters" aria-haspopup="dialog">${App.icon.sliders}Filtres${count ? ` · ${count}` : ''}</button>`,
      ...extras.map((x, i) => `<button type="button" class="chip chip--active chip--removable" data-extra="${i}" aria-label="Retirer le filtre ${esc(x.label)}">${esc(x.label)}${App.icon.closeSm}</button>`),
      ...QUICK.map((q) => `<button type="button" class="chip" data-quick="${q.key}" aria-pressed="${q.on(filters)}">${esc(q.label)}</button>`)
    ];
    chipRow.innerHTML = html.join('');
    $('#openFilters').addEventListener('click', openFilterSheet);
    $$('[data-quick]', chipRow).forEach((btn) => btn.addEventListener('click', () => {
      const next = clone(filters);
      QUICK.find((q) => q.key === btn.dataset.quick).toggle(next);
      applyFilters(next, 'chip');
    }));
    $$('[data-extra]', chipRow).forEach((btn) => btn.addEventListener('click', () => {
      const next = clone(filters);
      activeExtras(next)[Number(btn.dataset.extra)].remove(next);
      applyFilters(next, 'chip');
    }));
  }

  function heroHTML(it, now) {
    const lbl = App.stateLabels(it.state, now);
    const start = App.dayPos(now);
    const endDate = it.state.until || App.atHour(now, App.DAY_END);
    const end = App.dayPos(endDate);
    let bar = '';
    if (start !== null) {
      const w = Math.max(2, (end === null ? 100 : end) - start);
      bar = `<div class="hero-bar" aria-hidden="true"><span style="left:${start.toFixed(1)}%;width:${w.toFixed(1)}%"></span></div>`;
    }
    return `
      <a class="hero" href="#salle/${esc(it.num)}" data-room="${esc(it.num)}" data-source="home_hero">
        <div class="hero-top">
          <div style="display:flex;flex-direction:column;gap:2px;min-width:0">
            <span class="hero-kicker">Libre le plus longtemps</span>
            <span class="hero-num">Salle ${esc(it.num)}</span>
            <span class="hero-meta">${esc(App.roomMeta(it.room))}</span>
          </div>
          <span class="hero-pill">${esc(lbl.pill)}</span>
        </div>
        ${bar}
        <div class="hero-foot">
          <span>${esc(lbl.until.charAt(0).toUpperCase() + lbl.until.slice(1))}</span>
          <span>Voir la salle ${App.icon.chevronRight}</span>
        </div>
      </a>`;
  }

  function roomCardHTML(it, now, { frise = true, source = 'home_list', stale = false } = {}) {
    const lbl = App.stateLabels(it.state, now);
    const free = it.state.status === 'libre';
    const untilClass = stale ? 'room-until room-until--stale' : `room-until${free ? '' : ' room-until--busy'}`;
    return `
      <li>
        <a class="room-card${stale ? ' room-card--stale' : ''}" href="#salle/${esc(it.num)}" data-room="${esc(it.num)}" data-source="${source}">
          <div class="room-card-row">
            <div class="room-card-col">
              <span class="room-num">Salle ${esc(it.num)}</span>
              <span class="room-meta">${esc(App.roomMeta(it.room))}</span>
            </div>
            <div class="room-card-col room-card-col--end">
              <span class="${untilClass}">${esc(lbl.until)}</span>
              ${lbl.rest && !stale ? `<span class="room-meta">${esc(lbl.rest)}</span>` : ''}
            </div>
          </div>
          ${frise ? App.friseHTML(it.num, now) : ''}
        </a>
      </li>`;
  }

  function emptyDescription(f) {
    const amphiOnly = f.types.length === 1 && f.types[0] === 'amphi';
    const coursOnly = f.types.length === 1 && f.types[0] === 'cours';
    let s = amphiOnly ? 'Aucun amphi' : coursOnly ? 'Aucune salle de cours' : 'Aucune salle';
    if (f.epis.length === 1) s += f.epis[0] === 'Rue' ? ' de la Rue' : ` de l'${App.episLabel(f.epis[0]).toLowerCase()}`;
    else if (f.epis.length > 1) s += ' de ces bâtiments';
    if (f.floors.length === 1) s += f.floors[0] === 'Sous-sol' ? ' au sous-sol' : ` au ${App.floorLabel(f.floors[0])}`;
    else if (f.floors.length > 1) s += ' à ces étages';
    if (f.minPlaces) s += ` de ${f.minPlaces} places et +`;
    if (f.availability === 'free') {
      s += f.minFree ? ` n'est libre ${App.fmtDur(f.minFree)} d'affilée en ce moment.` : " n'est libre en ce moment.";
    } else s += ' ne correspond à ces critères.';
    return s;
  }

  // Suggestions « Essaie plutôt » : on relâche un critère à la fois et on compte.
  function suggestions(f, now) {
    const out = [];
    const tryOne = (label, mutate) => {
      const next = clone(f); mutate(next);
      const n = compute(next, now).length;
      if (n > 0) out.push({ label, n, next });
    };
    if (f.minFree) {
      const lower = DURATIONS.map((d) => d[0]).filter((m) => m < f.minFree).pop();
      tryOne(lower ? `Libre ${App.fmtDur(lower)} et +` : 'Libre, peu importe la durée', (x) => { x.minFree = lower || 0; });
    }
    if (f.epis.length) tryOne('Tous les épis', (x) => { x.epis = []; });
    if (f.floors.length) tryOne('Tous les étages', (x) => { x.floors = []; });
    if (f.types.length) tryOne('Tous les types de salle', (x) => { x.types = []; });
    if (f.minPlaces) tryOne('Peu importe les places', (x) => { x.minPlaces = 0; });
    if (f.availability === 'free') tryOne('Voir aussi les salles occupées', (x) => { x.availability = 'all'; });
    return out.slice(0, 3);
  }

  function emptyHTML(f, now) {
    const sugg = suggestions(f, now);
    const hasFilters = activeCount(f) > 0;
    return `
      <section class="empty">
        <span class="empty-icon" aria-hidden="true">${App.icon.noResult}</span>
        <h2>Aucune salle ne correspond</h2>
        <p>${esc(emptyDescription(f))}</p>
      </section>
      ${(sugg.length || hasFilters) ? `
      <section class="suggest">
        ${sugg.length ? '<span class="suggest-label">Essaie plutôt</span>' : ''}
        ${sugg.map((s, i) => `<button type="button" class="suggest-btn" data-sugg="${i}"><span>${esc(s.label)}</span><span>${s.n} salle${s.n > 1 ? 's' : ''}</span></button>`).join('')}
        ${hasFilters ? '<button type="button" class="text-btn" data-clear-filters>Effacer tous les filtres</button>' : ''}
      </section>` : ''}`;
  }

  function errorCardHTML() {
    const at = App.data.loadedAt;
    const text = App.data.stale && at
      ? `L'emploi du temps de l'ESIEE ne répond pas. Voici les dernières données reçues, à ${App.fmtTime(at)}.`
      : "L'emploi du temps de l'ESIEE ne répond pas. Réessaie dans un instant.";
    return `
      <section class="alert-card" role="alert">
        <div class="alert-card-row">
          <span class="alert-icon" aria-hidden="true">${App.icon.alert}</span>
          <div>
            <h2>Horaires indisponibles</h2>
            <p>${esc(text)}</p>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-md" id="retryLoad">Réessayer</button>
      </section>`;
  }

  let lastSugg = [];

  function renderHome() {
    const now = new Date();
    $('#nowLabel').textContent = App.fmtHeaderDate(now);
    renderChips();
    if (loadState === 'loading') return;

    if (loadState === 'error') {
      homeContent.innerHTML = errorCardHTML();
      return;
    }

    const items = compute(filters, now);
    const stale = loadState === 'stale';
    let html = stale ? errorCardHTML() : '';

    if (!items.length) {
      lastSugg = suggestions(filters, now);
      html += emptyHTML(filters, now);
      homeContent.innerHTML = html;
      return;
    }

    if (stale) {
      // Données de secours : liste sobre, sans carte mise en avant ni frise.
      html += `
        <div class="list-head"><h2>Libres maintenant</h2><span>à vérifier sur place</span></div>
        <ul class="stack">${items.map((it) => roomCardHTML(it, now, { frise: false, stale: true })).join('')}</ul>`;
      homeContent.innerHTML = html;
      return;
    }

    const hero = items.find((it) => it.state.status === 'libre');
    const rest = items.filter((it) => it !== hero);
    const title = filters.availability === 'free' ? 'Libres maintenant' : 'Toutes les salles';
    html += hero ? heroHTML(hero, now) : '';
    html += `
      <div class="list-head"><h2>${title}</h2><span>${items.length} salle${items.length > 1 ? 's' : ''}</span></div>
      <ul class="stack">${rest.map((it) => roomCardHTML(it, now)).join('')}</ul>`;
    homeContent.innerHTML = html;
  }

  homeContent.addEventListener('click', (e) => {
    const sugg = e.target.closest('[data-sugg]');
    if (sugg) { applyFilters(lastSugg[Number(sugg.dataset.sugg)].next, 'suggestion'); return; }
    if (e.target.closest('[data-clear-filters]')) { applyFilters(clone(DEFAULT_FILTERS), 'empty_state'); return; }
    if (e.target.closest('#retryLoad')) { load(true); }
  });

  // ---------------------------------------------------------------------------
  // Feuille Filtres
  // ---------------------------------------------------------------------------

  const filterSheet = $('#filterSheet');
  const filterGroups = $('#filterGroups');
  const filterApply = $('#filterApply');

  function choiceHTML(group, value, label, on) {
    return `<button type="button" class="choice" data-group="${group}" data-value="${esc(String(value))}" aria-pressed="${on}">${esc(label)}</button>`;
  }

  function renderFilterSheet() {
    const f = draft;
    const groups = [
      ['Disponibilité', [['free', 'Libres maintenant'], ['all', 'Toutes les salles']].map(([v, l]) => choiceHTML('availability', v, l, f.availability === v))],
      ['Libre pendant au moins', DURATIONS.map(([v, l]) => choiceHTML('minFree', v, l, f.minFree === v))],
      ['Bâtiment', EPIS.map((v) => choiceHTML('epis', v, App.episLabel(v), f.epis.includes(v)))],
      ['Étage', FLOORS.map(([v, l]) => choiceHTML('floors', v, l, f.floors.includes(v)))],
      ['Type', TYPES.map(([v, l]) => choiceHTML('types', v, l, f.types.includes(v)))],
      ['Places', PLACES.map(([v, l]) => choiceHTML('minPlaces', v, l, f.minPlaces === v))]
    ];
    filterGroups.innerHTML = groups.map(([legend, chips]) => `
      <fieldset class="filter-group">
        <legend>${legend}</legend>
        <div class="chips chips--wrap">${chips.join('')}</div>
      </fieldset>`).join('');
    const n = compute(f).length;
    filterApply.textContent = n ? `Voir ${n} salle${n > 1 ? 's' : ''}` : 'Aucune salle';
    filterApply.disabled = n === 0 && loadState !== 'loading';
  }

  filterGroups.addEventListener('click', (e) => {
    const btn = e.target.closest('.choice');
    if (!btn) return;
    const { group, value } = btn.dataset;
    if (group === 'availability') draft.availability = value;
    else if (group === 'minFree' || group === 'minPlaces') draft[group] = Number(value);
    else toggleIn(draft[group], value);
    renderFilterSheet();
  });

  function openFilterSheet() {
    draft = clone(filters);
    renderFilterSheet();
    filterSheet.showModal();
  }

  $('#filterClose').addEventListener('click', () => filterSheet.close());
  filterSheet.addEventListener('click', (e) => { if (e.target === filterSheet) filterSheet.close(); });
  $('#filterReset').addEventListener('click', () => { draft = clone(DEFAULT_FILTERS); renderFilterSheet(); });
  filterApply.addEventListener('click', () => {
    filterSheet.close();
    applyFilters(draft, 'sheet');
  });

  // ---------------------------------------------------------------------------
  // Recherche
  // ---------------------------------------------------------------------------

  const searchInput = $('#searchInput');
  const searchResults = $('#searchResults');
  const searchSummary = $('#searchSummary');
  const RECENT_KEY = 'recentSearches';

  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  function haystack(room) {
    return norm([
      room.number, `salle ${room.number}`, App.episLabel(room.epis), room.epis,
      App.floorLabel(room.floor), room.floor, room.type, App.isAmphi(room) ? 'amphi amphitheatre' : 'salle de cours',
      room.board, room.name, room.capacity ? `${room.capacity} places` : ''
    ].join(' | '));
  }

  function runSearch() {
    const raw = searchInput.value.trim();
    const q = norm(raw);
    $('#searchClear').hidden = !raw;
    if (!q) {
      searchSummary.hidden = true;
      searchResults.innerHTML = '';
      renderRecents();
      return;
    }
    const now = new Date();
    const items = App.data.numbers
      .filter((num) => haystack(App.data.rooms[num]).includes(q))
      .map((num) => ({ num, room: App.data.rooms[num], state: App.roomState(num, now) }))
      .sort(byAvailability);

    searchSummary.hidden = false;
    searchSummary.textContent = items.length === 0
      ? `Aucune salle ne contient « ${raw} »`
      : `${items.length} salle${items.length > 1 ? 's contiennent' : ' contient'} « ${raw} »`;

    searchResults.innerHTML = items.map((it) => {
      const free = it.state.status === 'libre';
      const lbl = App.stateLabels(it.state, now);
      return `
        <li>
          <a class="room-card" href="#salle/${esc(it.num)}" data-room="${esc(it.num)}" data-source="search">
            <div class="room-card-row">
              <div class="room-card-col">
                <span class="room-num">Salle ${esc(it.num)}</span>
                <span class="room-meta">${esc(App.roomMeta(it.room))}</span>
              </div>
              <div class="room-card-col room-card-col--end">
                <span class="pill${free ? '' : ' pill--busy'}">${free ? 'Libre' : 'Occupée'}</span>
                <span class="room-meta">${esc(lbl.until)}</span>
              </div>
            </div>
          </a>
        </li>`;
    }).join('');
    renderRecents();
  }

  const trackSearch = App.debounce(() => {
    const term = searchInput.value.trim();
    if (term.length > 0) track('search_performed', { term_length: term.length });
  }, 500);

  searchInput.addEventListener('input', () => { runSearch(); trackSearch(); });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveRecent(searchInput.value); searchInput.blur(); }
  });
  $('#searchClear').addEventListener('click', () => { searchInput.value = ''; runSearch(); searchInput.focus(); });
  $('#searchCancel').addEventListener('click', () => { searchInput.value = ''; runSearch(); goBack(); });

  function saveRecent(term) {
    term = String(term || '').trim();
    if (!term) return;
    const list = App.storage.get(RECENT_KEY, []).filter((t) => norm(t) !== norm(term));
    list.unshift(term);
    App.storage.set(RECENT_KEY, list.slice(0, 5));
  }

  function renderRecents() {
    const list = App.storage.get(RECENT_KEY, []);
    $('#recentSection').hidden = !list.length;
    $('#recentChips').innerHTML = list.map((t) => `<button type="button" class="chip chip--ghost" data-recent="${esc(t)}">${esc(t)}</button>`).join('');
  }

  $('#recentChips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-recent]');
    if (!btn) return;
    searchInput.value = btn.dataset.recent;
    runSearch();
    trackSearch();
  });

  searchResults.addEventListener('click', (e) => {
    if (e.target.closest('[data-room]')) saveRecent(searchInput.value);
  });

  $('#openSearch').addEventListener('click', () => { location.hash = 'recherche'; });

  // ---------------------------------------------------------------------------
  // Fiche salle
  // ---------------------------------------------------------------------------

  const viewRoom = $('#viewRoom');
  let currentRoom = null;
  let roomBackLabel = 'Salles';

  function slotsHTML(num, now) {
    const from = App.atHour(now, App.DAY_START), to = App.atHour(now, App.DAY_END);
    const busy = App.busyToday(num, now).filter((b) => b.end > from && b.start < to);
    const rows = [];
    let t = from;
    const push = (start, end, label, isBusy) => {
      const isNow = start <= now && now < end;
      rows.push({ start, end, isBusy, isNow, label: !isBusy && isNow ? 'Libre · maintenant' : label });
    };
    busy.forEach((b) => {
      const s = b.start < from ? from : b.start;
      const e = b.end > to ? to : b.end;
      if (s > t) push(t, s, 'Libre', false);
      if (e > t) push(s < t ? t : s, e, b.kind === 'resa' ? 'Réservée' : 'Cours', true);
      if (e > t) t = e;
    });
    if (t < to) push(t, to, 'Libre', false);
    return rows.map((r) => `
      <li class="slot${r.isNow ? ' is-now' : ''}"${r.isNow ? ' aria-current="time"' : ''}>
        <span class="slot-time">${App.fmtTime(r.start)} – ${App.fmtTime(r.end)}</span>
        <span class="slot-tag${r.isBusy ? ' is-busy' : ''}">${esc(r.label)}</span>
      </li>`).join('');
  }

  function renderRoom() {
    const num = currentRoom;
    const room = App.data.rooms[num];
    if (!room) {
      viewRoom.innerHTML = `
        <div class="room-head"><button type="button" class="back-btn" data-back>${App.icon.chevronLeft}${esc(roomBackLabel)}</button></div>
        <section class="empty"><h2>Salle introuvable</h2><p>La salle ${esc(num)} n'apparaît pas dans l'emploi du temps.</p></section>`;
      return;
    }
    const now = new Date();
    const state = App.roomState(num, now);
    const lbl = App.stateLabels(state, now);
    const free = state.status === 'libre';
    viewRoom.innerHTML = `
      <header class="room-head">
        <button type="button" class="back-btn" data-back>${App.icon.chevronLeft}${esc(roomBackLabel)}</button>
      </header>
      <section class="room-title">
        <p>${esc(App.roomMeta(room, { places: !free }))}</p>
        <h1 id="roomTitle">Salle ${esc(num)}</h1>
      </section>
      <section class="status-card">
        <div class="status-line">
          <span class="pill${free ? '' : ' pill--busy'}">${free ? 'Libre' : 'Occupée'}</span>
          <strong>${esc(lbl.until)}</strong>
          ${lbl.rest ? `<span class="status-rest">${esc(lbl.rest)}</span>` : ''}
        </div>
      </section>
      <section class="section" style="margin-top:18px">
        <h2 class="day-head">Aujourd'hui</h2>
        <ol class="slots">${slotsHTML(num, now)}</ol>
      </section>`;
  }

  viewRoom.addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) goBack();
  });

  // ---------------------------------------------------------------------------
  // Navigation entre vues (hash : #recherche, #salle/1201)
  // ---------------------------------------------------------------------------

  let navDepth = 0;          // nombre d'entrées d'historique créées dans l'app
  let homeScroll = 0;
  let pendingSource = null;  // provenance du clic pour room_viewed
  let currentView = 'home';
  let trackedRoom = null;    // évite de compter deux fois la même ouverture

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-room]');
    if (link) pendingSource = link.dataset.source || null;
  });

  function goBack() {
    if (navDepth > 0) history.back();
    else location.hash = '';
  }

  function show(view) {
    if (currentView === 'home' && view !== 'home') homeScroll = window.scrollY;
    $('#viewHome').hidden = view !== 'home';
    $('#viewSearch').hidden = view !== 'search';
    viewRoom.hidden = view !== 'room';
    const prev = currentView;
    currentView = view;
    if (view === 'home') { renderHome(); window.scrollTo(0, homeScroll); }
    else if (view === 'search') {
      window.scrollTo(0, 0);
      runSearch();
      if (prev !== 'room') setTimeout(() => searchInput.focus(), 0);
    } else window.scrollTo(0, 0);
  }

  function route(fromUser) {
    const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
    const m = hash.match(/^salle\/([0-9A-Za-z-]+)$/);
    if (m) {
      const prev = currentView;
      roomBackLabel = prev === 'search' ? 'Recherche' : prev === 'room' ? roomBackLabel : 'Salles';
      if (currentRoom !== m[1]) trackedRoom = null;
      currentRoom = m[1];
      show('room');
      if (loadState !== 'loading') {
        renderRoom();
        viewRoomTracked(fromUser);
      } else {
        viewRoom.innerHTML = '<p class="loading-label" role="status">Lecture des emplois du temps…</p>';
      }
    } else if (hash === 'recherche') {
      trackedRoom = null;
      show('search');
    } else {
      trackedRoom = null;
      currentRoom = null;
      show('home');
    }
  }

  function viewRoomTracked(fromUser) {
    if (!currentRoom || trackedRoom === currentRoom) return;
    trackedRoom = currentRoom;
    const state = App.roomState(currentRoom);
    track('room_viewed', {
      room: currentRoom,
      status: state.status,
      building: App.roomEpis(currentRoom),
      floor: App.roomFloor(currentRoom),
      source: pendingSource || (fromUser ? 'link' : 'deeplink')
    });
    pendingSource = null;
  }

  // Profondeur approximative : accueil (0) < recherche (1) < fiche (2).
  // Elle sert à savoir si « retour » peut s'appuyer sur l'historique du navigateur.
  const depthOf = (url) => (url.includes('#salle/') ? 2 : url.includes('#recherche') ? 1 : 0);
  window.addEventListener('hashchange', (e) => {
    const before = depthOf(e.oldURL || ''), after = depthOf(location.href);
    if (after > before) navDepth++;
    else if (after < before) navDepth = Math.max(0, navDepth - 1);
    route(true);
  });

  // ---------------------------------------------------------------------------
  // Chargement et rafraîchissement
  // ---------------------------------------------------------------------------

  async function load(isRetry) {
    if (isRetry) {
      track('rooms_retry');
      const btn = $('#retryLoad');
      if (btn) { btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Nouvelle tentative…'; }
    }
    const res = await App.loadRooms();
    loadState = res.ok ? 'ok' : res.stale ? 'stale' : 'error';
    if (currentView === 'home') renderHome();
    else if (currentView === 'search') runSearch();
    else if (currentView === 'room') { renderRoom(); viewRoomTracked(false); }
  }

  // Statuts recalculés toutes les 30 s (sans requête réseau).
  setInterval(() => {
    if (document.hidden || loadState === 'loading') return;
    if (currentView === 'home' && !filterSheet.open) renderHome();
    else if (currentView === 'room') renderRoom();
  }, 30000);

  // Données rechargées au retour sur l'onglet si elles ont plus de 10 minutes.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !App.data.loadedAt) return;
    if (Date.now() - App.data.loadedAt.getTime() > 10 * 60e3 || loadState !== 'ok') load(false);
  });

  // ---------------------------------------------------------------------------
  // Démarrage
  // ---------------------------------------------------------------------------

  renderChips();
  $('#nowLabel').textContent = App.fmtHeaderDate(new Date());
  if (location.hash.includes('salle/')) pendingSource = 'deeplink';
  route(false);
  load(false);
})();
