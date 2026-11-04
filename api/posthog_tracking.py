"""
Tracking serveur PostHog — capture fiable des events critiques côté API.

Contrairement au tracking navigateur (bloquable par les adblockers), ces events
sont émis directement par le serveur : ils ne peuvent pas être perdus.

Module 100% défensif : si la lib `posthog` n'est pas installée ou si le réseau
échoue, l'API continue de fonctionner normalement (aucune exception propagée).

Configuration via variables d'environnement (avec valeurs par défaut) :
- POSTHOG_API_KEY : token projet public (ingestion)
- POSTHOG_HOST    : host d'ingestion (région EU par défaut)
"""
import os

POSTHOG_API_KEY = os.environ.get(
    'POSTHOG_API_KEY',
    'phc_zdMj4p5wo8EvfVApjb2EbfUHJ76zgYGM5wAGz5YJC359'
)
POSTHOG_HOST = os.environ.get('POSTHOG_HOST', 'https://eu.i.posthog.com')

# Super property ajoutée à TOUS les events serveur (pour filtrer par app dans PostHog).
APP_NAME = 'esiee-salles'

try:
    from posthog import Posthog
    _client = Posthog(project_api_key=POSTHOG_API_KEY, host=POSTHOG_HOST)
except Exception as e:  # lib absente, mauvaise version, etc.
    print(f"⚠️ PostHog serveur désactivé (init impossible): {e}")
    _client = None


# RGPD : les événements serveur servent à compter (réservations, favoris…), pas à
# suivre des personnes. Ils sont envoyés sous un identifiant unique « api-server »,
# sans profil de personne, quel que soit l'utilisateur à l'origine de l'action.
SERVER_DISTINCT_ID = 'api-server'


def capture_event(distinct_id, event, properties=None):
    """Émet un event serveur anonyme. Silencieux en cas d'erreur.
    `distinct_id` est ignoré (conservé pour compatibilité des appels)."""
    if _client is None:
        return
    try:
        _client.capture(
            distinct_id=SERVER_DISTINCT_ID,
            event=event,
            properties={'app': APP_NAME, '$process_person_profile': False, **(properties or {})},
        )
    except Exception as e:
        print(f"⚠️ PostHog capture_event échec ({event}): {e}")


def capture_exception(error, distinct_id=None, properties=None):
    """Remonte une exception serveur dans PostHog Error Tracking. Silencieux si échec."""
    if _client is None:
        return
    try:
        _client.capture_exception(
            error,
            distinct_id=SERVER_DISTINCT_ID,
            properties={'app': APP_NAME, '$process_person_profile': False, **(properties or {})},
        )
    except Exception as e:
        print(f"⚠️ PostHog capture_exception échec: {e}")
