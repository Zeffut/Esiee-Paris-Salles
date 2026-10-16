"""Synthetic disk only; no application startup or source fetch."""
import json
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch
from datetime import datetime, timedelta


class DataDirectoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.env = patch.dict(os.environ, {}, clear=False)
        self.env.start()
        self.addCleanup(self.env.stop)
        os.environ.pop('ESIEE_DATA_DIR', None)

    def test_default_paths_unchanged(self):
        from data_directory import data_path
        self.assertEqual(data_path(None, 'esiee_cache.json'), 'esiee_cache.json')
        self.assertEqual(data_path(None, 'esiee_users.json'), 'esiee_users.json')

    def test_explicit_paths_take_priority(self):
        from data_directory import data_path
        os.environ['ESIEE_DATA_DIR'] = str(self.root / 'unused')
        self.assertEqual(data_path('custom.json', 'esiee_cache.json'), 'custom.json')
        self.assertFalse((self.root / 'unused').exists())

    def test_absent_directory_created_private(self):
        from data_directory import data_path
        directory = self.root / 'missing' / 'private'
        os.environ['ESIEE_DATA_DIR'] = str(directory)
        self.assertEqual(data_path(None, 'esiee_cache.json'), str(directory / 'esiee_cache.json'))
        self.assertEqual(stat.S_IMODE(directory.stat().st_mode), 0o700)

    def test_bad_directory_rejected_without_chmod(self):
        from data_directory import data_path
        self.root.chmod(0o755)
        os.environ['ESIEE_DATA_DIR'] = str(self.root)
        with self.assertRaises(PermissionError):
            data_path(None, 'esiee_users.json')
        self.assertEqual(stat.S_IMODE(self.root.stat().st_mode), 0o755)

    def test_relative_or_empty_config_rejected(self):
        from data_directory import data_path
        for value in ['', 'relative']:
            with self.subTest(value=value):
                os.environ['ESIEE_DATA_DIR'] = value
                with self.assertRaises(ValueError):
                    data_path(None, 'esiee_users.json')

    def test_symlink_directory_rejected(self):
        from data_directory import data_path
        link = self.root / 'link'
        link.symlink_to(self.root, target_is_directory=True)
        os.environ['ESIEE_DATA_DIR'] = str(link)
        with self.assertRaises(ValueError):
            data_path(None, 'esiee_cache.json')

    def test_configured_users_preserved_and_reload_private(self):
        from user_manager import ESIEEUserManager
        os.environ['ESIEE_DATA_DIR'] = str(self.root)
        users = ESIEEUserManager(whitelist_file=str(self.root / 'absent-whitelist'))
        users.users_data['users']['synthetic-id'] = {'name': 'synthetic'}
        self.assertTrue(users._save_users())
        p = self.root / 'esiee_users.json'
        self.assertEqual(stat.S_IMODE(p.stat().st_mode), 0o600)
        before = p.read_bytes()
        reloaded = ESIEEUserManager(whitelist_file='unchanged-whitelist.json')
        self.assertEqual(reloaded.users_data['users']['synthetic-id']['name'], 'synthetic')
        self.assertEqual(reloaded.whitelist_file, 'unchanged-whitelist.json')
        self.assertEqual(p.read_bytes(), before)

    def test_cache_atomic_replace_and_offline_reload(self):
        from cache_manager import ESIEECacheManager
        os.environ['ESIEE_DATA_DIR'] = str(self.root)
        cache = ESIEECacheManager()
        cache.cache_data = {'events': [{'summary': 'synthetic'}]}
        cache.last_update = datetime.now() - timedelta(hours=2)
        self.assertTrue(cache.save_cache())
        p = self.root / 'esiee_cache.json'
        before = p.read_bytes()
        cache.cache_data = {'events': []}
        self.assertTrue(cache.save_cache())
        self.assertNotEqual(before, p.read_bytes())
        self.assertEqual(stat.S_IMODE(p.stat().st_mode), 0o600)
        reloaded = ESIEECacheManager()
        with patch('cache_manager.get_events_this_week', side_effect=RuntimeError('synthetic offline')):
            self.assertEqual(reloaded.get_cached_data(), {'events': []})
        self.assertEqual(list(self.root.glob('.esiee-cache-*')), [])

    def test_changing_path_does_not_import_old_data(self):
        from user_manager import ESIEEUserManager
        os.environ['ESIEE_DATA_DIR'] = str(self.root / 'first')
        first = ESIEEUserManager()
        first.users_data['users']['synthetic'] = {}
        self.assertTrue(first._save_users())
        before = Path(first.users_file).read_bytes()
        os.environ['ESIEE_DATA_DIR'] = str(self.root / 'second')
        second = ESIEEUserManager()
        self.assertEqual(second.users_data['users'], {})
        self.assertEqual(Path(first.users_file).read_bytes(), before)

    def test_existing_data_loaded_without_mutation(self):
        from user_manager import ESIEEUserManager
        os.environ['ESIEE_DATA_DIR'] = str(self.root)
        p = self.root / 'esiee_users.json'
        p.write_text(json.dumps({'users': {'synthetic': {}}, 'sessions': {}, 'metadata': {}}))
        p.chmod(0o600)
        before = p.stat()
        reloaded = ESIEEUserManager()
        self.assertEqual(reloaded.users_file, str(p))
        self.assertIn('synthetic', reloaded.users_data['users'])
        self.assertEqual(p.stat().st_mtime_ns, before.st_mtime_ns)

    def test_unwritable_data_directory_preserves_existing_state(self):
        from cache_manager import ESIEECacheManager
        from user_manager import ESIEEUserManager
        self.assertNotEqual(os.geteuid(), 0, 'permission test requires non-root')
        os.environ['ESIEE_DATA_DIR'] = str(self.root)
        cache = ESIEECacheManager()
        cache.cache_data = {'events': []}
        cache.last_update = datetime.now()
        self.assertTrue(cache.save_cache())
        before = (self.root / 'esiee_cache.json').read_bytes()
        self.root.chmod(0o500)
        try:
            self.assertFalse(cache.save_cache())
            self.assertEqual((self.root / 'esiee_cache.json').read_bytes(), before)
            with self.assertRaises(PermissionError):
                ESIEEUserManager()
        finally:
            self.root.chmod(0o700)

    def test_manager_defaults_and_explicit_overrides(self):
        from cache_manager import ESIEECacheManager
        from user_manager import ESIEEUserManager
        self.assertEqual(ESIEECacheManager().cache_file, 'esiee_cache.json')
        self.assertEqual(ESIEEUserManager().users_file, 'esiee_users.json')
        os.environ['ESIEE_DATA_DIR'] = str(self.root / 'unused')
        self.assertEqual(ESIEECacheManager(cache_file=str(self.root / 'explicit-cache')).cache_file,
                         str(self.root / 'explicit-cache'))
        self.assertEqual(ESIEEUserManager(users_file=str(self.root / 'explicit-users')).users_file,
                         str(self.root / 'explicit-users'))
        self.assertFalse((self.root / 'unused').exists())
