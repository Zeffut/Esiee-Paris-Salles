// Enregistrement du Service Worker pour PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js')
      .then(function(registration) {
        console.log('✓ Service Worker enregistré:', registration.scope);

        // Vérifier les mises à jour
        registration.addEventListener('updatefound', function() {
          const newWorker = registration.installing;
          console.log('📦 Nouvelle version détectée');

          newWorker.addEventListener('statechange', function() {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nouvelle version disponible
              showUpdateNotification();
            }
          });
        });
      })
      .catch(function(error) {
        console.log('✗ Erreur Service Worker:', error);
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
  console.log('💾 PWA installable détectée');
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
        console.log('🎯 Résultat installation:', outcome);
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
  console.log('🎉 PWA installée avec succès');
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

  function getRoomFloor(roomNumber) {
    const secondDigit = roomNumber.charAt(1);
    switch(secondDigit) {
      case '0': return 'Sous-sol';
      case '1': return '1er étage';
      case '2': return '2ème étage';
      case '3': return '3ème étage';
      case '4': return '4ème étage';
      case '5': return '5ème étage';
      case '6': return '6ème étage';
      case '7': return '7ème étage';
      case '8': return '8ème étage';
      case '9': return '9ème étage';
      default: return 'Étage inconnu';
    }
  }

  // Configuration de l'API
  const API_BASE_URL = 'http://localhost:3000/api';

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

  // État des filtres
  let currentFilters = {
    status: ['libre'],
    type: ['Salle classique', 'Amphithéâtre'],
    epis: ['Rue', 'Epis 1', 'Epis 2', 'Epis 3', 'Epis 4', 'Epis 5'],
    floors: ['Sous-sol', '1er étage', '2ème étage', '3ème étage', '4ème étage', '5ème étage']
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
      console.log('Erreur lors du chargement de l\'emploi du temps');
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

    allCards.forEach(card => {
      const roomNumber = card.querySelector('.room-number').textContent;
      const roomStatus = card.querySelector('.room-state').textContent;
      const room = roomData[roomNumber] || { type: 'Salle classique' };

      // Déterminer automatiquement l'Epis et l'étage depuis le numéro de salle
      const roomEpis = getRoomEpis(roomNumber);
      const roomFloor = getRoomFloor(roomNumber);

      // Vérifier si la salle correspond aux filtres
      const statusMatch = currentFilters.status.includes(roomStatus);
      const typeMatch = currentFilters.type.includes(room.type);
      const episMatch = currentFilters.epis.includes(roomEpis);
      const floorMatch = currentFilters.floors.includes(roomFloor);

      // Afficher ou masquer la carte
      if (statusMatch && typeMatch && episMatch && floorMatch) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  }

  // Réinitialiser les filtres
  function resetFilters() {
    currentFilters = {
      status: ['libre', 'occupé'],
      type: ['Salle classique', 'Amphithéâtre'],
      epis: ['Rue', 'Epis 1', 'Epis 2', 'Epis 3', 'Epis 4', 'Epis 5'],
      floors: ['Sous-sol', '1er étage', '2ème étage', '3ème étage', '4ème étage', '5ème étage']
    };

    // Remettre toutes les checkboxes à checked
    document.querySelectorAll('.filter-checkbox input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = true;
    });

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
    if (document.getElementById('filter-floor0').checked) currentFilters.floors.push('Sous-sol');
    if (document.getElementById('filter-floor1').checked) currentFilters.floors.push('1er étage');
    if (document.getElementById('filter-floor2').checked) currentFilters.floors.push('2ème étage');
    if (document.getElementById('filter-floor3').checked) currentFilters.floors.push('3ème étage');
    if (document.getElementById('filter-floor4').checked) currentFilters.floors.push('4ème étage');
    if (document.getElementById('filter-floor5').checked) currentFilters.floors.push('5ème étage');

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

  // Event listener pour ouvrir la page profil depuis le menu
  document.getElementById('profileMenuItem').addEventListener('click', function(e) {
    e.preventDefault();
    toggleMenu(); // Fermer le menu
    openProfilePage(); // Ouvrir la page profil
  });

  // Event listener pour le bouton de connexion Google
  document.getElementById('loginBtn').addEventListener('click', function(e) {
    e.preventDefault();
    showLoginMessage();
  });

  // Event listener pour le bouton de connexion Apple
  document.getElementById('appleLoginBtn').addEventListener('click', function(e) {
    e.preventDefault();
    showLoginMessage();
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
        roomData = data.rooms || defaultRoomData;
        roomStatuses = data.statuses || defaultRoomStatuses;
        hideAPIError();
        renderRooms();
      } else {
        throw new Error('API non disponible');
      }
    } catch (error) {
      console.log('API non disponible');
      showAPIError();
      // Ne pas afficher de données si l'API n'est pas disponible
    }
  }

  // Afficher le message d'erreur API
  function showAPIError() {
    const errorMessage = document.getElementById('apiErrorMessage');
    errorMessage.style.display = 'block';
  }

  // Masquer le message d'erreur API
  function hideAPIError() {
    const errorMessage = document.getElementById('apiErrorMessage');
    errorMessage.style.display = 'none';
  }

  // Afficher un message pour la connexion
  function showLoginMessage() {
    // Créer le modal de message
    const messageModal = document.createElement('div');
    messageModal.className = 'message-modal';
    messageModal.innerHTML = `
      <div class="message-modal-content">
        <div class="message-header">
          <h3>Fonctionnalité indisponible</h3>
          <button class="message-close" aria-label="Fermer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="message-body">
          <p>Fonctionnalité indisponible pour le moment</p>
        </div>
      </div>
    `;

    document.body.appendChild(messageModal);
    document.body.classList.add('modal-open');

    // Animation d'entrée
    setTimeout(() => messageModal.classList.add('open'), 10);

    // Event listener pour fermer
    const closeBtn = messageModal.querySelector('.message-close');
    closeBtn.addEventListener('click', () => {
      messageModal.classList.remove('open');
      setTimeout(() => {
        document.body.removeChild(messageModal);
        document.body.classList.remove('modal-open');
      }, 300);
    });

    // Fermer en cliquant sur l'overlay
    messageModal.addEventListener('click', (e) => {
      if (e.target === messageModal) {
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

  // Initialiser l'état
  handleScroll();

  // Charger les données au démarrage
  loadRoomsFromAPI();
});