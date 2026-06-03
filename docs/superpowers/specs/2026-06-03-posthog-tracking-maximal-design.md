# Tracking maximal PostHog — Design

**Date :** 2026-06-03
**Projet :** Esiee-Paris-Salles (appli de consultation/réservation de salles ESIEE)
**Auteur :** Thomas De Sousa (tom77ds@gmail.com)

## Objectif

Mettre en place le tracking le plus complet possible avec PostHog, **en gardant Rybbit
Analytics actif en parallèle** le temps d'évaluer PostHog (double tracking). Aucune
suppression de Rybbit dans cette phase.

## Contexte technique

- **Frontend** : statique (`index.html`, `profile.html`, `settings.html`) + `script.js`
  (~84 Ko, helper `track()` en `script.js:153`) + `styles.css`. Déployé sur **deux cibles** :
  Vercel (`vercel.json`) et conteneur **nginx** (`nginx.conf` + `Dockerfile`).
- **API** : Flask (`api/app.py`), + `cache_manager.py`, `user_manager.py`, `events_api.py`.
- **Tracking existant (Rybbit)** : proxy `/rb/` (vercel.json + nginx), script avec
  `data-site-id="a969e55cd4ad"`, helper `track(name, props)` → `window.rybbit.event()`,
  identification au login, reset au logout. 13 events custom : `room_viewed`,
  `filter_applied`, `filter_reset`, `theme_changed`, `search_performed`, `login_success`,
  `login_error`, `logout`, `reservation_opened`, `reservation_confirmed`,
  `reservation_cancelled`, `reservation_error`.

## Compte PostHog

- Organisation : **Zeffut's Saas** (`019e8c54-858a-0000-d3a8-b07ecd2105ab`)
- Projet : **Default project** (id `192659`)
- Token projet (clé publique d'ingestion) : `phc_zdMj4p5wo8EvfVApjb2EbfUHJ76zgYGM5wAGz5YJC359`
- **Région : EU** → ingestion `https://eu.i.posthog.com`, assets `https://eu-assets.i.posthog.com`,
  app/ui `https://eu.posthog.com`
- MCP PostHog configuré en CLI (scope projet local) : pilotage complet possible.

## Décisions (arbitrées avec l'utilisateur)

| Sujet | Choix |
|---|---|
| Cohabitation | Double tracking : `track()` → Rybbit **ET** PostHog |
| Session Replay | Activé **sans masquage** (capture console + réseau) |
| Consentement RGPD | Tracking direct, cookies + localStorage, **sans bandeau** |
| Proxy anti-adblock | Oui, reverse proxy `/ingest/` (vercel.json + nginx) |
| Tracking serveur | Oui, `posthog-python` dans Flask |

> ⚠️ **Note RGPD assumée par l'utilisateur** : replay sans masquage + tracking sans
> consentement sur une appli étudiante EU = exposition réelle. À durcir ultérieurement si besoin.

## Architecture de la solution

### 1. SDK client `posthog-js` (3 pages HTML)
Init avec configuration maximale :
- `api_host` → `/ingest` (reverse proxy), `ui_host` → `https://eu.posthog.com`
- `person_profiles: 'always'`
- `autocapture: true`, `capture_pageview: true`, `capture_pageleave: true`
- `session_recording` activé, **sans masquage** (`maskAllInputs: false`),
  `recordCrossOriginIframes` au besoin, capture console + réseau (performance)
- `enable_heatmaps: true`, `rageclick: true`, capture dead-clicks
- `capture_performance: true` (web vitals)
- Error tracking / exceptions autocapture activé
- `persistence: 'localStorage+cookie'`

### 2. Events custom — double tracking
Le helper `track()` envoie vers `window.rybbit` **et** `window.posthog` (les deux gardés
silencieux si non chargés). Les 13 events existants sont conservés tels quels.

### 3. Identification
- Login → `posthog.identify(<id/email>, { email_domain, method, epis? })`
- Logout → `posthog.reset()`
(en miroir de l'identification Rybbit déjà en place)

### 4. Reverse proxy `/ingest/`
- **vercel.json** : rewrites `/ingest/static/*` → `eu-assets.i.posthog.com/static/*`,
  `/ingest/*` → `eu.i.posthog.com/*` (+ endpoints decide/flags).
- **nginx.conf** : `location ^~ /ingest/` avec `proxy_pass`, `Host` réécrit, SSL upstream,
  sur le modèle du bloc `/rb/` existant.

### 5. Configuration côté PostHog (via MCP)
- Timezone projet → `Europe/Paris`.
- Activer Session Replay (sampling 100 %, console, réseau), autocapture, heatmaps,
  web vitals, exceptions dans les réglages projet.
- Taxonomie : descriptions des 13 events custom.
- **Dashboard « Esiee Salles — Vue d'ensemble »** : pageviews, DAU/WAU, réservations
  confirmées, funnel `room_viewed → reservation_opened → reservation_confirmed`,
  logins succès/échec, recherches, top salles vues, usage thèmes, erreurs réservation par raison.
- Une Survey de feedback in-app.
- Un feature flag d'exemple.

### 6. Tracking serveur Flask (`posthog-python`)
- Ajout dépendance `posthog` dans `api/requirements.txt`.
- Init client avec le token projet (`phc_…`) + host EU.
- Capture des events critiques côté serveur (réservation confirmée, erreurs) +
  capture d'exceptions.

## Plan de mise en œuvre (ordre)

1. **PostHog-side (MCP)** — timezone, réglages capture, taxonomie, dashboard/insights,
   survey, feature flag. *(réversible, sans toucher au code)*
2. **Frontend** — snippet + init `posthog-js` (3 pages), helper `track()` dual,
   identify/reset, reverse proxy `vercel.json` + `nginx.conf`.
3. **Backend** — `posthog-python` dans Flask, events serveur + exceptions.
4. **Vérification** — confirmer l'ingestion (`ingested_event` passe à `true`),
   replays visibles, dashboard alimenté.

## Hors périmètre (cette phase)
- Suppression de Rybbit (gardé en parallèle).
- Durcissement RGPD (masquage replay, bandeau consentement) — à réévaluer plus tard.
