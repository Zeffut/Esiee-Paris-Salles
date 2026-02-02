# Esiee-Paris-Salles

Application web de consultation en temps réel des salles de l'ESIEE Paris.

## À propos

Ce projet personnel a été développé pour faciliter la consultation de la disponibilité des salles de cours à l'ESIEE Paris. L'application récupère les données d'emploi du temps depuis le système institutionnel et les présente dans une interface web moderne et responsive.

## Architecture

Le projet est composé de deux parties principales :

### Backend (API)

Une API REST développée en Flask (Python 3.13) qui :
- Extrait les données d'emploi du temps depuis les calendriers iCal de l'ESIEE
- Met en cache les informations pour optimiser les performances
- Gère l'authentification des utilisateurs via Google OAuth
- Expose des endpoints pour consulter les salles et leurs disponibilités
- Gère un système de réservations pour les utilisateurs authentifiés

**Technologies utilisées :**
- Flask 2.3.3 avec Flask-CORS
- Système de cache intelligent avec rafraîchissement automatique
- Extraction et parsing de fichiers iCal
- Rate limiting pour protéger l'API
- Déployé via Docker sur Dokploy

**Endpoints principaux :**
- `GET /api/rooms` - Liste des salles avec leur statut
- `GET /api/rooms/{room}/schedule` - Emploi du temps d'une salle
- `GET /api/reservations/active` - Réservations en cours
- `POST /api/auth/login` - Authentification utilisateur
- `POST /api/reservations` - Créer une réservation

### Frontend

Interface web statique développée en HTML/CSS/JavaScript vanilla qui :
- Affiche la liste des salles avec leur disponibilité en temps réel
- Permet de rechercher et filtrer les salles
- Affiche l'emploi du temps détaillé de chaque salle
- Propose un système d'authentification Google
- Permet aux utilisateurs connectés de réserver des salles

**Technologies utilisées :**
- HTML5 / CSS3 (design responsive)
- JavaScript vanilla (aucun framework)
- Google Identity Services pour l'authentification
- Déployé sur Vercel
- Vercel Analytics et Speed Insights pour le monitoring

## Fonctionnalités

### Consultation des salles
- Visualisation en temps réel de la disponibilité des salles
- Recherche par nom ou numéro de salle
- Filtrage par statut (libre/occupé), type (classique/amphi), bâtiment et étage
- Affichage de l'emploi du temps hebdomadaire de chaque salle

### Système d'authentification
- Connexion via compte Google
- Gestion de profil utilisateur
- Liste blanche d'emails autorisés

### Réservations
- Création de réservations pour les 2 prochaines heures
- Visualisation des réservations actives
- Gestion des réservations personnelles

## Infrastructure

### Déploiement

**Frontend :**
- Hébergé sur Vercel
- URL : `https://esiee.zeffut.fr`
- CDN global pour des performances optimales

**Backend :**
- Hébergé sur serveur Hostinger (72.60.94.131)
- Conteneurisé avec Docker via Dokploy
- Reverse proxy Nginx avec SSL (Let's Encrypt)
- URL : `https://api.zeffut.fr`

**Monitoring :**
- Dokploy pour la gestion des conteneurs : `https://dockploy.zeffut.fr`
- Vercel Analytics pour le suivi du trafic
- Vercel Speed Insights pour les performances

### Sécurité

- SSL/TLS avec certificats Let's Encrypt
- CORS configuré pour les domaines autorisés
- Rate limiting sur l'API
- Authentification Google OAuth 2.0
- Conteneur Docker avec utilisateur non-root
- Liste blanche pour limiter l'accès

## Structure du projet

```
Esiee-Paris-Salles/
├── api/                          # Backend Flask
│   ├── app.py                    # Application principale
│   ├── cache_manager.py          # Gestion du cache
│   ├── events_api.py             # Extraction des événements
│   ├── ical_extractor_final.py   # Parser iCal
│   ├── user_manager.py           # Gestion utilisateurs
│   ├── requirements.txt          # Dépendances Python
│   ├── Dockerfile               # Configuration Docker
│   └── README.md                # Documentation API
│
├── frontend/                     # Interface web
│   ├── index.html               # Page principale
│   ├── script.js                # Logique JavaScript
│   ├── styles.css               # Styles CSS
│   └── vercel.json              # Configuration Vercel
│
└── README.md                     # Ce fichier
```

## Données

Les données d'emploi du temps sont extraites directement depuis le système de planification de l'ESIEE Paris (Celcat). Le cache est actualisé automatiquement toutes les heures pour garantir la fraîcheur des informations.

**Statistiques typiques :**
- ~93 salles référencées
- ~1500 événements par semaine
- Temps de réponse API : <500ms
- Disponibilité : 99.9%

## Technologies et dépendances

### Backend
- Python 3.13
- Flask 2.3.3
- Flask-CORS 4.0.0
- pytz 2023.3
- requests 2.31.0

### Frontend
- HTML5 / CSS3
- JavaScript ES6+
- Google Identity Services

### Infrastructure
- Docker / Docker Swarm
- Dokploy (gestion de conteneurs)
- Nginx (reverse proxy)
- Let's Encrypt (SSL)
- Vercel (hébergement frontend)

## Développement

Ce projet est développé et maintenu par Zeffut pour un usage personnel à l'ESIEE Paris.

**Stack technique :**
- Image Docker multi-stage pour optimisation
- API Flask avec système de cache intelligent
- Frontend responsive sans framework
- CI/CD automatisé via Vercel et Dokploy

## Contact

Pour toute question : [portfolio.zeffut.fr](https://portfolio.zeffut.fr)

---

*Dernière mise à jour : Novembre 2025*
