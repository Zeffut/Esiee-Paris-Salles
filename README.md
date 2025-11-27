Esiee-Paris-Salles - Documentation simple

Objectif
- Fournit une vue d’ensemble de l’application Esiee-Paris-Salles et de ses composants principaux (backend API et frontend).

Contexte
- Application destinée à décrire et documenter les composants utilisés pour afficher les salles et les réservations, sans implication d’exécution ni de test.

Architecture et stack (niveau informationnel)
- Backend: Python (répertoire api/)
- Frontend: code client dans frontend/
- Hébergement: frontend sur esieesalles.vercel.app; API accessible via /api sur le même domaine ou sur esiee.*.fr/api selon l’hébergement

Structure du dépôt
- api/ – code serveur de l’API
- frontend/ – code client (HTML/JS/CSS ou framework utilisé)
- README.md – documentation du projet

Modèles de données (indicatifs)
- Salle
  - id
  - nom
  - capacite
  - type_salle
  - etage
  - etat
  - equipements
- Réservation
  - id
  - salle_id
  - utilisateur_id
  - start_time
  - end_time
  - statut

Endpoints API (indicatifs, à adapter si nécessaire)
- GET /api: information générale / health
- GET /api/rooms ou /api/salles: liste des salles
- GET /api/reservations: accès aux réservations
- POST /api/reservations: créer une réservation
- GET /api/salles/{id}: détails d’une salle

Configuration et environnement
- API_BASE_URL: URL de base de l’API pour les clients (le cas échéant)
- SECRET_KEY, DATABASE_URL: selon les besoins du backend
- ENVIRONMENT: development | production

Déploiement et observations
- Frontend: https://esieesalles.vercel.app
- API: domaine esiee.*.fr ou esieesalles.vercel.app/api selon l’implémentation

Licence
- À préciser (à compléter par l’équipe).

Remarque
- Cette documentation décrit les composants et les interfaces sans instruction d’exécution ni de test du projet.
