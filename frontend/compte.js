// =============================================================================
// ESIEE Salles — onglets « Réservations » et « Profil »
// =============================================================================
'use strict';

(function () {
  const { $, esc, track } = App;
  const page = document.body.dataset.page;
  const main = $('#main');

  const roomOf = (num) => App.data.rooms[num] || { number: num, epis: App.roomEpis(num), floor: App.roomFloor(num) };
  const range = (r) => `${App.fmtTime(new Date(r.start_time))} – ${App.fmtTime(new Date(r.end_time))}`;

  // Carte de connexion (E-Profil). Le bouton lance Google ; le rendu suit le changement de session.
  function loginCardHTML(title, text) {
    return `
      <section class="section section--tight">
        <div class="card card--login">
          <div>
            <h2 class="card-title">${esc(title)}</h2>
            <p class="card-text">${esc(text)}</p>
          </div>
          <button type="button" class="btn btn-outline btn-google" data-login>Continuer avec Google</button>
          <span class="card-hint">Avec ton adresse ESIEE</span>
        </div>
      </section>`;
  }

  async function onLogin(btn) {
    btn.setAttribute('aria-busy', 'true');
    const ok = await App.auth.login();
    btn.removeAttribute('aria-busy');
    if (ok && !App.auth.hasServerSession) App.toast('Connexion au serveur impossible pour le moment.');
  }

  // ---------------------------------------------------------------------------
  // Réservations (E-Reservations)
  // ---------------------------------------------------------------------------

  function shortDate(d) {
    const s = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function currentCardHTML(r, now) {
    const start = new Date(r.start_time), end = new Date(r.end_time);
    const room = roomOf(r.room_number);
    const running = start <= now;
    const pct = running ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : 0;
    const label = running ? `Se termine dans ${App.fmtDur((end - now) / 60000)}` : `Commence dans ${App.fmtDur((start - now) / 60000)}`;
    return `
      <div class="card">
        <div class="resa-top">
          <div>
            <strong>Salle ${esc(r.room_number)}</strong>
            <span class="meta">${esc(App.roomMeta(room, { places: false }))}</span>
          </div>
          <span class="pill${running ? '' : ' pill--tint'}">${esc(range(r))}</span>
        </div>
        <div>
          <div class="progress" role="progressbar" aria-label="Temps écoulé" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><span style="width:${pct.toFixed(1)}%"></span></div>
          <p class="progress-label">${esc(label)}</p>
        </div>
        <div class="btn-row">
          <a class="btn btn-soft btn-sm" href="/?src=reservations#salle/${esc(r.room_number)}">Voir la salle</a>
          <button type="button" class="btn btn-danger-outline btn-sm" data-cancel="${esc(r.id)}">${running ? 'Libérer la salle' : 'Annuler'}</button>
        </div>
      </div>`;
  }

  function renderReservations() {
    if (!App.auth.loggedIn) {
      App.setHTML(main, loginCardHTML('Connecte-toi pour voir tes réservations', "Pas besoin de compte pour voir les salles libres. La connexion sert seulement à réserver, avec ton adresse ESIEE."));
      return;
    }
    const now = new Date();
    const hist = (App.auth.user.reservations && App.auth.user.reservations.history) || [];
    const live = hist.filter((r) => r.status !== 'cancelled' && new Date(r.end_time) > now)
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    const past = hist.filter((r) => r.status !== 'cancelled' && new Date(r.end_time) <= now)
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
      .slice(0, 10);
    const running = live.filter((r) => new Date(r.start_time) <= now);
    const upcoming = live.filter((r) => new Date(r.start_time) > now);

    if (!live.length && !past.length) {
      App.setHTML(main, `
        <section class="empty">
          <span class="empty-icon" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#55627A" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg></span>
          <h2>Aucune réservation</h2>
          <p>Réserver bloque une salle libre pour une heure. Choisis une salle, puis « Réserver un créneau ».</p>
        </section>
        <section class="section"><a class="btn btn-primary" href="/">Voir les salles libres</a></section>`);
      return;
    }

    let html = '';
    if (running.length) html += `<section class="section section--tight"><h2 class="section-label">En cours</h2>${running.map((r) => currentCardHTML(r, now)).join('')}</section>`;
    if (upcoming.length) html += `<section class="section${running.length ? '' : ' section--tight'}"><h2 class="section-label">À venir</h2>${upcoming.map((r) => currentCardHTML(r, now)).join('')}</section>`;
    if (!live.length) {
      html += `
        <section class="section section--tight">
          <div class="card">
            <div><h2 class="card-title">Rien en cours</h2><p class="card-text">Aucune réservation en ce moment.</p></div>
            <a class="btn btn-primary btn-md" href="/">Voir les salles libres</a>
          </div>
        </section>`;
    }
    if (past.length) {
      html += `
        <section class="section">
          <h2 class="section-label">Passées</h2>
          <ul class="grouped">
            ${past.map((r) => `
              <li class="grouped-link" style="cursor:default">
                <span class="room-card-col"><span class="room-num room-num--xs">Salle ${esc(r.room_number)}</span><span class="room-meta">${esc(shortDate(new Date(r.start_time)))} · ${esc(range(r))}</span></span>
                <a class="text-btn" href="/?src=past_reservations#salle/${esc(r.room_number)}" style="font-weight:800;font-size:14px;padding:10px 0">Revoir</a>
              </li>`).join('')}
          </ul>
        </section>`;
    }
    App.setHTML(main, html);
  }

  async function cancelReservation(id) {
    const ok = await App.confirmDialog({
      title: 'Libérer la salle ?',
      text: 'La réservation sera annulée et la salle redeviendra libre pour les autres.',
      confirm: 'Libérer',
      cancel: 'Garder',
      danger: true
    });
    if (!ok) return;
    try {
      const data = await App.auth.request(`/reservations/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const reservations = data.reservations || [];
      App.auth.updateUser({
        reservations: Object.assign({}, App.auth.user.reservations, {
          history: reservations,
          total: reservations.length,
          active: reservations.filter((r) => r.status === 'active' || r.status === 'upcoming').length
        })
      });
      track('reservation_cancelled');
      App.toast('Salle libérée');
    } catch (err) {
      App.toast(err.expired ? 'Session expirée. Reconnecte-toi.' : (err.message || "Impossible d'annuler la réservation."));
    }
  }

  // ---------------------------------------------------------------------------
  // Profil (E-Profil / E-Profil-connecte)
  // ---------------------------------------------------------------------------

  const aboutHTML = `
    <section class="section">
      <h2 class="section-label">À propos</h2>
      <ul class="grouped">
        <li><a class="grouped-link grouped-link--plain" href="https://github.com/Zeffut/Esiee-Paris-Salles/issues/new" target="_blank" rel="noopener noreferrer">Signaler une erreur d'horaire${App.icon.chevronRight.replace('currentColor', '#55627A')}</a></li>
        <li><a class="grouped-link grouped-link--plain" href="https://buymeacoffee.com/zeffut" target="_blank" rel="noopener noreferrer">Soutenir le projet${App.icon.external}</a></li>
      </ul>
      <p class="colophon">Développé par <a href="https://portfolio.zeffut.fr" target="_blank" rel="noopener noreferrer">Zeffut</a> · Horaires issus de l'emploi du temps ESIEE</p>
    </section>`;

  function initials(name) {
    return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';
  }

  function favoritesHTML() {
    const favs = App.favorites.list();
    if (!favs.length) {
      return `<p class="card-text" style="margin:0">Touche l'étoile d'une salle pour la retrouver ici.</p>`;
    }
    const now = new Date();
    const ready = App.data.loadedAt !== null;
    return `<ul class="grouped">${favs.map((num) => {
      const room = roomOf(num);
      let right = '';
      if (ready && App.data.rooms[num]) {
        const st = App.roomState(num, now);
        const lbl = App.stateLabels(st, now);
        right = st.status === 'libre'
          ? `<span class="room-until" style="font-size:14px">Libre ${esc(lbl.until)}</span>`
          : `<span class="room-until room-until--busy" style="font-size:14px">${esc(lbl.until.charAt(0).toUpperCase() + lbl.until.slice(1))}</span>`;
      }
      return `
        <li><a class="grouped-link" href="/?src=favorites#salle/${esc(num)}">
          <span class="room-card-col"><span class="room-num room-num--xs">Salle ${esc(num)}</span><span class="room-meta">${esc(App.roomMeta(room, { places: false }))}</span></span>
          ${right}
        </a></li>`;
    }).join('')}</ul>`;
  }

  function renderProfile() {
    if (!App.auth.loggedIn) {
      App.setHTML(main, loginCardHTML('Connecte-toi pour réserver', 'Pas besoin de compte pour voir les salles libres. La connexion sert à réserver et à retrouver tes favoris.') + aboutHTML);
      return;
    }
    const u = App.auth.user;
    const avatar = u.picture
      ? `<span class="avatar"><img src="${esc(u.picture)}" alt="" referrerpolicy="no-referrer"></span>`
      : `<span class="avatar" aria-hidden="true">${esc(initials(u.name))}</span>`;
    App.setHTML(main, `
      <section class="section section--tight">
        <div class="card identity">
          ${avatar}
          <div class="identity-text"><strong>${esc(u.name || 'Utilisateur')}</strong><span>${esc(u.email || '')}</span></div>
        </div>
      </section>
      <section class="section">
        <h2 class="section-label">Mes salles favorites</h2>
        ${favoritesHTML()}
      </section>
      <section class="section">
        <button type="button" class="btn btn-danger-soft" data-logout>Se déconnecter</button>
      </section>
      ${aboutHTML}`);
    const img = main.querySelector('.avatar img');
    if (img && !img.__bound) img.__bound = true, img.addEventListener('error', () => { img.parentElement.textContent = initials(u.name); });
  }

  // ---------------------------------------------------------------------------

  const render = page === 'reservations' ? renderReservations : renderProfile;

  main.addEventListener('click', (e) => {
    const login = e.target.closest('[data-login]');
    if (login) { onLogin(login); return; }
    if (e.target.closest('[data-logout]')) { App.auth.logout(); return; }
    const cancel = e.target.closest('[data-cancel]');
    if (cancel) cancelReservation(cancel.dataset.cancel);
  });

  App.auth.onChange(render);
  render();
  App.auth.init();

  // Les infos de salle (épi, statut des favoris) viennent de /rooms, chargé en arrière-plan.
  App.loadRooms().then(render);
  setInterval(() => { if (!document.hidden) render(); }, 30000);
})();
