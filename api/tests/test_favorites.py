import importlib
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))


class FakePosthog:
    def __init__(self, *args, **kwargs):
        pass

    def capture(self, **kwargs):
        pass

    def capture_exception(self, *args, **kwargs):
        pass


class FavoritesRouteTests(unittest.TestCase):
    def setUp(self):
        posthog_module = types.ModuleType("posthog")
        setattr(posthog_module, "Posthog", FakePosthog)
        self.modules = patch.dict(sys.modules, {"posthog": posthog_module})
        self.modules.start()
        self.app_module = importlib.import_module("app")
        self.user_manager = self.app_module.user_manager

        self.saved_data = self.user_manager.users_data
        self.user_manager.users_data = {
            "users": {
                "u1": {
                    "user_id": "u1", "email": "a@edu.esiee.fr", "name": "A", "picture": "",
                    "role": "user", "preferences": {}, "reservations": {"total": 0, "active": 0, "history": []},
                },
            },
            "sessions": {
                "tok": {"user_id": "u1", "csrf_token": "csrf", "created_at": "2026-01-01T00:00:00",
                        "expires_at": "2999-01-01T00:00:00", "last_activity": "2026-01-01T00:00:00"},
            },
            "metadata": {"last_updated": None},
        }
        self.save = patch.object(self.user_manager, "_save_users", return_value=True)
        self.save.start()
        self.app_module.rate_limit_storage.clear()
        self.client = self.app_module.app.test_client()
        self.headers = {"Authorization": "Bearer tok", "X-CSRF-Token": "csrf"}

    def tearDown(self):
        self.save.stop()
        self.user_manager.users_data = self.saved_data
        self.modules.stop()

    def test_requires_authentication(self):
        self.assertEqual(self.client.get("/api/favorites").status_code, 401)
        res = self.client.put("/api/favorites/1201", headers={"X-CSRF-Token": "csrf"})
        self.assertEqual(res.status_code, 401)

    def test_requires_csrf_for_writes(self):
        res = self.client.put("/api/favorites/1201", headers={"Authorization": "Bearer tok"})
        self.assertEqual(res.status_code, 403)

    def test_add_is_idempotent_and_remove_works(self):
        for _ in range(2):
            res = self.client.put("/api/favorites/1201", headers=self.headers)
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.get_json()["favorites"], ["1201"])

        self.client.put("/api/favorites/0110", headers=self.headers)
        res = self.client.get("/api/favorites", headers=self.headers)
        self.assertEqual(res.get_json()["favorites"], ["1201", "0110"])

        res = self.client.delete("/api/favorites/1201", headers=self.headers)
        self.assertEqual(res.get_json()["favorites"], ["0110"])

    def test_rejects_invalid_room_numbers(self):
        for bad in ["12", "12345", "abcd", "12a4"]:
            res = self.client.put(f"/api/favorites/{bad}", headers=self.headers)
            self.assertEqual(res.status_code, 400, bad)

    def test_caps_number_of_favorites(self):
        self.user_manager.users_data["users"]["u1"]["favorites"] = [f"{i:04d}" for i in range(50)]
        res = self.client.put("/api/favorites/9999", headers=self.headers)
        self.assertEqual(res.status_code, 400)

    def test_verify_exposes_favorites(self):
        self.client.put("/api/favorites/1201", headers=self.headers)
        res = self.client.get("/api/auth/verify", headers=self.headers)
        self.assertEqual(res.get_json()["user"]["favorites"], ["1201"])


if __name__ == "__main__":
    unittest.main()
