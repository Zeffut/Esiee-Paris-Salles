"""Offline migration rehearsals; every byte below is synthetic."""
import importlib.util
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]


class MigrationTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location('migrate_state', ROOT / 'ops/migrate_state.py')
        assert spec is not None and spec.loader is not None
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'legacy'
        self.source.mkdir(mode=0o700)
        payloads = {'esiee_users.json': {'users': {'before': {}}, 'sessions': {}, 'metadata': {}},
                    'esiee_cache.json': {'data': {'events': []}, 'last_update': '2026-10-12T08:00:00'},
                    'email_whitelist.json': {'allowed_emails': ['synthetic@example.invalid']}}
        for name, data in payloads.items():
            (self.source / name).write_text(json.dumps(data))
            (self.source / name).chmod(0o644)
        self.uid, self.gid = os.getuid(), os.getgid()

    def capture(self, source, target, **kwargs):
        return self.module.transfer(source, target, self.uid, self.gid, quiesced=True, **kwargs)

    def test_final_capture_install_metadata_and_exact_restore(self):
        backup, data = self.root / 'backup', self.root / 'data'
        before = {p.name: (p.read_bytes(), p.stat()) for p in self.source.iterdir()}
        receipt = self.capture(self.source, backup, include_whitelist=True)
        self.capture(backup, data, verified_snapshot=True)
        self.assertEqual(stat.S_IMODE(data.stat().st_mode), 0o700)
        for name in ['esiee_cache.json', 'esiee_users.json']:
            p = data / name
            self.assertEqual(p.read_bytes(), before[name][0])
            self.assertEqual(stat.S_IMODE(p.stat().st_mode), 0o600)
            self.assertEqual((p.stat().st_uid, p.stat().st_gid), (self.uid, self.gid))
            self.assertEqual(receipt['files'][name]['source']['mode'], 0o644)
            self.assertEqual((self.source / name).stat().st_mtime_ns, before[name][1].st_mtime_ns)
        self.assertFalse((data / 'email_whitelist.json').exists())
        self.assertTrue((backup / 'email_whitelist.json').exists())

    def test_rollback_uses_current_state_preserves_poststart_user(self):
        backup, data = self.root / 'backup', self.root / 'data'
        self.capture(self.source, backup, include_whitelist=True)
        self.capture(backup, data, verified_snapshot=True)
        p = data / 'esiee_users.json'
        users = json.loads(p.read_text())
        users['users']['new-after-start'] = {'name': 'synthetic'}
        p.write_text(json.dumps(users))
        current, legacy_rollback = self.root / 'current', self.root / 'rollback-cwd'
        self.capture(data, current)
        self.capture(current, legacy_rollback, verified_snapshot=True)
        self.assertIn('new-after-start', json.loads((legacy_rollback / p.name).read_text())['users'])
        self.assertEqual(p.read_bytes(), (legacy_rollback / p.name).read_bytes())
        # Old managers have historical relative paths: emulate old image CWD.
        from user_manager import ESIEEUserManager
        cwd = os.getcwd()
        try:
            os.chdir(legacy_rollback)
            with patch.dict(os.environ, {}, clear=False):
                os.environ.pop('ESIEE_DATA_DIR', None)
                old = ESIEEUserManager()
                self.assertIn('new-after-start', old.users_data['users'])
        finally:
            os.chdir(cwd)

    def test_quiescence_ack_required(self):
        with self.assertRaises(ValueError):
            self.module.transfer(self.source, self.root / 'blocked', self.uid, self.gid)
        self.assertFalse((self.root / 'blocked').exists())

    def test_existing_destination_never_overwritten(self):
        target = self.root / 'existing'
        target.mkdir()
        (target / 'sentinel').write_text('preserve')
        with self.assertRaises(FileExistsError):
            self.capture(self.source, target)
        self.assertEqual((target / 'sentinel').read_text(), 'preserve')

    def test_tampered_backup_rejected_before_publish(self):
        backup = self.root / 'backup'
        self.capture(self.source, backup)
        (backup / 'esiee_users.json').write_text('{}')
        with self.assertRaises(ValueError):
            self.capture(backup, self.root / 'bad', verified_snapshot=True)
        self.assertFalse((self.root / 'bad').exists())

    def test_structurally_invalid_users_not_installed_as_empty_accounts(self):
        (self.source / 'esiee_users.json').write_text('{}')
        with self.assertRaises(ValueError):
            self.capture(self.source, self.root / 'invalid-structure')
        self.assertFalse((self.root / 'invalid-structure').exists())

    def test_missing_or_symlinked_or_invalid_input_rejected(self):
        p = self.source / 'esiee_users.json'
        original = p.read_bytes()
        p.unlink()
        with self.assertRaises(FileNotFoundError):
            self.capture(self.source, self.root / 'missing')
        p.symlink_to(self.source / 'esiee_cache.json')
        with self.assertRaises(ValueError):
            self.capture(self.source, self.root / 'link')
        p.unlink()
        p.write_text('not JSON')
        with self.assertRaises(ValueError):
            self.capture(self.source, self.root / 'invalid')
        p.write_bytes(original)

    def test_mutating_source_detected_and_no_partial_target(self):
        original = self.module.read_stable
        calls = []
        def change(path):
            result = original(path)
            calls.append(path.name)
            if len(calls) == 2:
                p = self.source / 'esiee_cache.json'
                p.write_text('{"changed": true}')
            return result
        with patch.object(self.module, 'read_stable', side_effect=change):
            with self.assertRaises(ValueError):
                self.capture(self.source, self.root / 'racing')
        self.assertFalse((self.root / 'racing').exists())
        self.assertEqual(list(self.root.glob('.esiee-migrate-*')), [])

    def test_cli_capture_install_and_refuse_missing_quiescence(self):
        script = str(ROOT / 'ops/migrate_state.py')
        backup, data = self.root / 'cli-backup', self.root / 'cli-data'
        base = [sys.executable, script, 'capture', '--source', str(self.source),
                '--destination', str(backup), '--uid', str(self.uid), '--gid', str(self.gid)]
        refused = subprocess.run(base, capture_output=True, text=True, timeout=10)
        self.assertNotEqual(refused.returncode, 0)
        self.assertFalse(backup.exists())
        captured = subprocess.run(base + ['--api-quiesced', '--include-whitelist'],
                                  capture_output=True, text=True, timeout=10)
        self.assertEqual(captured.returncode, 0, captured.stderr)
        installed = subprocess.run([sys.executable, script, 'install', '--source', str(backup),
                                    '--destination', str(data), '--uid', str(self.uid),
                                    '--gid', str(self.gid), '--api-quiesced'],
                                   capture_output=True, text=True, timeout=10)
        self.assertEqual(installed.returncode, 0, installed.stderr)
        for name in self.module.STATE:
            self.assertEqual((self.source / name).read_bytes(), (data / name).read_bytes())
