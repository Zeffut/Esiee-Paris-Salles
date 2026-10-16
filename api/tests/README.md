Tests hors réseau

Depuis la racine du dépôt, avec les dépendances api/requirements.txt installées :
  PYTHONPATH=api python -m unittest discover -s api/tests -v
  python -m compileall -q api
  node --check frontend/script.js
  node --check frontend/settings.js
  node --check frontend/posthog.js

Les nouvelles régressions importent les vrais modules de l'application (pas
une extraction AST). Les requêtes HTTP sont simulées à la frontière requests ;
un garde socket interdit le réseau. L'initialisation du client PostHog et le
démarrage du thread de nettoyage sont neutralisés pendant l'import de l'app.
Les deux tests PostHog existants utilisent leur propre faux SDK et une clé test.

fixtures/synthetic-week.ics est entièrement synthétique. Aucun emploi du temps
ESIEE ni utilisateur réel : 3 VEVENT, dont un doublon, 2 événements uniques,
3 salles concernées. Les tests vérifient parsing, déduplication, cache disque,
rechargement et réponses Flask avec test_client (pas un serveur production).

Contrat corrigé :
  get_events_this_week() retourne [] pour un calendrier valide vide ; lève
  EventFetchError pour un échec de transport/extraction ou une enveloppe iCal
  invalide. refresh_cache() garde le dernier cache et sa date sur échec.
  La disponibilité du cache est dérivée du même snapshot, sans deuxième fetch.
  Une sauvegarde échouée retourne False et restaure l'état mémoire précédent.
  L'écriture atomique protège l'ancien fichier contre une écriture incomplète.
  Une date future ne valide pas le cache ; âge valide : 0 <= âge < durée.
  Les plannings et filtres PER reconnaissent les numéros exacts, virgules simples
  ou échappées, y compris chaque salle d'un événement multi-salles.

Limites : le parseur iCal historique n'est pas remplacé par un parseur complet
RFC 5545 (récurrences, dates TZID/all-day et transitions DST restent hors scope).
L'enveloppe est vérifiée, pas la validité exhaustive de chaque propriété.
Le fallback vers le cache périmé existant reste inchangé, de même que les erreurs
historiques [] dans les helpers autres semaines. Pas de certification des données
réelles, de couverture école ou de fraîcheur de production.

Les builds de référence du projet restent les Dockerfile API (Python 3.13) et
frontend (fichiers statiques nginx). compileall et les vérifications JavaScript
ne constituent pas à eux seuls des images Docker validées. Aucun push n'est
nécessaire pour ces tests ; il pourrait déclencher le déploiement automatique.
