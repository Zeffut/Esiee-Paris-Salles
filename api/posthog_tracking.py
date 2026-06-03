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

try:
    from posthog import Posthog
    _client = Posthog(project_api_key=POSTHOG_API_KEY, host=POSTHOG_HOST)
except Exception as e:  # lib absente, mauvaise version, etc.
    print(f"⚠️ PostHog serveur désactivé (init impossible): {e}")
    _client = None


def capture_event(distinct_id, event, properties=None):
    """Émet un event serveur. Silencieux en cas d'erreur."""
    if _client is None:
        return
    try:
        _client.capture(
            distinct_id=str(distinct_id) if distinct_id else 'anonymous',
            event=event,
            properties=properties or {},
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
            distinct_id=str(distinct_id) if distinct_id else 'server',
            properties=properties or {},
        )
    except Exception as e:
        print(f"⚠️ PostHog capture_exception échec: {e}")
