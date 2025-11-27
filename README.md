Esiee-Paris-Salles - Documentation simple

Objectif
- Fournit une vue d’ensemble de l’application Esiee-Paris-Salles et de ses composants principaux (backend API et frontend). Il ne s’agit pas d’un guide d’installation ni d’un guide de test.

Contexte
- Documentation de l’architecture et des interfaces utilisées pour afficher les salles et les réservations.

Structure du dépôt
- api/ – code serveur de l’API
- frontend/ – code client
- README.md – documentation du projet

Architecture et stack (niveau informationnel)
- Backend: Python (répertoire api/)
- Frontend: code client dans frontend/
- Hébergement: frontend sur esieesalles.vercel.app; API accessible via le chemin /api sur le même domaine ou sur esiee.*.fr/api selon l’hébergement

Notes sur les endpoints (indicatifs)
- GET /api: information générale / health
- GET /api/rooms ou /api/salles: liste des salles
- GET /api/reservations: accès aux réservations
- POST /api/reservations: créer une réservation
- GET /api/salles/{id}: détails d’une salle

Configuration et environnement
- API_BASE_URL: URL de base de l’API (le cas échéant)
- ENVIRONMENT: development | production
- SECRET_KEY, DATABASE_URL: selon les besoins

Déploiement et observations
- Frontend: https://esieesalles.vercel.app
- API: domaine esiee.*.fr ou esieesalles.vercel.app/api selon l’implémentation

Licence
- À préciser (à compléter par l’équipe).

Remarque
- Cette documentation décrit les composants et les interfaces sans instructions d’exécution ni de test du projet.
