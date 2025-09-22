// Enregistrement du Service Worker pour PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js')
      .then(function(registration) {

        // Vérifier les mises à jour
        registration.addEventListener('updatefound', function() {
          const newWorker = registration.installing;

          newWorker.addEventListener('statechange', function() {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nouvelle version disponible
              showUpdateNotification();
            }
          });
        });
      })
      .catch(function(error) {
      });
  });
}

// Notification de mise à jour
function showUpdateNotification() {
  if (confirm('Une nouvelle version est disponible. Recharger l\'application ?')) {
    window.location.reload();
  }
}

// Détection du mode installation PWA
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallButton();
});

// Afficher le bouton d'installation
function showInstallButton() {
  // Créer un bouton d'installation si pas déjà présent
  if (!document.getElementById('pwa-install-btn')) {
    const installBtn = document.createElement('button');
    installBtn.id = 'pwa-install-btn';
    installBtn.innerHTML = '📱 Installer l\'app';
    installBtn.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      background: var(--accent, #ff6a1a);
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;

    installBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        installBtn.remove();
      }
    });

    document.body.appendChild(installBtn);

    // Masquer automatiquement après 10 secondes
    setTimeout(() => {
      if (installBtn.parentNode) {
        installBtn.style.opacity = '0.7';
      }
    }, 10000);
  }
}

// Détection de l'installation réussie
window.addEventListener('appinstalled', (evt) => {
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) {
    installBtn.remove();
  }
});

document.addEventListener('DOMContentLoaded', function() {
  const titleSection = document.querySelector('.title-section');
  const titleInline = document.querySelector('.title-inline');
  const grid = document.querySelector('.grid');
  const hamburger = document.querySelector('.hamburger');
  const menuOverlay = document.querySelector('#menuOverlay');
  const roomModal = document.querySelector('#roomModal');
  const roomModalClose = document.querySelector('#roomModalClose');
  const filterBtn = document.querySelector('#filterBtn');
  const filterModal = document.querySelector('#filterModal');
  const filterModalClose = document.querySelector('#filterModalClose');
  const profilePage = document.querySelector('#profilePage');
  const profileBack = document.querySelector('#profileBack');
  const cards = document.querySelectorAll('.card');

  // Gestion du scroll pour le titre
  function handleScroll() {
    const titleSectionRect = titleSection.getBoundingClientRect();

    // Si le titre principal sort de l'écran (position négative)
    if (titleSectionRect.bottom <= 80) {
      titleInline.classList.add('visible');
    } else {
      titleInline.classList.remove('visible');
    }
  }

  // Gestion du menu hamburger
  function toggleMenu() {
    hamburger.classList.toggle('active');
    menuOverlay.classList.toggle('open');

    // Empêcher le scroll du body quand le menu est ouvert
    if (menuOverlay.classList.contains('open')) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
  }

  // Fermer le menu en cliquant sur l'overlay
  function closeMenu(e) {
    if (e.target === menuOverlay) {
      toggleMenu();
    }
  }

  // Fonctions pour extraire l'Epis et l'étage depuis le numéro de salle
  function getRoomEpis(roomNumber) {
    // Les salles à 3 chiffres sont dans la Rue (comme si elles avaient un 0 devant)
    // Par exemple: 210 = 0210 (Rue)
    if (roomNumber.length === 3) {
      return 'Rue';
    } else {
      // Salles à 4 chiffres : utiliser le 1er caractère
      const firstDigit = roomNumber.charAt(0);
      switch(firstDigit) {
        case '0': return 'Rue';
        case '1': return 'Epis 1';
        case '2': return 'Epis 2';
        case '3': return 'Epis 3';
        case '4': return 'Epis 4';
        case '5': return 'Epis 5';
        default: return 'Rue'; // Valeur par défaut
      }
    }
  }

  function getRoomFloor(roomNumber) {
    if (roomNumber.length === 3) {
      // Salles à 3 chiffres sont toutes dans la Rue aux étages 1 ou 2
      // 1XX = 1er étage, 2XX = 2ème étage
      const firstDigit = roomNumber.charAt(0);
      switch(firstDigit) {
        case '1': return '1er étage';
        case '2': return '2ème étage';
        default: return '1er étage'; // Valeur par défaut pour les salles 3 chiffres
      }
    } else {
      // Salles à 4 chiffres : 2ème caractère = étage
      const secondDigit = roomNumber.charAt(1);
      switch(secondDigit) {
        case '0': return 'Rez-de-chaussée';
        case '1': return '1er étage';
        case '2': return '2ème étage';
        case '3': return '3ème étage';
        case '4': return '4ème étage';
        default: return 'Étage inconnu';
      }
    }
  }

  // Configuration de l'API
  // Utiliser HTTPS via tunnel FRP
  const API_BASE_URL = 'https://api.zeffut.fr/api';


  // Données par défaut en attendant l'API
  const defaultRoomData = {
    '0110': { name: 'Salle de cours 0110', board: 'Tableau blanc', capacity: '30', type: 'Salle classique' },
    '0160': { name: 'Laboratoire informatique', board: 'Écran interactif', capacity: '25', type: 'Salle classique' },
    '0210': { name: 'Salle de conférence', board: 'Vidéoprojecteur', capacity: '50', type: 'Amphithéâtre' },
    '0260': { name: 'Salle de cours 0260', board: 'Tableau blanc', capacity: '35', type: 'Salle classique' },
    '2101': { name: 'Salle de TP électronique', board: 'Tableau noir', capacity: '20', type: 'Salle classique' },
    '2102': { name: 'Laboratoire chimie', board: 'Tableau blanc', capacity: '18', type: 'Salle classique' },
    '2103': { name: 'Salle informatique', board: 'Écran interactif', capacity: '25', type: 'Salle classique' },
    '2104': { name: 'Salle de cours 2104', board: 'Tableau blanc', capacity: '40', type: 'Salle classique' },
    '2107': { name: 'Amphithéâtre B', board: 'Vidéoprojecteur', capacity: '80', type: 'Amphithéâtre' },
    '3205': { name: 'Salle polyvalente', board: 'Tableau blanc interactif', capacity: '40', type: 'Salle classique' },
    '3209': { name: 'Salle de cours 3209', board: 'Tableau blanc', capacity: '32', type: 'Salle classique' },
    '3303': { name: 'Laboratoire physique', board: 'Tableau noir', capacity: '22', type: 'Salle classique' },
    '3309': { name: 'Salle de réunion 3309', board: 'Écran tactile', capacity: '12', type: 'Salle classique' },
    '4103': { name: 'Amphithéâtre principal', board: 'Écran géant', capacity: '120', type: 'Amphithéâtre' },
    '4109': { name: 'Salle de cours 4109', board: 'Tableau blanc', capacity: '28', type: 'Salle classique' },
    '4203': { name: 'Laboratoire électronique', board: 'Tableau interactif', capacity: '20', type: 'Salle classique' },
    '4209': { name: 'Salle de projet', board: 'Écran tactile', capacity: '16', type: 'Salle classique' },
    '5103': { name: 'Salle de conférence 5103', board: 'Vidéoprojecteur', capacity: '60', type: 'Amphithéâtre' },
    '5109': { name: 'Salle de cours 5109', board: 'Tableau blanc', capacity: '30', type: 'Salle classique' },
    '5203': { name: 'Salle de réunion', board: 'Écran tactile', capacity: '15', type: 'Salle classique' }
  };

  // Statuts par défaut
  const defaultRoomStatuses = {
    '0110': 'libre', '0160': 'occupé', '0210': 'libre', '0260': 'occupé',
    '2101': 'libre', '2102': 'libre', '2103': 'occupé', '2104': 'libre',
    '2107': 'occupé', '3205': 'libre', '3209': 'libre', '3303': 'occupé',
    '3309': 'libre', '4103': 'libre', '4109': 'occupé', '4203': 'libre',
    '4209': 'libre', '5103': 'occupé', '5109': 'libre', '5203': 'libre'
  };

  let roomData = defaultRoomData;
  let roomStatuses = defaultRoomStatuses;

  // État des filtres - Afficher toutes les salles par défaut
  let currentFilters = {
    status: ['libre'],
    type: ['Salle classique', 'Amphithéâtre'],
    epis: ['Rue', 'Epis 1', 'Epis 2', 'Epis 3', 'Epis 4'],
    floors: ['Rez-de-chaussée', '1er étage', '2ème étage', '3ème étage', '4ème étage']
  };

  // Ouvrir le modal de détails d'une salle
  async function openRoomModal(roomNumber, roomStatus) {
    const room = roomData[roomNumber] || {
      name: `Salle ${roomNumber}`,
      board: 'Tableau blanc',
      capacity: '30',
      type: 'Salle classique'
    };

    // Déterminer automatiquement l'Epis et l'étage
    const roomEpis = getRoomEpis(roomNumber);
    const roomFloor = getRoomFloor(roomNumber);

    document.getElementById('roomModalTitle').textContent = `Salle ${roomNumber}`;
    document.getElementById('roomModalName').textContent = room.name;
    document.getElementById('roomModalBoard').textContent = room.board;
    document.getElementById('roomModalCapacity').textContent = `${room.capacity} places`;
    document.getElementById('roomModalType').textContent = room.type;
    document.getElementById('roomModalFloor').textContent = `${roomEpis} - ${roomFloor}`;

    const statusElement = document.getElementById('roomModalStatus');
    statusElement.textContent = roomStatus;
    statusElement.className = `room-status ${roomStatus === 'libre' ? 'libre' : 'occupe'}`;

    // Charger et afficher l'emploi du temps du jour
    await loadTodaySchedule(roomNumber);

    roomModal.classList.add('open');
    document.body.classList.add('modal-open');
  }

  // Charger l'emploi du temps du jour actuel pour une salle
  async function loadTodaySchedule(roomNumber) {
    try {
      const response = await fetch(`${API_BASE_URL}/rooms/${roomNumber}/schedule`);
      if (response.ok) {
        const data = await response.json();
        displayTodaySchedule(data.schedule);
      } else {
        displayTodaySchedule(null);
      }
    } catch (error) {
      displayTodaySchedule(null);
    }
  }

  // Afficher l'emploi du temps du jour dans le modal
  function displayTodaySchedule(schedule) {
    const scheduleContainer = document.getElementById('roomModalSchedule');

    if (!schedule) {
      scheduleContainer.innerHTML = '<p class="schedule-error">Emploi du temps non disponible</p>';
      return;
    }

    // Obtenir le jour actuel (heure française)
    const now = new Date();
    const options = { timeZone: 'Europe/Paris' };
    const frenchTime = new Date(now.toLocaleString('en-US', options));
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = days[frenchTime.getDay()];
    const todaySchedule = schedule[today] || [];

    const dayNames = {
      'monday': 'Lundi',
      'tuesday': 'Mardi',
      'wednesday': 'Mercredi',
      'thursday': 'Jeudi',
      'friday': 'Vendredi',
      'saturday': 'Samedi',
      'sunday': 'Dimanche'
    };

    // Filtrer les cours passés (utilise l'heure française déjà calculée)
    const currentTime = frenchTime.getHours() * 60 + frenchTime.getMinutes(); // Convertir en minutes

    const futureCourses = todaySchedule.filter(course => {
      const courseEndTime = course.end.split(':');
      const courseEndMinutes = parseInt(courseEndTime[0]) * 60 + parseInt(courseEndTime[1]);
      return courseEndMinutes > currentTime; // Ne garder que les cours qui ne sont pas encore terminés
    });

    let scheduleHTML = `<h4>Emploi du temps - ${dayNames[today]}</h4>`;

    if (futureCourses.length === 0) {
      scheduleHTML += '<p class="schedule-empty">Aucun cours à venir aujourd\'hui</p>';
    } else {
      scheduleHTML += '<div class="schedule-list">';
      futureCourses.forEach(course => {
        const courseStartTime = course.start.split(':');
        const courseStartMinutes = parseInt(courseStartTime[0]) * 60 + parseInt(courseStartTime[1]);
        const isCurrentCourse = courseStartMinutes <= currentTime;

        scheduleHTML += `
          <div class="schedule-item ${isCurrentCourse ? 'schedule-current' : ''}">
            <div class="schedule-time">${course.start} - ${course.end}</div>
            <div class="schedule-course">${course.course}${isCurrentCourse ? ' (en cours)' : ''}</div>
          </div>
        `;
      });
      scheduleHTML += '</div>';
    }

    scheduleContainer.innerHTML = scheduleHTML;
  }

  // Fermer le modal de détails
  function closeRoomModal() {
    roomModal.classList.remove('open');
    document.body.classList.remove('modal-open');
  }

  // Fermer le modal en cliquant sur l'overlay
  function closeRoomModalOverlay(e) {
    if (e.target === roomModal) {
      closeRoomModal();
    }
  }

  // Gestion du swipe down pour fermer le modal de salle
  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  function handleTouchStart(e) {
    startY = e.touches[0].clientY;
    isDragging = true;
  }

  function handleTouchMove(e) {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const diffY = currentY - startY;

    // Si on scroll vers le bas (diffY > 0) et qu'on est en haut du contenu
    if (diffY > 0) {
      const modalContent = roomModal.querySelector('.room-modal-content');
      if (modalContent.scrollTop === 0) {
        // Empêcher le scroll par défaut et ajouter un effet visuel
        e.preventDefault();
        const translateY = Math.min(diffY * 0.5, 100); // Limite à 100px
        modalContent.style.transform = `translateY(${translateY}px)`;
      }
    }
  }

  function handleTouchEnd(e) {
    if (!isDragging) return;
    isDragging = false;

    const diffY = currentY - startY;
    const modalContent = roomModal.querySelector('.room-modal-content');

    // Si on a swipé vers le bas de plus de 80px, fermer le modal
    if (diffY > 80 && modalContent.scrollTop === 0) {
      closeRoomModal();
    } else {
      // Remettre en place
      modalContent.style.transform = 'translateY(0)';
    }
  }

  // Ouvrir le modal de filtre
  function openFilterModal() {
    filterModal.classList.add('open');
    document.body.classList.add('modal-open');
  }

  // Fermer le modal de filtre
  function closeFilterModal() {
    filterModal.classList.remove('open');
    document.body.classList.remove('modal-open');
  }

  // Fermer le modal de filtre en cliquant sur l'overlay
  function closeFilterModalOverlay(e) {
    if (e.target === filterModal) {
      closeFilterModal();
    }
  }

  // Fonction pour filtrer les salles
  function filterRooms() {
    const allCards = document.querySelectorAll('.card');
    const searchInput = document.querySelector('.search input[type="text"]');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    allCards.forEach(card => {
      const roomNumber = card.querySelector('.room-number').textContent;
      const roomStatus = card.querySelector('.room-state').textContent;
      const room = roomData[roomNumber] || { type: 'Salle classique' };

      // Déterminer automatiquement l'Epis et l'étage depuis le numéro de salle
      const roomEpis = getRoomEpis(roomNumber);
      const roomFloor = getRoomFloor(roomNumber);

      // Recherche textuelle - chercher dans le numéro de salle ET dans les descriptions
      const searchableText = [
        roomNumber,                    // Numéro de la salle (ex: "160", "1234")
        `Salle ${roomNumber}`,        // Nom complet (ex: "Salle 160")
        room.type || 'Salle classique', // Type (ex: "Amphithéâtre", "Salle classique")
        room.board || '',             // Type de tableau (ex: "Tableau à craie")
        room.capacity || '',          // Capacité (ex: "80", "30")
        roomEpis,                     // Epis (ex: "Rue", "Epis 1")
        roomFloor,                    // Étage (ex: "1er étage")
        roomStatus                    // Status (ex: "libre", "occupé")
      ].join(' ').toLowerCase();

      const searchMatch = searchTerm === '' || searchableText.includes(searchTerm);

      // Vérifier si la salle correspond aux filtres
      const statusMatch = currentFilters.status.includes(roomStatus);
      const typeMatch = currentFilters.type.includes(room.type);
      const episMatch = currentFilters.epis.includes(roomEpis);
      const floorMatch = currentFilters.floors.includes(roomFloor);

      // Afficher ou masquer la carte (doit correspondre aux filtres ET à la recherche)
      if (searchMatch && statusMatch && typeMatch && episMatch && floorMatch) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  }

  // Réinitialiser les filtres
  function resetFilters() {
    currentFilters = {
      status: ['libre'],
      type: ['Salle classique', 'Amphithéâtre'],
      epis: ['Rue', 'Epis 1', 'Epis 2', 'Epis 3', 'Epis 4'],
      floors: ['Rez-de-chaussée', '1er étage', '2ème étage', '3ème étage', '4ème étage']
    };

    // Remettre toutes les checkboxes à checked
    document.querySelectorAll('.filter-checkbox input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = true;
    });

    // Effacer la barre de recherche
    const searchInput = document.querySelector('.search input[type="text"]');
    if (searchInput) {
      searchInput.value = '';
    }

    // Afficher toutes les salles en utilisant la fonction de filtrage
    filterRooms();

    // Fermer le modal de filtre
    closeFilterModal();
  }

  // Appliquer les filtres selon les checkboxes
  function applyFilters() {
    // Récupérer l'état des checkboxes de statut
    currentFilters.status = [];
    if (document.getElementById('filter-libre').checked) currentFilters.status.push('libre');
    if (document.getElementById('filter-occupe').checked) currentFilters.status.push('occupé');

    // Récupérer l'état des checkboxes de type
    currentFilters.type = [];
    if (document.getElementById('filter-classique').checked) currentFilters.type.push('Salle classique');
    if (document.getElementById('filter-amphi').checked) currentFilters.type.push('Amphithéâtre');

    // Récupérer l'état des checkboxes d'Epis
    currentFilters.epis = [];
    if (document.getElementById('filter-rue').checked) currentFilters.epis.push('Rue');
    if (document.getElementById('filter-epis1').checked) currentFilters.epis.push('Epis 1');
    if (document.getElementById('filter-epis2').checked) currentFilters.epis.push('Epis 2');
    if (document.getElementById('filter-epis3').checked) currentFilters.epis.push('Epis 3');
    if (document.getElementById('filter-epis4').checked) currentFilters.epis.push('Epis 4');
    if (document.getElementById('filter-epis5').checked) currentFilters.epis.push('Epis 5');

    // Récupérer l'état des checkboxes d'Étage
    currentFilters.floors = [];
    if (document.getElementById('filter-floor0').checked) currentFilters.floors.push('Rez-de-chaussée');
    if (document.getElementById('filter-floor1').checked) currentFilters.floors.push('1er étage');
    if (document.getElementById('filter-floor2').checked) currentFilters.floors.push('2ème étage');
    if (document.getElementById('filter-floor3').checked) currentFilters.floors.push('3ème étage');
    if (document.getElementById('filter-floor4').checked) currentFilters.floors.push('4ème étage');

    // Appliquer les filtres et fermer le modal
    filterRooms();
    closeFilterModal();
  }

  // Gestion de la page profil
  function openProfilePage() {
    profilePage.classList.add('open');
    document.body.classList.add('modal-open');
  }

  function closeProfilePage() {
    profilePage.classList.remove('open');
    document.body.classList.remove('modal-open');
  }

  // Event listeners
  hamburger.addEventListener('click', toggleMenu);
  menuOverlay.addEventListener('click', closeMenu);
  roomModalClose.addEventListener('click', closeRoomModal);
  roomModal.addEventListener('click', closeRoomModalOverlay);
  filterBtn.addEventListener('click', openFilterModal);
  filterModalClose.addEventListener('click', closeFilterModal);
  filterModal.addEventListener('click', closeFilterModalOverlay);
  profileBack.addEventListener('click', closeProfilePage);

  // Event listeners pour le swipe down sur le modal de salle
  roomModal.addEventListener('touchstart', handleTouchStart, { passive: false });
  roomModal.addEventListener('touchmove', handleTouchMove, { passive: false });
  roomModal.addEventListener('touchend', handleTouchEnd, { passive: false });

  // Event listeners pour les boutons de filtre
  document.getElementById('filterReset').addEventListener('click', resetFilters);
  document.getElementById('filterApply').addEventListener('click', applyFilters);

  // Event listener pour la barre de recherche
  const searchInput = document.querySelector('.search input[type="text"]');
  if (searchInput) {
    // Recherche en temps réel pendant la saisie
    searchInput.addEventListener('input', function() {
      filterRooms();
    });

    // Recherche lors de l'appui sur Entrée
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        filterRooms();
      }
    });
  }

  // Event listener pour ouvrir la page profil depuis le menu
  document.getElementById('profileMenuItem').addEventListener('click', function(e) {
    e.preventDefault();
    toggleMenu(); // Fermer le menu
    openProfilePage(); // Ouvrir la page profil
  });

  // Event listener pour le bouton de connexion Google
  document.getElementById('loginBtn').addEventListener('click', function(e) {
    e.preventDefault();
    initiateGoogleSignIn();
  });

  // Event listener pour le bouton de connexion Apple (placeholder)
  document.getElementById('appleLoginBtn').addEventListener('click', function(e) {
    e.preventDefault();
    showErrorMessage('Connexion Apple non disponible pour le moment');
  });

  // Event listener pour le bouton de déconnexion
  document.getElementById('logoutBtn').addEventListener('click', function(e) {
    e.preventDefault();
    signOut();
  });

  // Supprimer l'ancienne logique des event listeners (maintenant géré dans renderRooms)

  // Écouter le scroll sur la fenêtre
  window.addEventListener('scroll', handleScroll);
  // Écouter aussi le scroll sur la grille
  grid.addEventListener('scroll', handleScroll);

  // Fonction pour charger les données depuis l'API
  async function loadRoomsFromAPI() {
    try {
      const response = await fetch(`${API_BASE_URL}/rooms`);
      if (response.ok) {
        const data = await response.json();

        // Nouvelle API dynamique : convertir rooms_list en format attendu par le frontend
        if (data.rooms_list && Array.isArray(data.rooms_list)) {
          console.log(`🚀 API dynamique: ${data.rooms_list.length} salles chargées`);

          // Convertir le format de l'API en format attendu par le frontend
          roomData = {};
          roomStatuses = {};

          data.rooms_list.forEach(room => {
            roomData[room.number] = {
              name: room.name,
              board: room.board,
              capacity: room.capacity,
              type: room.type
            };
            roomStatuses[room.number] = room.status;

          });

        } else {
          // Ancien format (fallback)
          roomData = data.rooms || defaultRoomData;
          roomStatuses = data.statuses || defaultRoomStatuses;
        }

        hideAPIError();
        renderRooms();
      } else {
        throw new Error('API non disponible');
      }
    } catch (error) {
      console.error('Erreur API:', error);
      showAPIError();
      // Utiliser les données par défaut en cas d'erreur
      roomData = defaultRoomData;
      roomStatuses = defaultRoomStatuses;
      renderRooms();
    }
  }

  // Afficher le message d'erreur API
  function showAPIError() {
    const errorMessage = document.getElementById('apiErrorMessage');
    if (errorMessage) {
      errorMessage.style.display = 'block';
    } else {
      // Créer un message d'erreur pour Mixed Content
      showMixedContentWarning();
    }
  }

  // Afficher un avertissement sur Mixed Content
  function showMixedContentWarning() {
    const warningDiv = document.createElement('div');
    warningDiv.id = 'mixedContentWarning';
    warningDiv.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      right: 20px;
      background: #ff6b35;
      color: white;
      padding: 15px;
      border-radius: 8px;
      z-index: 9999;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    warningDiv.innerHTML = `
      <div><strong>⚠️ Connexion API impossible</strong></div>
      <div style="margin-top: 8px; font-size: 14px;">
        Pour utiliser l'application, cliquez sur le bouclier 🛡️ dans la barre d'adresse et autorisez le contenu non sécurisé.
      </div>
      <button onclick="this.parentElement.remove()" style="margin-top: 10px; background: white; color: #ff6b35; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
        Compris
      </button>
    `;
    document.body.appendChild(warningDiv);
  }

  // Masquer le message d'erreur API
  function hideAPIError() {
    const errorMessage = document.getElementById('apiErrorMessage');
    errorMessage.style.display = 'none';
  }

  // Configuration Google OAuth
  const GOOGLE_CLIENT_ID = '280602510509-ep76jc9na5ae6qbdmcfm7sria30c0acb.apps.googleusercontent.com'; // À remplacer par votre vrai Client ID

  // Variable pour stocker l'utilisateur connecté
  let currentUser = null;

  // Initialisation de Google Sign-In
  function initializeGoogleAuth() {

    if (typeof google !== 'undefined' && google.accounts) {

      try {
        // Initialiser Google Identity Services avec options de persistance
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: true, // Permet la sélection automatique pour les utilisateurs connus
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true // Utilise FedCM pour une meilleure UX
        });

        // Vérifier si l'utilisateur est déjà connecté
        checkExistingAuth();

      } catch (error) {
      }
    } else {
      // Réessayer après un délai si Google n'est pas encore chargé
      setTimeout(initializeGoogleAuth, 1000);
    }
  }

  // Fonction pour déclencher la connexion Google (appelée par le bouton)
  function initiateGoogleSignIn() {

    // Vérifier si l'API Google est chargée
    if (typeof google === 'undefined') {
      showErrorMessage('API Google non chargée. Veuillez actualiser la page.');
      return;
    }


    if (google.accounts && google.accounts.id) {

      // Utiliser le prompt pour la connexion
      google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Alternative : utiliser le flow OAuth popup
          initiateOAuthFlow();
        }
      });
    } else if (google.accounts && google.accounts.oauth2) {
      initiateOAuthFlow();
    } else {
        showErrorMessage('Services Google non disponibles. Vérifiez votre connexion internet.');
    }
  }

  // Flow OAuth alternatif si le prompt ne fonctionne pas
  function initiateOAuthFlow() {
    if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'profile email',
        callback: (response) => {
          if (response.access_token) {
            // Récupérer les infos utilisateur avec le token
            fetchUserInfoWithToken(response.access_token);
          }
        }
      });
      client.requestAccessToken();
    } else {
      showErrorMessage('OAuth Google non disponible');
    }
  }

  // Récupérer les infos utilisateur avec le token OAuth
  async function fetchUserInfoWithToken(accessToken) {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const userInfo = await response.json();

        // Simuler la structure du JWT pour compatibilité
        currentUser = {
          id: userInfo.id,
          name: userInfo.name,
          email: userInfo.email,
          picture: userInfo.picture,
          token: accessToken // Ce n'est pas un JWT mais ça fonctionne pour notre usage
        };

        // Sauvegarder et afficher avec timestamp
        localStorage.setItem('user', JSON.stringify(currentUser));
        localStorage.setItem('lastLoginTime', Date.now().toString());
        showLoggedInState();

      } else {
        throw new Error('Erreur lors de la récupération du profil');
      }
    } catch (error) {
      showErrorMessage('Erreur lors de la connexion');
    }
  }

  // Gérer la réponse de connexion Google
  function handleCredentialResponse(response) {
    try {
      // Décoder le JWT token
      const userInfo = parseJwt(response.credential);

      // Stocker les informations utilisateur
      currentUser = {
        id: userInfo.sub,
        name: userInfo.name,
        email: userInfo.email,
        picture: userInfo.picture,
        token: response.credential
      };

      // Sauvegarder dans localStorage avec timestamp
      localStorage.setItem('user', JSON.stringify(currentUser));
      localStorage.setItem('lastLoginTime', Date.now().toString());

      // Afficher l'interface utilisateur connecté
      showLoggedInState();

    } catch (error) {
      showErrorMessage('Erreur lors de la connexion');
    }
  }

  // Fonction pour décoder le JWT (avec gestion d'erreurs)
  function parseJwt(token) {
    try {
      if (!token || typeof token !== 'string' || !token.includes('.')) {
        throw new Error('Token invalide');
      }

      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Token JWT malformé');
      }

      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

      // Ajouter du padding si nécessaire
      const padding = base64.length % 4;
      const paddedBase64 = padding ? base64 + '='.repeat(4 - padding) : base64;

      // Décoder directement le base64 en UTF-8
      const binaryString = atob(paddedBase64);

      // Convertir les caractères en UTF-8 proprement
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const jsonPayload = new TextDecoder('utf-8').decode(bytes);

      return JSON.parse(jsonPayload);
    } catch (error) {
      throw new Error('Token JWT invalide: ' + error.message);
    }
  }

  // Vérifier l'authentification existante (version simplifiée)
  function checkExistingAuth() {

    const storedUser = localStorage.getItem('user');
    const lastLoginTime = localStorage.getItem('lastLoginTime');


    // Si on a un utilisateur stocké, on le garde connecté (session persistante simple)
    if (storedUser) {
      try {
        currentUser = JSON.parse(storedUser);

        // Vérification simple : si on a un utilisateur ET qu'il a été connecté récemment (7 jours max)
        const now = Date.now();
        const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000; // 7 jours

        if (lastLoginTime) {
          const sessionAge = now - parseInt(lastLoginTime);


          if (sessionAge < sevenDaysInMs) {
            showLoggedInState();
            return;
          } else {
            signOut();
            return;
          }
        } else {
          // Pas de timestamp, on connecte quand même mais on met à jour le timestamp
          localStorage.setItem('lastLoginTime', Date.now().toString());
          showLoggedInState();
          return;
        }

      } catch (error) {
        signOut();
        return;
      }
    } else {
    }
  }


  // Afficher l'état connecté
  function showLoggedInState() {
    const profileNotLogged = document.getElementById('profileNotLogged');
    const profileLogged = document.getElementById('profileLogged');

    // Masquer la page de connexion
    profileNotLogged.style.display = 'none';

    // Afficher la page connectée
    profileLogged.style.display = 'block';

    // Mettre à jour les informations utilisateur
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userEmail').textContent = currentUser.email;
    document.getElementById('userAvatar').src = currentUser.picture;
    document.getElementById('userAvatar').alt = `Avatar de ${currentUser.name}`;

  }

  // Afficher l'état déconnecté
  function showLoggedOutState() {
    const profileNotLogged = document.getElementById('profileNotLogged');
    const profileLogged = document.getElementById('profileLogged');

    // Afficher la page de connexion
    profileNotLogged.style.display = 'block';

    // Masquer la page connectée
    profileLogged.style.display = 'none';

  }

  // Fonction de déconnexion
  function signOut() {
    // Supprimer les données de localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('lastLoginTime');
    currentUser = null;

    // Déconnecter de Google (si disponible)
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }

    // Afficher l'état déconnecté
    showLoggedOutState();

  }

  // Fonction pour afficher les messages d'erreur
  function showErrorMessage(message) {
    const errorModal = document.createElement('div');
    errorModal.className = 'message-modal';
    errorModal.innerHTML = `
      <div class="message-modal-content">
        <div class="message-header">
          <h3>Erreur</h3>
          <button class="message-close" aria-label="Fermer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="message-body">
          <p>${message}</p>
        </div>
      </div>
    `;

    document.body.appendChild(errorModal);
    document.body.classList.add('modal-open');

    setTimeout(() => errorModal.classList.add('open'), 10);

    const closeBtn = errorModal.querySelector('.message-close');
    closeBtn.addEventListener('click', () => {
      errorModal.classList.remove('open');
      setTimeout(() => {
        document.body.removeChild(errorModal);
        document.body.classList.remove('modal-open');
      }, 300);
    });

    errorModal.addEventListener('click', (e) => {
      if (e.target === errorModal) {
        closeBtn.click();
      }
    });
  }

  // Fonction pour afficher les salles dans le DOM
  function renderRooms() {
    const grid = document.getElementById('roomsGrid');
    grid.innerHTML = '';

    Object.keys(roomData).forEach(roomNumber => {
      const status = roomStatuses[roomNumber] || 'libre';


      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('data-status', status);
      card.innerHTML = `
        <div class="room-number">${roomNumber}</div>
        <div class="room-state">${status}</div>
      `;

      // Ajouter l'event listener pour ouvrir le modal
      card.addEventListener('click', function() {
        openRoomModal(roomNumber, status);
      });

      grid.appendChild(card);
    });

    // Appliquer les filtres après avoir rendu les salles
    filterRooms();
  }

  // Fonction pour synchroniser les checkboxes avec les filtres par défaut
  function initializeFilters() {
    // Synchroniser les checkboxes de statut
    document.getElementById('filter-libre').checked = currentFilters.status.includes('libre');
    document.getElementById('filter-occupe').checked = currentFilters.status.includes('occupé');

    // Synchroniser les checkboxes d'Epis
    document.getElementById('filter-rue').checked = currentFilters.epis.includes('Rue');
    document.getElementById('filter-epis1').checked = currentFilters.epis.includes('Epis 1');
    document.getElementById('filter-epis2').checked = currentFilters.epis.includes('Epis 2');
    document.getElementById('filter-epis3').checked = currentFilters.epis.includes('Epis 3');
    document.getElementById('filter-epis4').checked = currentFilters.epis.includes('Epis 4');
    document.getElementById('filter-epis5').checked = currentFilters.epis.includes('Epis 5');

    // Synchroniser les checkboxes d'étages
    document.getElementById('filter-floor0').checked = currentFilters.floors.includes('Rez-de-chaussée');
    document.getElementById('filter-floor1').checked = currentFilters.floors.includes('1er étage');
    document.getElementById('filter-floor2').checked = currentFilters.floors.includes('2ème étage');
    document.getElementById('filter-floor3').checked = currentFilters.floors.includes('3ème étage');
    document.getElementById('filter-floor4').checked = currentFilters.floors.includes('4ème étage');
  }

  // Initialiser l'état
  handleScroll();

  // Synchroniser les filtres au chargement
  document.addEventListener('DOMContentLoaded', initializeFilters);

  // Charger les données au démarrage
  loadRoomsFromAPI();

  // Forcer la mise à jour du service worker pour éviter les problèmes de cache
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => {
        registration.update();
      });
    });
  }

  // Initialiser l'authentification Google
  initializeGoogleAuth();
});