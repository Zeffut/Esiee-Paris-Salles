// =============================================================================
// TRACKING DES RECHARGES (pour détecter les boucles)
// =============================================================================
const reloadCount = parseInt(sessionStorage.getItem('reloadCount') || '0');
sessionStorage.setItem('reloadCount', (reloadCount + 1).toString());

// Alert si trop de recharges en peu de temps (possible live reload actif)
if (reloadCount > 5) {
  console.warn('⚠️ Plus de 5 recharges détectés. Si vous utilisez Live Server, désactivez-le.');
}

// =============================================================================
// POPUPS PERSONNALISÉS
// =============================================================================

// Fonction pour afficher un alert personnalisé
function customAlert(message, title = 'Information') {
  return new Promise((resolve) => {
    const overlay = document.getElementById('customAlertOverlay');
    const titleElement = document.getElementById('customAlertTitle');
    const messageElement = document.getElementById('customAlertMessage');
    const btn = document.getElementById('customAlertBtn');

    titleElement.textContent = title;
    messageElement.textContent = message;
    overlay.classList.add('show');

    const closeHandler = () => {
      overlay.classList.remove('show');
      btn.removeEventListener('click', closeHandler);
      resolve();
    };

    btn.addEventListener('click', closeHandler);
  });
}

// Fonction pour afficher un confirm personnalisé
function customConfirm(message, title = 'Confirmation') {
  return new Promise((resolve) => {
    const overlay = document.getElementById('customConfirmOverlay');
    const titleElement = document.getElementById('customConfirmTitle');
    const messageElement = document.getElementById('customConfirmMessage');
    const btnConfirm = document.getElementById('customConfirmBtn');
    const btnCancel = document.getElementById('customConfirmCancel');

    titleElement.textContent = title;
    messageElement.textContent = message;
    overlay.classList.add('show');

    const confirmHandler = () => {
      overlay.classList.remove('show');
      btnConfirm.removeEventListener('click', confirmHandler);
      btnCancel.removeEventListener('click', cancelHandler);
      resolve(true);
    };

    const cancelHandler = () => {
      overlay.classList.remove('show');
      btnConfirm.removeEventListener('click', confirmHandler);
      btnCancel.removeEventListener('click', cancelHandler);
      resolve(false);
    };

    btnConfirm.addEventListener('click', confirmHandler);
    btnCancel.addEventListener('click', cancelHandler);
  });
}

// Rendre les fonctions disponibles globalement
window.customAlert = customAlert;
window.customConfirm = customConfirm;

// =============================================================================
// SERVICE WORKERS
// =============================================================================

// DÉSINSTALLATION DES SERVICE WORKERS - TEMPORAIREMENT DÉSACTIVÉ POUR DEBUG GOOGLE OAUTH
// (async function() {
//   if ('serviceWorker' in navigator) {
//     try {
//       const registrations = await navigator.serviceWorker.getRegistrations();
//       for (let registration of registrations) {
//         await registration.unregister();
//         console.log('Service Worker désinscrit:', registration.scope);
//       }
//     } catch (error) {
//       console.error('Erreur lors de la désinscription des service workers:', error);
//     }
//   }
// })();

// SYSTÈME DE NETTOYAGE DÉSACTIVÉ - Causait des boucles de rechargement
// Pour nettoyer manuellement : ouvrir la console et taper localStorage.clear()

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
        case '6': return 'Epis 6';
        case '7': return 'Epis 7';
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
  const API_BASE_URL = 'https://api.zeffut.fr/api';

  // Fonction pour calculer le statut d'une salle en temps réel
  function calculateRoomStatus(roomNumber) {
    const schedule = roomSchedules[roomNumber];
    const now = new Date();

    // Vérifier d'abord les réservations actives
    if (window.activeReservations && Array.isArray(window.activeReservations)) {
      for (const reservation of window.activeReservations) {
        if (reservation.room_number === roomNumber) {
          const startTime = new Date(reservation.start_time);
          const endTime = new Date(reservation.end_time);

          // Vérifier si la réservation est active maintenant
          if (startTime <= now && now < endTime) {
            return 'occupé';
          }
        }
      }
    }

    // Puis vérifier les événements de l'emploi du temps
    if (schedule && schedule.length > 0) {
      // Parcourir les événements pour voir si un cours est en cours
      for (const event of schedule) {
        const startTime = new Date(event.start);
        const endTime = new Date(event.end);

        // Vérifier si nous sommes dans la plage horaire du cours
        if (startTime <= now && now < endTime) {
          return 'occupé';
        }
      }
    }

    return 'libre';
  }

  // Fonction pour mettre à jour tous les statuts des salles
  function updateAllRoomStatuses() {
    for (const roomNumber in roomSchedules) {
      roomStatuses[roomNumber] = calculateRoomStatus(roomNumber);
    }
  }

  // Fonction pour obtenir le prochain cours d'une salle
  function getNextCourse(roomNumber) {
    const schedule = roomSchedules[roomNumber];
    if (!schedule || schedule.length === 0) {
      return null;
    }

    const now = new Date();

    for (const event of schedule) {
      const startTime = new Date(event.start);

      if (startTime > now) {
        return {
          start: startTime,
          end: new Date(event.end),
          summary: event.summary
        };
      }
    }

    return null; // Aucun cours à venir
  }

  // Fonction pour obtenir le cours en cours d'une salle
  function getCurrentCourse(roomNumber) {
    const schedule = roomSchedules[roomNumber];
    if (!schedule || schedule.length === 0) {
      return null;
    }

    const now = new Date();

    for (const event of schedule) {
      const startTime = new Date(event.start);
      const endTime = new Date(event.end);

      if (startTime <= now && now < endTime) {
        return {
          start: startTime,
          end: endTime,
          summary: event.summary
        };
      }
    }

    return null;
  }


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
  let roomSchedules = {}; // Emplois du temps des salles pour calcul temps réel

  // État des filtres - Afficher toutes les salles par défaut
  let currentFilters = {
    status: ['libre'],
    type: ['Salle classique', 'Amphithéâtre'],
    epis: ['Rue', 'Epis 1', 'Epis 2', 'Epis 3', 'Epis 4'],
    floors: ['Rez-de-chaussée', '1er étage', '2ème étage', '3ème étage', '4ème étage']
  };

  // Variable pour stocker le numéro de salle actuel dans le modal
  let currentModalRoomNumber = null;

  // Ouvrir le modal de détails d'une salle
  async function openRoomModal(roomNumber, roomStatus) {
    currentModalRoomNumber = roomNumber;

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
    // Utiliser l'emploi du temps déjà chargé si disponible
    if (roomSchedules[roomNumber]) {
      displayTodayScheduleFromCache(roomNumber);
      return;
    }

    // Fallback : charger depuis l'API
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

  // Afficher l'emploi du temps depuis le cache local
  function displayTodayScheduleFromCache(roomNumber) {
    const schedule = roomSchedules[roomNumber] || [];

    // Filtrer les événements d'aujourd'hui
    const now = new Date();
    const today = now.toDateString();

    const todayEvents = schedule.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate.toDateString() === today;
    });

    // Ajouter les réservations actives pour cette salle
    const todayReservations = [];
    if (window.activeReservations && Array.isArray(window.activeReservations)) {
      for (const reservation of window.activeReservations) {
        if (reservation.room_number === roomNumber) {
          const reservationDate = new Date(reservation.start_time);
          if (reservationDate.toDateString() === today) {
            todayReservations.push({
              start: new Date(reservation.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              end: new Date(reservation.end_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              course: `🔒 Réservation de ${reservation.user_name || 'Utilisateur'}`,
              isReservation: true
            });
          }
        }
      }
    }

    // Combiner les événements et les réservations
    const allEvents = [
      ...todayEvents.map(event => ({
        start: new Date(event.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        end: new Date(event.end).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        course: event.summary,
        isReservation: false
      })),
      ...todayReservations
    ];

    // Trier par heure de début
    allEvents.sort((a, b) => {
      const timeA = a.start.split(':').map(Number);
      const timeB = b.start.split(':').map(Number);
      return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
    });

    // Convertir en format attendu par displayTodaySchedule
    const formattedSchedule = {
      [getDayName(now.getDay()).toLowerCase()]: allEvents
    };

    displayTodaySchedule(formattedSchedule);
  }

  // Fonction utilitaire pour obtenir le nom du jour
  function getDayName(dayIndex) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[dayIndex];
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
    if (document.getElementById('filter-epis6').checked) currentFilters.epis.push('Epis 6');
    if (document.getElementById('filter-epis7').checked) currentFilters.epis.push('Epis 7');

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

  // Event listener pour le bouton de réservation dans le modal de salle
  const roomModalReserveBtn = document.getElementById('roomModalReserveBtn');
  if (roomModalReserveBtn) {
    roomModalReserveBtn.addEventListener('click', () => {
      if (currentModalRoomNumber) {
        closeRoomModal();
        openReservationModal(currentModalRoomNumber);
      }
    });
  }

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
      // Charger les salles et les réservations actives en parallèle
      const [roomsResponse, reservationsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/rooms`),
        fetch(`${API_BASE_URL}/reservations/active`)
      ]);

      if (roomsResponse.ok) {
        const data = await roomsResponse.json();

        // Charger les réservations actives si disponibles
        if (reservationsResponse.ok) {
          const reservationsData = await reservationsResponse.json();
          if (reservationsData.success && reservationsData.reservations) {
            // Stocker les réservations actives globalement
            window.activeReservations = reservationsData.reservations;
          }
        }

        // Vérifier si l'API supporte le calcul côté client
        if (data.client_status_calculation && data.room_schedules) {
          // Charger les emplois du temps
          roomSchedules = data.room_schedules;

          // Convertir le format de l'API
          roomData = {};

          if (data.rooms_list && Array.isArray(data.rooms_list)) {
            data.rooms_list.forEach(room => {
              roomData[room.number] = {
                name: room.name,
                board: room.board,
                capacity: room.capacity,
                type: room.type
              };
            });
          }

          // Calculer les statuts en temps réel côté client
          updateAllRoomStatuses();

        } else if (data.rooms_list && Array.isArray(data.rooms_list)) {
          // Fallback : ancien format avec statuts pré-calculés

          roomData = {};
          roomStatuses = {};

          data.rooms_list.forEach(room => {
            roomData[room.number] = {
              name: room.name,
              board: room.board,
              capacity: room.capacity,
              type: room.type
            };
            roomStatuses[room.number] = room.status || 'libre';
          });

        } else {
          // Fallback vers les données par défaut
          roomData = data.rooms || defaultRoomData;
          roomStatuses = data.statuses || defaultRoomStatuses;
        }

        hideAPIError();
        renderRooms();
      } else {
        throw new Error('API non disponible');
      }
    } catch (error) {
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

  // ==============================
  // GOOGLE AUTH - VERSION CORRIGÉE
  // ==============================

  // Client ID Google (configuré dans Google Cloud Console)
  const GOOGLE_CLIENT_ID = '280602510509-ep76jc9na5ae6qbdmcfm7sria30c0acb.apps.googleusercontent.com';

  // Utilisateur connecté et token de session
  let currentUser = null;
  let authToken = null;
  let isLoggingIn = false; // Protection contre les appels multiples
  let googleAuthInitialized = false; // Protection contre les initialisations multiples
  let lastShowLoggedInStateTime = 0; // Protection contre doubles appels showLoggedInState

  // Initialisation de Google Identity Services
  function initializeGoogleAuth() {
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
      try {
        // Initialiser Google Identity Services
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true
        });

        // Vérifier si l'utilisateur est déjà connecté
        checkExistingAuth();
      } catch (error) {
        console.error('Erreur lors de l\'initialisation Google Auth:', error);
      }
    } else {
      // Google pas encore chargé → réessayer
      setTimeout(initializeGoogleAuth, 1000);
    }
  }

  // Déclencher la connexion Google (appelé par le bouton #loginBtn)
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

      if (!response.ok) {
        throw new Error('Erreur lors de la récupération du profil');
      }

      const userInfo = await response.json();

      // Créer un pseudo-credential JWT pour le backend
      // Le backend devra être modifié pour accepter ce format alternatif
      const pseudoCredential = btoa(JSON.stringify({
        sub: userInfo.id,
        name: userInfo.name,
        email: userInfo.email,
        picture: userInfo.picture
      }));

      // Essayer d'authentifier avec le backend
      try {
        const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            credential: pseudoCredential,
            oauth_token: accessToken
          })
        });

        const result = await loginResponse.json();

        if (result.success) {
          currentUser = result.user;
          authToken = result.session_token;

          localStorage.setItem('user', JSON.stringify(currentUser));
          localStorage.setItem('authToken', authToken);
          localStorage.setItem('lastLoginTime', Date.now().toString());

          showLoggedInState();
          return;
        }
      } catch (backendError) {
        console.warn('Backend non disponible, connexion locale uniquement:', backendError);
      }

      // Fallback : connexion locale
      currentUser = {
        id: userInfo.id,
        name: userInfo.name,
        email: userInfo.email,
        picture: userInfo.picture,
        token: accessToken
      };
      authToken = null;

      localStorage.setItem('user', JSON.stringify(currentUser));
      localStorage.setItem('lastLoginTime', Date.now().toString());
      showLoggedInState();

    } catch (error) {
      console.error('Erreur fetchUserInfoWithToken:', error);
      showErrorMessage('Erreur lors de la connexion');
    }
  }

  async function handleCredentialResponse(response) {
    if (currentUser && localStorage.getItem('user')) return;
    if (isLoggingIn) return;

    isLoggingIn = true;

    try {
      const userInfo = parseJwt(response.credential);

      // Essayer d'authentifier avec le backend
      try {
        const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: response.credential })
        });

        const result = await loginResponse.json();

        if (result.success) {
          currentUser = result.user;
          authToken = result.session_token;

          localStorage.setItem('user', JSON.stringify(currentUser));
          localStorage.setItem('authToken', authToken);
          localStorage.setItem('lastLoginTime', Date.now().toString());

          isLoggingIn = false;
          showLoggedInState();
          return;
        }
      } catch (backendError) {
        console.warn('⚠️ Backend non disponible, connexion locale:', backendError);
      }

      // Fallback: connexion locale sans backend
      currentUser = {
        id: userInfo.sub,
        name: userInfo.name,
        email: userInfo.email,
        picture: userInfo.picture,
        token: response.credential
      };
      authToken = null;

      localStorage.setItem('user', JSON.stringify(currentUser));
      localStorage.setItem('lastLoginTime', Date.now().toString());

      isLoggingIn = false;
      showLoggedInState();

    } catch (error) {
      console.error('❌ Erreur handleCredentialResponse:', error);
      isLoggingIn = false;
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

  // Variable pour éviter les appels multiples à checkExistingAuth
  let authCheckInProgress = false;

  async function checkExistingAuth() {
    if (authCheckInProgress) return;

    authCheckInProgress = true;

    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('authToken');
    const lastLoginTime = localStorage.getItem('lastLoginTime');

    if (storedUser) {
      try {
        currentUser = JSON.parse(storedUser);
        authToken = storedToken;

        // Vérifier l'âge de la session (7 jours max)
        const now = Date.now();
        const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

        if (lastLoginTime) {
          const sessionAge = now - parseInt(lastLoginTime);
          if (sessionAge >= sevenDaysInMs) {
            authCheckInProgress = false;
            signOut();
            return;
          }
        }

        // Vérifier le token backend s'il existe
        if (authToken) {
          try {
            const response = await fetch(`${API_BASE_URL}/auth/verify`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              }
            });

            const result = await response.json();

            if (result.success) {
              currentUser = result.user;
              localStorage.setItem('user', JSON.stringify(currentUser));
              authCheckInProgress = false;
              showLoggedInState();
              return;
            } else {
              authCheckInProgress = false;
              signOut();
              return;
            }
          } catch (error) {
            console.warn('⚠️ Impossible de vérifier le token backend:', error);
          }
        }

        // Mode session locale
        authCheckInProgress = false;
        showLoggedInState();

      } catch (error) {
        console.error('❌ Erreur lors de la vérification de la session:', error);
        authCheckInProgress = false;
        signOut();
      }
    } else {
      authCheckInProgress = false;
    }
  }


  function showLoggedInState() {
    const now = Date.now();
    if (now - lastShowLoggedInStateTime < 1000) return;
    lastShowLoggedInStateTime = now;

    const profileNotLogged = document.getElementById('profileNotLogged');
    const profileLogged = document.getElementById('profileLogged');

    if (!profileNotLogged || !profileLogged) {
      console.error('❌ Éléments de profil non trouvés');
      return;
    }

    // Masquer la page de connexion
    profileNotLogged.style.display = 'none';

    // Afficher la page connectée
    profileLogged.style.display = 'block';

    // Mettre à jour les informations utilisateur
    const userNameEl = document.getElementById('userName');
    const userEmailEl = document.getElementById('userEmail');
    const userAvatarEl = document.getElementById('userAvatar');

    if (userNameEl) userNameEl.textContent = currentUser.name || 'Utilisateur';
    if (userEmailEl) userEmailEl.textContent = currentUser.email || '';

    const userAvatarIcon = document.getElementById('userAvatarIcon');
    if (userAvatarEl && currentUser.picture) {
      userAvatarEl.src = currentUser.picture;
      userAvatarEl.alt = `Avatar de ${currentUser.name}`;
      userAvatarEl.style.display = 'block';
      if (userAvatarIcon) userAvatarIcon.style.display = 'none';

      userAvatarEl.onerror = function() {
        this.style.display = 'none';
        if (userAvatarIcon) userAvatarIcon.style.display = 'block';
      };
    } else {
      if (userAvatarIcon) userAvatarIcon.style.display = 'block';
      if (userAvatarEl) userAvatarEl.style.display = 'none';
    }

    if (!authToken) {
      console.warn('⚠️ Mode dégradé : réservations non disponibles');
    }

    try {
      updateReservationsDisplay();
    } catch (error) {
      console.error('❌ Erreur mise à jour réservations:', error);
    }
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

  // Déconnexion
  async function signOut() {
    // Si on a un token backend, informer le serveur de la déconnexion
    if (authToken) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        console.warn('Erreur lors de la déconnexion backend:', error);
      }
    }

    // Supprimer les données de localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    localStorage.removeItem('lastLoginTime');
    currentUser = null;
    authToken = null;

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

  // =============================================================================
  // GESTION DES RÉSERVATIONS
  // =============================================================================

  // Fonction pour mettre à jour l'affichage des réservations
  function updateReservationsDisplay() {
    if (!currentUser || !currentUser.reservations) {
      return;
    }

    const reservations = currentUser.reservations.history || [];
    const activeReservations = reservations.filter(r => r.status === 'active' || r.status === 'upcoming');

    // Mettre à jour le compteur
    const countElement = document.getElementById('reservationsCount');
    if (countElement) {
      countElement.textContent = activeReservations.length;
    }

    // Mettre à jour le contenu
    const contentElement = document.getElementById('reservationsContent');
    const noReservationsElement = document.getElementById('noReservations');

    if (!contentElement) return;

    if (activeReservations.length === 0) {
      // Afficher l'état vide
      if (noReservationsElement) {
        noReservationsElement.style.display = 'flex';
      }
      // Supprimer les cartes existantes
      const existingCards = contentElement.querySelectorAll('.reservation-card');
      existingCards.forEach(card => card.remove());
      // Supprimer le message "plus de réservations"
      const moreMessage = contentElement.querySelector('.more-reservations-message');
      if (moreMessage) moreMessage.remove();
    } else {
      // Masquer l'état vide
      if (noReservationsElement) {
        noReservationsElement.style.display = 'none';
      }

      // Supprimer les cartes existantes
      const existingCards = contentElement.querySelectorAll('.reservation-card');
      existingCards.forEach(card => card.remove());
      // Supprimer l'ancien message "plus de réservations"
      const oldMoreMessage = contentElement.querySelector('.more-reservations-message');
      if (oldMoreMessage) oldMoreMessage.remove();

      // Limiter à 5 réservations maximum
      const maxReservations = 5;
      const displayedReservations = activeReservations.slice(0, maxReservations);
      const remainingCount = activeReservations.length - maxReservations;

      // Créer les cartes de réservation
      displayedReservations.forEach(reservation => {
        const card = createReservationCard(reservation);
        contentElement.appendChild(card);
      });

      // Afficher un message s'il y a plus de 5 réservations
      if (remainingCount > 0) {
        const moreMessage = document.createElement('div');
        moreMessage.className = 'more-reservations-message';
        moreMessage.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>Et ${remainingCount} autre${remainingCount > 1 ? 's' : ''} réservation${remainingCount > 1 ? 's' : ''}</span>
        `;
        contentElement.appendChild(moreMessage);
      }
    }
  }

  // Fonction pour créer une carte de réservation
  function createReservationCard(reservation) {
    const card = document.createElement('div');
    card.className = 'reservation-card';

    const now = new Date();
    const startTime = new Date(reservation.start_time);
    const endTime = new Date(reservation.end_time);

    // Déterminer le statut
    let status = 'upcoming';
    let statusText = 'À venir';

    if (now >= startTime && now <= endTime) {
      status = 'active';
      statusText = 'En cours';
    } else if (now > endTime) {
      status = 'past';
      statusText = 'Terminée';
    }

    // Formater les dates
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    const dateStr = startTime.toLocaleDateString('fr-FR', options);
    const timeStr = `${startTime.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})} - ${endTime.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}`;

    card.innerHTML = `
      <div class="reservation-header">
        <h4 class="reservation-room">Salle ${reservation.room_number}</h4>
        <span class="reservation-status ${status}">${statusText}</span>
      </div>
      <div class="reservation-details">
        <div class="reservation-time">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <polyline points="12,6 12,12 16,14" stroke="currentColor" stroke-width="2"/>
          </svg>
          <span>${dateStr}</span>
        </div>
        <div class="reservation-time">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
            <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2"/>
            <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2"/>
            <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"/>
          </svg>
          <span>${timeStr}</span>
        </div>
      </div>
      ${status !== 'past' ? `
        <div class="reservation-actions">
          <button class="reservation-btn cancel" onclick="cancelReservation('${reservation.id}')">
            Annuler
          </button>
        </div>
      ` : ''}
    `;

    return card;
  }

  // Fonction pour afficher les détails d'une réservation
  function viewReservationDetails(reservationId) {
    console.log('Affichage des détails de la réservation:', reservationId);
    // TODO: Implémenter modal de détails
  }

  // Fonction pour annuler une réservation
  async function cancelReservation(reservationId) {
    const confirmed = await customConfirm('Êtes-vous sûr de vouloir annuler cette réservation ?', 'Annuler la réservation');
    if (!confirmed) {
      return;
    }

    // Vérifier que l'utilisateur a un token
    if (!authToken) {
      // Tenter de récupérer le token depuis localStorage
      const storedToken = localStorage.getItem('authToken');
      if (storedToken) {
        authToken = storedToken;
      } else {
        await customAlert('Session expirée. Veuillez vous reconnecter.', 'Session expirée');
        signOut();
        return;
      }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/reservations/${reservationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      // Vérifier si le token est invalide
      if (response.status === 401 || response.status === 403) {
        await customAlert('Session expirée. Veuillez vous reconnecter.', 'Session expirée');
        signOut();
        return;
      }

      if (data.success) {
        // Mettre à jour les réservations localement
        if (currentUser && currentUser.reservations) {
          currentUser.reservations.history = data.reservations;
          currentUser.reservations.total = data.reservations.length;
          currentUser.reservations.active = data.reservations.filter(r => r.status === 'active' || r.status === 'upcoming').length;
        }

        // Recharger les réservations actives pour mettre à jour les statuts des salles
        try {
          const reservationsResponse = await fetch(`${API_BASE_URL}/reservations/active`);
          if (reservationsResponse.ok) {
            const reservationsData = await reservationsResponse.json();
            if (reservationsData.success) {
              window.activeReservations = reservationsData.reservations;
              updateAllRoomStatuses();
              renderRooms();
            }
          }
        } catch (error) {
          console.error('Erreur lors du rechargement des réservations actives:', error);
        }

        // Rafraîchir l'affichage
        updateReservationsDisplay();
      } else {
        await customAlert(data.error || 'Erreur lors de l\'annulation de la réservation', 'Erreur');
      }
    } catch (error) {
      console.error('Erreur lors de l\'annulation:', error);
      await customAlert('Erreur lors de l\'annulation de la réservation', 'Erreur');
    }
  }

  // Rendre les fonctions disponibles globalement
  window.viewReservationDetails = viewReservationDetails;
  window.cancelReservation = cancelReservation;

  // =============================================================================
  // SYSTÈME DE RÉSERVATION
  // =============================================================================

  let selectedRoomNumber = null;

  // Fonction pour ouvrir le modal de réservation
  async function openReservationModal(roomNumber) {
    // Vérifier si l'utilisateur est connecté
    if (!currentUser) {
      await customAlert('Vous devez être connecté pour réserver une salle', 'Connexion requise');
      return;
    }

    // Vérifier si l'utilisateur a un token backend (nécessaire pour les réservations)
    if (!authToken) {
      await customAlert(
        'Le système de réservation nécessite une connexion au serveur. Veuillez vous reconnecter.',
        'Connexion au serveur requise'
      );
      // Déconnecter et forcer une nouvelle connexion
      signOut();
      return;
    }

    // Vérifier si l'utilisateur a déjà une réservation active (non terminée)
    const now = new Date();
    const activeReservations = currentUser?.reservations?.history?.filter(r => {
      if (r.status === 'active' || r.status === 'upcoming') {
        const endTime = new Date(r.end_time);
        return endTime > now; // Vérifier que l'heure de fin n'est pas passée
      }
      return false;
    }) || [];

    if (activeReservations.length > 0) {
      await customAlert('Vous avez déjà une réservation active. Annulez-la avant d\'en créer une nouvelle.', 'Réservation existante');
      return;
    }

    selectedRoomNumber = roomNumber;
    const modal = document.getElementById('reservationModal');
    const modalTitle = document.getElementById('reservationModalTitle');

    modalTitle.textContent = `Réserver la salle ${roomNumber}`;

    // Initialiser le formulaire
    initializeReservationForm(roomNumber);

    // Ouvrir le modal
    modal.classList.add('open');
    document.body.classList.add('modal-open');
  }

  // Fonction pour initialiser le formulaire de réservation
  function initializeReservationForm(roomNumber) {
    const timeSlotSelect = document.getElementById('reservationTimeSlot');

    // Générer les créneaux horaires disponibles (dans les 2h à venir uniquement)
    generateAvailableTimeSlots(roomNumber, timeSlotSelect);
  }

  // Fonction pour générer les créneaux horaires disponibles (dans les 2h à venir)
  function generateAvailableTimeSlots(roomNumber, selectElement) {
    selectElement.innerHTML = '<option value="">Sélectionnez un créneau</option>';

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Commencer à l'heure actuelle (pas la suivante)
    let startHour = currentHour;

    // Limiter aux 2 heures à venir (incluant l'heure actuelle)
    const maxHour = Math.min(startHour + 2, 23); // Maximum 23h

    // Récupérer l'emploi du temps de la salle
    const schedule = roomSchedules[roomNumber] || [];

    let hasAvailableSlots = false;

    // Générer les créneaux
    for (let hour = startHour; hour < maxHour; hour++) {
      const timeStr = `${String(hour).padStart(2, '0')}:00`;
      const endTimeStr = `${String(hour + 1).padStart(2, '0')}:00`;

      // Vérifier si le créneau est disponible
      const isAvailable = !isTimeSlotOccupied(schedule, timeStr, endTimeStr);

      const option = document.createElement('option');
      option.value = `${timeStr}-${endTimeStr}`;

      // Indiquer si c'est le créneau actuel
      const isCurrent = hour === currentHour;
      option.textContent = `${timeStr} - ${endTimeStr}${isCurrent ? ' (Maintenant)' : ''}${!isAvailable ? ' (Occupé)' : ''}`;
      option.disabled = !isAvailable;

      selectElement.appendChild(option);

      if (isAvailable) {
        hasAvailableSlots = true;
      }
    }

    // Si aucun créneau n'est disponible
    if (!hasAvailableSlots) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Aucun créneau disponible';
      option.disabled = true;
      selectElement.appendChild(option);
    }
  }

  // Fonction pour vérifier si un créneau est occupé
  function isTimeSlotOccupied(schedule, startTime, endTime) {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    for (const event of schedule) {
      const [eventStartHour, eventStartMin] = event.start.split(':').map(Number);
      const [eventEndHour, eventEndMin] = event.end.split(':').map(Number);

      // Vérifier le chevauchement
      const requestStart = startHour * 60 + startMin;
      const requestEnd = endHour * 60 + endMin;
      const eventStart = eventStartHour * 60 + eventStartMin;
      const eventEnd = eventEndHour * 60 + eventEndMin;

      if (requestStart < eventEnd && requestEnd > eventStart) {
        return true; // Chevauchement détecté
      }
    }

    return false;
  }

  // Gérer la fermeture du modal de réservation
  const reservationModal = document.getElementById('reservationModal');
  const reservationModalClose = document.getElementById('reservationModalClose');
  const cancelReservationBtn = document.getElementById('cancelReservation');

  if (reservationModalClose) {
    reservationModalClose.addEventListener('click', () => {
      reservationModal.classList.remove('open');
      document.body.classList.remove('modal-open');
      document.getElementById('reservationForm').reset();
    });
  }

  if (cancelReservationBtn) {
    cancelReservationBtn.addEventListener('click', () => {
      reservationModal.classList.remove('open');
      document.body.classList.remove('modal-open');
      document.getElementById('reservationForm').reset();
    });
  }

  // Gérer la soumission du formulaire
  const reservationForm = document.getElementById('reservationForm');
  if (reservationForm) {
    reservationForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const timeSlot = document.getElementById('reservationTimeSlot').value;

      if (!timeSlot) {
        await customAlert('Veuillez sélectionner un créneau', 'Créneau manquant');
        return;
      }

      // Extraire l'heure de début et de fin du créneau
      const [startTime, endTime] = timeSlot.split('-');

      // Vérifier que l'utilisateur a un token
      if (!authToken) {
        // Tenter de récupérer le token depuis localStorage
        const storedToken = localStorage.getItem('authToken');
        if (storedToken) {
          authToken = storedToken;
        } else {
          await customAlert('Session expirée. Veuillez vous reconnecter.', 'Session expirée');
          signOut();
          return;
        }
      }

      // La date est toujours aujourd'hui
      const today = new Date();
      const date = today.toISOString().split('T')[0];

      try {
        const response = await fetch(`${API_BASE_URL}/reservations`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            room_number: selectedRoomNumber,
            date: date,
            start_time: startTime,
            end_time: endTime
          })
        });

        const data = await response.json();

        // Vérifier si le token est invalide
        if (response.status === 401 || response.status === 403) {
          await customAlert('Session expirée. Veuillez vous reconnecter.', 'Session expirée');
          signOut();
          return;
        }

        if (data.success) {
          // Mettre à jour les réservations localement
          if (currentUser && currentUser.reservations) {
            currentUser.reservations.history = data.reservations;
            currentUser.reservations.total = data.reservations.length;
            currentUser.reservations.active = data.reservations.filter(r => r.status === 'active' || r.status === 'upcoming').length;
          }

          // Recharger les réservations actives pour mettre à jour les statuts des salles
          try {
            const reservationsResponse = await fetch(`${API_BASE_URL}/reservations/active`);
            if (reservationsResponse.ok) {
              const reservationsData = await reservationsResponse.json();
              if (reservationsData.success) {
                window.activeReservations = reservationsData.reservations;
                updateAllRoomStatuses();
                renderRooms();
              }
            }
          } catch (error) {
            console.error('Erreur lors du rechargement des réservations actives:', error);
          }

          // Fermer le modal
          reservationModal.classList.remove('open');
          document.body.classList.remove('modal-open');
          reservationForm.reset();

          // Rafraîchir l'affichage des réservations
          updateReservationsDisplay();

          await customAlert('Réservation confirmée !', 'Succès');
        } else {
          await customAlert(data.error || 'Erreur lors de la réservation', 'Erreur');
        }
      } catch (error) {
        console.error('Erreur lors de la réservation:', error);
        await customAlert('Erreur lors de la réservation', 'Erreur');
      }
    });
  }

  // Rendre la fonction disponible globalement
  window.openReservationModal = openReservationModal;

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

      // Ajouter l'event listener pour ouvrir le modal de détails
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
    document.getElementById('filter-epis6').checked = currentFilters.epis.includes('Epis 6');
    document.getElementById('filter-epis7').checked = currentFilters.epis.includes('Epis 7');

    // Synchroniser les checkboxes d'étages
    document.getElementById('filter-floor0').checked = currentFilters.floors.includes('Rez-de-chaussée');
    document.getElementById('filter-floor1').checked = currentFilters.floors.includes('1er étage');
    document.getElementById('filter-floor2').checked = currentFilters.floors.includes('2ème étage');
    document.getElementById('filter-floor3').checked = currentFilters.floors.includes('3ème étage');
    document.getElementById('filter-floor4').checked = currentFilters.floors.includes('4ème étage');
  }

  // Initialiser l'état
  handleScroll();

  // Synchroniser les filtres au chargement (appel direct au lieu d'un event listener)
  initializeFilters();

  // Fonction pour démarrer la mise à jour temps réel
  function startRealTimeUpdates() {
    // Mettre à jour les statuts toutes les 30 secondes
    setInterval(() => {
      if (Object.keys(roomSchedules).length > 0) {
        const oldStatuses = { ...roomStatuses };
        updateAllRoomStatuses();

        // Vérifier si des statuts ont changé
        let hasChanged = false;
        for (const roomNumber in roomStatuses) {
          if (oldStatuses[roomNumber] !== roomStatuses[roomNumber]) {
            hasChanged = true;
          }
        }

        // Re-rendre seulement si nécessaire
        if (hasChanged) {
          renderRooms();
          console.log('✅ Interface mise à jour avec nouveaux statuts temps réel');
        }
      }
    }, 30000); // 30 secondes
  }

  // Charger les données au démarrage
  loadRoomsFromAPI();

  // Démarrer les mises à jour temps réel
  startRealTimeUpdates();

  // Initialiser l'authentification Google
  initializeGoogleAuth();

});