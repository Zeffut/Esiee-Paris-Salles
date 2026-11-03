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
    App.setHTML(chipRow, html.join(''));
  }

  // Écouteur unique (délégation) : les pastilles sont re-rendues sans se réabonner.
  chipRow.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.id === 'openFilters') { openFilterSheet(); return; }
    const next = clone(filters);
    if (btn.dataset.quick) QUICK.find((q) => q.key === btn.dataset.quick).toggle(next);
    else if (btn.dataset.extra !== undefined) activeExtras(next)[Number(btn.dataset.extra)].remove(next);
    else return;
    applyFilters(next, 'chip');
  });

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
      App.setHTML(homeContent, errorCardHTML());
      return;
    }

    const items = compute(filters, now);
    const stale = loadState === 'stale';
    let html = stale ? errorCardHTML() : '';

    if (!items.length) {
      lastSugg = suggestions(filters, now);
      html += emptyHTML(filters, now);
      App.setHTML(homeContent, html);
      return;
    }

    if (stale) {
      // Données de secours : liste sobre, sans carte mise en avant ni frise.
      html += `
        <div class="list-head"><h2>Libres maintenant</h2><span>à vérifier sur place</span></div>
        <ul class="stack">${items.map((it) => roomCardHTML(it, now, { frise: false, stale: true })).join('')}</ul>`;
      App.setHTML(homeContent, html);
      return;
    }

    const hero = items.find((it) => it.state.status === 'libre');
    const rest = items.filter((it) => it !== hero);
    const title = filters.availability === 'free' ? 'Libres maintenant' : 'Toutes les salles';
    html += hero ? heroHTML(hero, now) : '';
    html += `
      <div class="list-head"><h2>${title}</h2><span>${items.length} salle${items.length > 1 ? 's' : ''}</span></div>
      <ul class="stack">${rest.map((it) => roomCardHTML(it, now)).join('')}</ul>`;
    App.setHTML(homeContent, html);
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

  function boardLabel(board) {
    const b = String(board || '').replace(/^tableau\s+/i, '').trim();
    return b ? b.charAt(0).toUpperCase() + b.slice(1) : '—';
  }

  function starHTML(num) {
    const on = App.favorites.has(num);
    return `<button type="button" class="round-btn" data-fav aria-pressed="${on}" aria-label="${on ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${App.icon.star}</button>`;
  }

  function sameEpiHTML(num, room, now) {
    const others = App.data.numbers
      .filter((n) => n !== num && App.data.rooms[n].epis === room.epis)
      .map((n) => ({ num: n, room: App.data.rooms[n], state: App.roomState(n, now) }))
      .filter((it) => it.state.status === 'libre')
      .sort(byAvailability)
      .slice(0, 3);
    const where = room.epis === 'Rue' ? 'même bâtiment' : 'même épi';
    if (!others.length) {
      return `
        <section class="section" style="margin-top:22px">
          <h2 class="day-head">Libres maintenant, ${where}</h2>
          <p class="room-meta" style="font-size:15px">Aucune autre salle n'est libre ici pour l'instant.</p>
          <a class="text-btn" href="#" data-home style="align-self:flex-start;padding:4px 0">Voir toutes les salles libres</a>
        </section>`;
    }
    return `
      <section class="section" style="margin-top:22px">
        <h2 class="day-head">Libres maintenant, ${where}</h2>
        <ul style="display:flex;flex-direction:column;gap:8px">
          ${others.map((it) => `
            <li>
              <a class="room-card" href="#salle/${esc(it.num)}" data-room="${esc(it.num)}" data-source="same_epi">
                <div class="room-card-row">
                  <div class="room-card-col">
                    <span class="room-num room-num--sm">Salle ${esc(it.num)}</span>
                    <span class="room-meta">${esc(App.roomMeta(it.room, { epi: false }))}</span>
                  </div>
                  <span class="room-until">${esc(App.stateLabels(it.state, now).until)}</span>
                </div>
              </a>
            </li>`).join('')}
        </ul>
      </section>`;
  }

  function renderRoom() {
    const num = currentRoom;
    const room = App.data.rooms[num];
    if (!room && loadState === 'error') {
      App.setHTML(viewRoom, `
        <div class="room-head"><button type="button" class="back-btn" data-back>${App.icon.chevronLeft}${esc(roomBackLabel)}</button></div>
        ${errorCardHTML()}`);
      return;
    }
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
    const scale = [8, 11, 14, 17, 20].map((h) => `<span>${h}h</span>`).join('');

    const facts = free ? `
      <dl class="facts">
        <div class="fact"><dt>places</dt><dd class="fact-big">${esc(room.capacity || '—')}</dd></div>
        <div class="fact"><dt>tableau</dt><dd>${esc(boardLabel(room.board))}</dd></div>
        <div class="fact"><dt>type</dt><dd>${App.isAmphi(room) ? 'Amphi' : 'Salle de cours'}</dd></div>
      </dl>` : '';

    const below = free ? `
      <section class="section" style="margin-top:18px">
        <h2 class="day-head">Aujourd'hui</h2>
        <ol class="slots">${slotsHTML(num, now)}</ol>
      </section>` : sameEpiHTML(num, room, now);

    App.setHTML(viewRoom, `
      <header class="room-head">
        <button type="button" class="back-btn" data-back>${App.icon.chevronLeft}${esc(roomBackLabel)}</button>
        ${starHTML(num)}
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
        ${App.friseHTML(num, now, true)}
        <div class="frise-scale" aria-hidden="true">${scale}</div>
      </section>
      ${facts}
      ${below}
      ${reserveCtaHTML(num, free, now)}`);
  }

  async function onFavoriteClick(btn) {
    const num = currentRoom;
    if (!App.auth.hasServerSession) {
      const ok = await requireLogin('favorites');
      if (!ok || !App.auth.hasServerSession) return;
    }
    btn.setAttribute('aria-busy', 'true');
    try {
      const added = await App.favorites.toggle(num);
      App.toast(added ? `Salle ${num} ajoutée aux favoris` : `Salle ${num} retirée des favoris`);
    } catch (err) {
      if (err.expired) App.toast('Session expirée. Reconnecte-toi.');
      else if (err.status === 404) App.toast('Les favoris ne sont pas encore disponibles.');
      else App.toast('Impossible de mettre à jour les favoris.');
    }
    if (currentView === 'room' && currentRoom === num) renderRoom();
  }

  viewRoom.addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) { goBack(); return; }
    if (e.target.closest('#retryLoad')) { load(true); return; }
    if (e.target.closest('[data-home]')) { e.preventDefault(); location.hash = ''; return; }
    const fav = e.target.closest('[data-fav]');
    if (fav) { onFavoriteClick(fav); return; }
    if (e.target.closest('[data-reserve]')) startReservation(currentRoom);
  });

  // ---------------------------------------------------------------------------
  // Réservation (créneaux d'une heure, jusqu'à 2 h à l'avance — règle de l'API)
  // ---------------------------------------------------------------------------

  const reserveSheet = $('#reserveSheet');
  const viewConfirm = $('#viewConfirm');
  let reserveRoom = null;
  let lastReservation = null;

  // Créneaux : heure en cours + 3 suivantes. Réservable si le début est à moins de 2 h
  // et qu'aucun cours ni aucune réservation ne chevauche le créneau.
  function reserveSlots(num, now = new Date()) {
    const busy = App.busyToday(num, now);
    const h = now.getHours();
    const out = [];
    for (let k = 0; k < 4; k++) {
      const start = App.atHour(now, h + k);
      const end = App.atHour(now, h + k + 1);
      // L'API reçoit une seule date pour le début et la fin : un créneau qui finit
      // à minuit (23:00 – 00:00) serait refusé, on s'arrête donc à 22:00 – 23:00.
      if (!App.sameDay(start, now) || !App.sameDay(end, now)) break;
      // Pour le créneau en cours, seul ce qui reste compte (un cours fini à 10:30 ne bloque pas 10:45 – 11:00).
      const from = k === 0 && now > start ? now : start;
      const clash = busy.find((b) => b.start < end && b.end > from);
      const tooEarly = start - now > 2 * 3600e3;
      out.push({ start, end, current: k === 0, clash, tooEarly, ok: !clash && !tooEarly });
    }
    return out;
  }

  function reserveCtaHTML(num, free, now) {
    const first = reserveSlots(num, now).find((s) => s.ok);
    if (!first) return '';
    const label = free ? 'Réserver un créneau' : `Réserver à partir de ${App.fmtTime(first.start)}`;
    return `<div class="cta-bar"><button type="button" class="btn ${free ? 'btn-primary' : 'btn-outline'}" data-reserve>${esc(label)}</button></div>`;
  }

  const slotRange = (s) => `${App.fmtTime(s.start)} – ${App.fmtTime(s.end)}`;
  const slotValue = (s) => `${App.fmtTime(s.start)}-${App.fmtTime(s.end)}`; // format d'origine de time_slot

  function slotHint(s, now) {
    if (s.clash) return s.clash.kind === 'resa' ? 'Déjà réservée' : 'Occupée · cours';
    if (s.tooEarly) return `Réservable à partir de ${App.fmtTime(new Date(s.start.getTime() - 2 * 3600e3))}`;
    if (s.current) return `En cours · il reste ${App.fmtDur((s.end - now) / 60000)}`;
    return `Dans ${App.fmtDur((s.start - now) / 60000)}`;
  }

  function myActiveReservation(now = new Date()) {
    const hist = App.auth.user?.reservations?.history || [];
    return hist.find((r) => (r.status === 'active' || r.status === 'upcoming') && new Date(r.end_time) > now);
  }

  function renderReserveSheet() {
    const now = new Date();
    const room = App.data.rooms[reserveRoom];
    const slots = reserveSlots(reserveRoom, now);
    $('#reserveTitle').textContent = `Réserver la salle ${reserveRoom}`;
    $('#reserveSub').textContent = `Aujourd'hui · ${App.roomMeta(room, { places: false })}`;
    // Présélection : le premier créneau libre, sauf s'il reste moins de 15 min sur le créneau en cours.
    let firstOk = slots.findIndex((s) => s.ok);
    if (firstOk === 0 && slots[0].current && (slots[0].end - now) < 15 * 60e3) {
      const next = slots.findIndex((s, i) => i > 0 && s.ok);
      if (next > 0) firstOk = next;
    }
    $('#reserveSlots').innerHTML = slots.map((s, i) => `
      <label class="slot-choice${s.ok ? '' : ' is-disabled'}">
        <input type="radio" name="slot" value="${slotValue(s)}"${s.ok ? '' : ' disabled'}${i === firstOk ? ' checked' : ''}>
        <span class="slot-choice-text"><strong>${slotRange(s)}</strong><span>${esc(slotHint(s, now))}</span></span>
      </label>`).join('');
    $('#reserveError').hidden = true;
    updateReserveButton();
  }

  function updateReserveButton() {
    const checked = $('#reserveSlots input:checked');
    const btn = $('#reserveSubmit');
    btn.disabled = !checked;
    btn.textContent = checked ? `Confirmer ${checked.value.replace('-', ' – ')}` : 'Aucun créneau libre';
  }

  $('#reserveSlots').addEventListener('change', updateReserveButton);
  $('#reserveClose').addEventListener('click', () => reserveSheet.close());
  reserveSheet.addEventListener('click', (e) => { if (e.target === reserveSheet) reserveSheet.close(); });

  async function startReservation(num) {
    if (!App.auth.hasServerSession) {
      const ok = await requireLogin('reserve');
      if (!ok || !App.auth.hasServerSession) return;
    }
    const mine = myActiveReservation();
    if (mine) {
      const go = await App.confirmDialog({
        title: 'Tu as déjà une réservation',
        text: `Salle ${mine.room_number}, ${App.fmtTime(new Date(mine.start_time))} – ${App.fmtTime(new Date(mine.end_time))}. Libère-la avant d'en faire une autre.`,
        confirm: 'Voir mes réservations',
        cancel: 'Fermer'
      });
      if (go) location.href = '/reservations';
      return;
    }
    reserveRoom = num;
    track('reservation_opened', { room: num });
    renderReserveSheet();
    reserveSheet.showModal();
  }

  $('#reserveForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const checked = $('#reserveSlots input:checked');
    if (!checked) return;
    const btn = $('#reserveSubmit');
    const errBox = $('#reserveError');
    // L'heure a pu tourner depuis l'ouverture de la feuille : on revérifie le créneau.
    const stillOk = reserveSlots(reserveRoom).some((s) => s.ok && slotValue(s) === checked.value);
    if (!stillOk) {
      renderReserveSheet();
      errBox.textContent = "Ce créneau n'est plus disponible. Choisis-en un autre.";
      errBox.hidden = false;
      return;
    }
    const [start, end] = checked.value.split('-');
    btn.setAttribute('aria-busy', 'true');
    errBox.hidden = true;
    try {
      const data = await App.auth.request('/reservations', {
        method: 'POST',
        body: { room_number: reserveRoom, date: App.localDateISO(new Date()), start_time: start, end_time: end }
      });
      const reservations = data.reservations || [];
      const user = App.auth.user;
      App.auth.updateUser({
        reservations: Object.assign({}, user.reservations, {
          history: reservations,
          total: reservations.length,
          active: reservations.filter((r) => r.status === 'active' || r.status === 'upcoming').length
        })
      });
      track('reservation_confirmed', { room: reserveRoom, time_slot: checked.value });
      await App.refreshActiveReservations();
      lastReservation = { room: reserveRoom, start, end };
      reserveSheet.close();
      location.hash = `reservee/${reserveRoom}`;
    } catch (err) {
      if (err.expired) {
        reserveSheet.close();
        App.toast('Session expirée. Reconnecte-toi pour réserver.');
      } else {
        const network = !err.status;
        track('reservation_error', { room: reserveRoom, reason: network ? 'network' : (err.message || 'unknown') });
        errBox.textContent = network ? 'Connexion impossible. Vérifie ton réseau et réessaie.' : err.message;
        errBox.hidden = false;
      }
    } finally {
      btn.removeAttribute('aria-busy');
    }
  });

  function renderConfirm() {
    const r = lastReservation;
    const room = App.data.rooms[r.room];
    viewConfirm.innerHTML = `
      <div class="confirm">
        <div class="confirm-main">
          <span class="confirm-badge" aria-hidden="true">${App.icon.check}</span>
          <h1 tabindex="-1" id="confirmTitle">C'est réservé</h1>
          <p class="confirm-lead">La salle est à toi jusqu'à ${esc(r.end)}.</p>
          <div class="ticket">
            <div class="ticket-top"><strong>Salle ${esc(r.room)}</strong><span class="pill pill--tint">Aujourd'hui</span></div>
            <div class="ticket-grid">
              <div><span>Créneau</span><strong>${esc(r.start)} – ${esc(r.end)}</strong></div>
              <div><span>Où</span><strong>${esc(room ? App.roomMeta(room, { places: false }) : '')}</strong></div>
            </div>
          </div>
        </div>
        <div class="confirm-actions">
          <a class="btn btn-primary" href="/reservations">Voir mes réservations</a>
          <a class="btn btn-ghost" href="#" data-home>Retour aux salles</a>
        </div>
      </div>`;
    $('#confirmTitle').focus();
  }

  viewConfirm.addEventListener('click', (e) => {
    if (e.target.closest('[data-home]')) { e.preventDefault(); navDepth = 0; location.hash = ''; }
  });

  // ---------------------------------------------------------------------------
  // Connexion (demandée uniquement pour réserver ou garder des favoris)
  // ---------------------------------------------------------------------------

  const loginSheet = $('#loginSheet');
  const LOGIN_COPY = {
    reserve: ['Connecte-toi pour réserver', "Pas besoin de compte pour voir les salles libres. La connexion sert seulement à réserver, avec ton adresse ESIEE."],
    favorites: ['Connecte-toi pour garder tes favoris', 'Tes salles favorites sont liées à ton compte ESIEE et te suivent sur tous tes appareils.']
  };

  function requireLogin(reason) {
    return new Promise((resolve) => {
      const [title, text] = LOGIN_COPY[reason] || LOGIN_COPY.reserve;
      $('#loginTitle').textContent = title;
      $('#loginText').textContent = text;
      const btn = $('#loginGoogle');
      btn.removeAttribute('aria-busy');
      let done = false;
      const finish = (ok) => { if (done) return; done = true; if (loginSheet.open) loginSheet.close(); resolve(ok); };
      loginSheet.onclose = () => finish(App.auth.hasServerSession);
      btn.onclick = async () => {
        btn.setAttribute('aria-busy', 'true');
        const ok = await App.auth.login();
        btn.removeAttribute('aria-busy');
        if (ok && !App.auth.hasServerSession) App.toast('Connexion au serveur impossible pour le moment.');
        if (ok) finish(App.auth.hasServerSession);
      };
      loginSheet.showModal();
    });
  }
  $('#loginClose').addEventListener('click', () => loginSheet.close());
  loginSheet.addEventListener('click', (e) => { if (e.target === loginSheet) loginSheet.close(); });

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
    viewConfirm.hidden = view !== 'confirm';
    // Comme sur les maquettes, la barre d'onglets n'apparaît que sur l'accueil.
    document.body.classList.toggle('hide-tabbar', view !== 'home');
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
    // Une navigation (retour du navigateur, lien) ferme les feuilles ouvertes.
    $$('dialog[open]').forEach((d) => d.close());
    const rawHash = location.hash.replace(/^#/, '');
    let hash = rawHash;
    try { hash = decodeURIComponent(rawHash); } catch (e) { /* lien mal encodé : on garde le hash brut */ }
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
    } else if (/^reservee\//.test(hash) && lastReservation) {
      trackedRoom = null;
      show('confirm');
      renderConfirm();
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
    // Un retour arrière vers une fiche déjà vue n'est pas une nouvelle ouverture.
    if (fromUser && !pendingSource) return;
    const state = App.roomState(currentRoom);
    track('room_viewed', {
      room: currentRoom,
      status: state.status,
      building: App.roomEpis(currentRoom),
      floor: App.roomFloor(currentRoom),
      source: pendingSource || 'deeplink'
    });
    pendingSource = null;
  }

  // Profondeur approximative : accueil (0) < recherche (1) < fiche (2).
  // Elle sert à savoir si « retour » peut s'appuyer sur l'historique du navigateur.
  const depthOf = (url) => (url.includes('#reservee/') ? 3 : url.includes('#salle/') ? 2 : url.includes('#recherche') ? 1 : 0);
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
    if (reserveSheet.open) {
      const prev = $('#reserveSlots input:checked')?.value;
      renderReserveSheet();
      const again = prev && $(`#reserveSlots input[value="${prev}"]:not(:disabled)`);
      if (again) { again.checked = true; updateReserveButton(); }
    }
  }, 30000);

  // Données rechargées au retour sur l'onglet si elles ont plus de 10 minutes.
  // Retour sur l'onglet (mobile : minuteries suspendues en arrière-plan) ou page
  // restaurée depuis le cache « retour arrière » : statuts recalculés tout de suite,
  // données rechargées si elles ont plus de 10 minutes.
  function onResume() {
    if (document.hidden || loadState === 'loading') return;
    if (!App.data.loadedAt || Date.now() - App.data.loadedAt.getTime() > 10 * 60e3 || loadState !== 'ok') { load(false); return; }
    if (currentView === 'home' && !filterSheet.open) renderHome();
    else if (currentView === 'room') renderRoom();
    else if (currentView === 'search') runSearch();
  }
  document.addEventListener('visibilitychange', onResume);
  window.addEventListener('pageshow', (e) => { if (e.persisted) onResume(); });

  // ---------------------------------------------------------------------------
  // Démarrage
  // ---------------------------------------------------------------------------

  App.auth.onChange(() => { if (currentView === 'room' && loadState !== 'loading') renderRoom(); });
  App.auth.init();
  renderChips();
  $('#nowLabel').textContent = App.fmtHeaderDate(new Date());
  // Provenance d'un lien venant des autres onglets (?src=favorites#salle/1201), puis URL nettoyée.
  const params = new URLSearchParams(location.search);
  const src = params.get('src');
  if (src && /^[a-z_]{1,32}$/.test(src) && location.hash.includes('salle/')) pendingSource = src;
  else if (location.hash.includes('salle/')) pendingSource = 'deeplink';
  if (src) { try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {} }
  route(false);
  load(false);
})();
