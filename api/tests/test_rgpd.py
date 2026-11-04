import importlib
import sys
import types
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))


class FakePosthog:
    captures = []

    def __init__(self, *args, **kwargs):
        pass

    def capture(self, **kwargs):
        FakePosthog.captures.append(kwargs)

    def capture_exception(self, *args, **kwargs):
        pass


def iso(days_ago, hour=10):
    return (datetime.now() - timedelta(days=days_ago)).replace(hour=hour, minute=0, second=0, microsecond=0).isoformat()


class RgpdTests(unittest.TestCase):
    def setUp(self):
        posthog_module = types.ModuleType("posthog")
        setattr(posthog_module, "Posthog", FakePosthog)
        self.modules = patch.dict(sys.modules, {"posthog": posthog_module})
        self.modules.start()
        self.app_module = importlib.import_module("app")
        self.um = self.app_module.user_manager
        self.saved = self.um.users_data
        self.um.users_data = {
            "users": {
                "u1": {"user_id": "u1", "email": "a@edu.esiee.fr", "name": "A", "picture": "", "role": "user",
                       "preferences": {}, "favorites": ["1201"], "last_login": iso(1), "created_at": iso(30),
                       "given_name": "A", "google_id": "123",
                       "reservations": {"total": 2, "active": 0, "history": [
                           {"id": "old", "room_number": "1201", "start_time": iso(400, 9), "end_time": iso(400, 10), "status": "active"},
                           {"id": "new", "room_number": "2105", "start_time": iso(2, 9), "end_time": iso(2, 10), "status": "active"},
                       ]}},
                "u2": {"user_id": "u2", "email": "b@edu.esiee.fr", "name": "B", "role": "user",
                       "last_login": iso(800), "created_at": iso(900), "reservations": {"history": []}},
                "u3": {"user_id": "u3", "email": "d@edu.esiee.fr", "name": "D", "role": "user",
                       "last_login": iso(400), "created_at": iso(500), "reservations": {"history": []}},
                "admin": {"user_id": "admin", "email": "c@x.fr", "role": "admin",
                          "last_login": iso(800), "created_at": iso(900), "reservations": {"history": []}},
            },
            "sessions": {
                "tok": {"user_id": "u1", "csrf_token": "csrf", "created_at": iso(1), "expires_at": "2999-01-01T00:00:00", "last_activity": iso(1)},
                "tok2": {"user_id": "u2", "csrf_token": "x", "created_at": iso(1), "expires_at": "2999-01-01T00:00:00", "last_activity": iso(1)},
            },
            "metadata": {"last_updated": None},
        }
        self.save = patch.object(self.um, "_save_users", return_value=True)
        self.save.start()
        self.app_module.rate_limit_storage.clear()
        self.client = self.app_module.app.test_client()
        self.headers = {"Authorization": "Bearer tok", "X-CSRF-Token": "csrf"}

    def tearDown(self):
        self.save.stop()
        self.um.users_data = self.saved
        self.modules.stop()

    def test_purge_applies_retention_periods(self):
        removed = self.um.purge_old_data()
        users = self.um.users_data["users"]
        self.assertNotIn("u2", users)                      # inactif depuis plus de 24 mois
        self.assertIn("u3", users)                         # inactif depuis 13 mois : conservé
        self.assertIn("admin", users)                      # le compte admin n'est pas supprimé
        self.assertNotIn("tok2", self.um.users_data["sessions"])
        ids = [r["id"] for r in users["u1"]["reservations"]["history"]]
        self.assertEqual(ids, ["new"])                     # réservation de plus de 12 mois supprimée
        self.assertNotIn("google_id", users["u1"])         # champs inutiles retirés
        self.assertEqual(removed["accounts"], 1)
        self.assertEqual(removed["reservations"], 1)

    def test_export_returns_account_data_without_tokens(self):
        res = self.client.get("/api/auth/export", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        self.assertIn("attachment", res.headers["Content-Disposition"])
        body = res.get_json()
        self.assertEqual(body["donnees"]["compte"]["email"], "a@edu.esiee.fr")
        self.assertNotIn("tok", res.get_data(as_text=True).replace("Bearer", ""))
        self.assertNotIn("csrf", res.get_data(as_text=True))

    def test_export_requires_authentication(self):
        self.assertEqual(self.client.get("/api/auth/export").status_code, 401)

    def test_delete_account_removes_everything(self):
        res = self.client.delete("/api/auth/account", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        self.assertNotIn("u1", self.um.users_data["users"])
        self.assertNotIn("tok", self.um.users_data["sessions"])
        # la session n'existe plus : toute nouvelle requête est refusée
        self.assertEqual(self.client.get("/api/auth/verify", headers=self.headers).status_code, 401)

    def test_delete_account_requires_csrf(self):
        res = self.client.delete("/api/auth/account", headers={"Authorization": "Bearer tok"})
        self.assertEqual(res.status_code, 403)
        self.assertIn("u1", self.um.users_data["users"])

    def test_server_events_are_anonymous(self):
        tracking = importlib.import_module("posthog_tracking")
        tracking._client = FakePosthog()
        FakePosthog.captures.clear()
        tracking.capture_event("u1", "reservation_confirmed_server", {"room": "1201"})
        sent = FakePosthog.captures[-1]
        self.assertEqual(sent["distinct_id"], "api-server")
        self.assertFalse(sent["properties"]["$process_person_profile"])


if __name__ == "__main__":
    unittest.main()
