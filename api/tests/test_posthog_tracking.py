import importlib
import os
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


API_DIR = Path(__file__).resolve().parents[1]


class FakePosthog:
    instances = []

    def __init__(self, project_api_key, host):
        self.project_api_key = project_api_key
        self.host = host
        self.captures = []
        self.exceptions = []
        self.__class__.instances.append(self)

    def capture(self, **kwargs):
        self.captures.append(kwargs)

    def capture_exception(self, error, **kwargs):
        self.exceptions.append((error, kwargs))


class PosthogTrackingTests(unittest.TestCase):
    def setUp(self):
        FakePosthog.instances.clear()
        self.posthog_module = types.ModuleType("posthog")
        setattr(self.posthog_module, "Posthog", FakePosthog)
        self.env = patch.dict(
            os.environ,
            {
                "POSTHOG_API_KEY": "phc_test_key_only",
                "POSTHOG_HOST": "https://posthog.invalid",
            },
            clear=False,
        )
        self.env.start()
        self.modules = patch.dict(sys.modules, {"posthog": self.posthog_module})
        self.modules.start()
        sys.modules.pop("posthog_tracking", None)
        self.tracking = importlib.import_module("posthog_tracking")

    def tearDown(self):
        sys.modules.pop("posthog_tracking", None)
        self.modules.stop()
        self.env.stop()

    def test_initializes_and_captures_with_test_key_only(self):
        client = self.tracking._client
        self.assertIsInstance(client, FakePosthog)
        self.assertEqual(client.project_api_key, "phc_test_key_only")
        self.assertEqual(client.host, "https://posthog.invalid")

        self.tracking.capture_event("user-42", "test_event", {"source": "test"})

        # RGPD : l'identifiant de l'utilisateur n'est jamais transmis, ni aucun profil créé
        self.assertEqual(
            client.captures,
            [
                {
                    "distinct_id": "api-server",
                    "event": "test_event",
                    "properties": {"app": "esiee-salles", "$process_person_profile": False, "source": "test"},
                }
            ],
        )

    def test_declares_supported_posthog_async_sdk(self):
        requirements = (API_DIR / "requirements.txt").read_text(encoding="utf-8")
        self.assertIn("posthog[async]>=7.45.0", requirements)


if __name__ == "__main__":
    unittest.main()
