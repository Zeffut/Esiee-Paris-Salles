# Esiee-Paris-Salles

Application web permettant de consulter en temps réel la disponibilité des salles ESIEE Paris et de les réserver.

Statut: Développé et en production partielle (à compléter selon votre stade)

---

## Table des matières
- Description
- Fonctionnalités
- Architecture et stack technologique
- Déploiement rapide (Getting Started)
- Endpoints API
- Modèles de données
- Configuration et variables d’environnement
- Développement et tests
- Contribution
- Licence

---

## Description
Esiee-Paris-Salles est une application web qui combine un frontend léger et un backend Python pour:
- afficher les salles disponibles en temps réel
- permettre de réserver une salle
- gérer les réservations et l’état des salles

Le frontend est déployé sur esieesalles.vercel.app et l’API est généralement accessible via le chemin /api sur le même domaine (ou sur esiee.zeffut.fr selon l’hébergement).

---

## Fonctionnalités
- Consultation en temps réel des disponibilités des salles
- Recherche et filtrage par statut, type de salle, étage, etc.
- Détails de la salle (capacité, type de tableau, étage, etc.)
- Réservation d’une salle via une interface conviviale
- Interfaces utilisateur réactives et accessibles

---

## Architecture et stack technologique

- Backend: Python (répertoire api/)
  - Fichiers notables: api/app.py, api/user_manager.py, api/events_api.py, api/cache_manager.py
  - Dépendances: api/requirements.txt
- Frontend: Code dans frontend/ (HTML/JS/CSS)
  - Script de communication avec l’API (script.js ou équivalent)
  - Déploiement probable sur Vercel ou autre CDN
- Hébergement:
  - Frontend: esieesalles.vercel.app
  - API: domaine probable esieesalles.vercel.app/api ou esiee.*.fr/api

---

## Déploiement rapide (Getting Started)

Remarque: adapter selon le framework/API exact utilisé (Flask, FastAPI, etc.).

1) Prérequis
- Python 3.x
- Node.js et npm (si besoin pour le frontend)
- Accès au dépôt GitHub Zeffut/Esiee-Paris-Salles

2) Backend (API)
- Installer les dépendances
  - cd api
  - python -m venv venv
  - source venv/bin/activate (Linux/macOS) ou venv\Scripts\activate (Windows)
  - pip install -r requirements.txt
- Lancement (adapter selon votre framework)
  - Flask: export FLASK_APP=app.py; flask run
  - FastAPI / Uvicorn: uvicorn app:app --reload
  - Autre point d’entrée: suivre le README du backend
- Variables d’environnement (à compléter)
  - API_BASE_URL (si nécessaire)
  - SECRET_KEY, DATABASE_URL (si utilisées)

3) Frontend
- cd frontend
- Installer et bâtir (si nécessaire)
  - npm install
  - npm run build (ou équivalent)
- Déployer sur Vercel / Netlify ou servir les fichiers statiques via un serveur

4) Vérification rapide
- Accéder au frontend (par exemple https://esieesalles.vercel.app)
- Le frontend appelle les endpoints API ( /api/rooms, /api/salles, /api/reservations, etc. selon l’implémentation)

---

## Endpoints API (candidats probables)

Note: les noms réels peuvent varier selon l’implémentation. Vérifie dans api/app.py et les autres modules.

- GET /api
  - Description: endpoint d’information ou health check
- GET /api/rooms ou /api/salles
  - Description: liste des salles
- GET /api/reservations
  - Description: accéder aux réservations utilisateur ou système
- POST /api/reservations
  - Description: créer une réservation
- GET /api/salles/{id}
  - Description: détails d’une salle

(Autres endpoints selon les modules éventuels)

---

## Modèles de données (indicatif)

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

---

## Configuration et variables d’environnement

- API_BASE_URL: URL de base de l’API (ex. https://esieesalles.vercel.app/api)
- DATABASE_URL: chaîne de connexion si une base est utilisée
- SECRET_KEY: clé secrète pour l’authentification/JWT
- ENVIRONMENT: development | production
- AUTHENTICATION: enabled | disabled (selon configuration)

---

## Développement et tests

- Lancer les tests unitaires si présents (ex. pytest)
- Vérifier les appels réseau dans le navigateur (onglet Network) pour s’assurer que les endpoints /api fonctionnent
- Vérifier les messages d’erreur API et la gestion des erreurs réseau/CORS

---

## Contribution

- Forkez le dépôt, créez une feature branch et proposez une Pull Request
- Respectez le guide de style existant
- Ajoutez des tests lorsque pertinent

---

## Licence

Indiquez la licence du projet (ex. MIT, Apache 2.0). Si non précisée, ajouter une section Licence avec “Proprietary / non licensed”
