#!/usr/bin/env python3
"""Run synthetic unit tests with networking denied, including test discovery."""
import os
from pathlib import Path
import socket
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, os.environ.get('ESIEE_TEST_API_DIR', str(ROOT / 'api')))
os.environ['POSTHOG_API_KEY'] = ''
os.environ['POSTHOG_HOST'] = 'https://posthog.invalid'
os.environ.pop('ESIEE_DATA_DIR', None)
attempts = []


def deny(*args, **kwargs):
    attempts.append('network attempt blocked')
    raise AssertionError('offline suite: networking forbidden')


def main():
    old_cwd = os.getcwd()
    pattern = sys.argv[1] if len(sys.argv) > 1 else 'test*.py'
    with tempfile.TemporaryDirectory() as directory, \
            patch.object(socket.socket, 'connect', deny), \
            patch.object(socket.socket, 'connect_ex', deny), \
            patch('socket.create_connection', deny), \
            patch('socket.getaddrinfo', deny):
        os.chdir(directory)
        try:
            suite = unittest.defaultTestLoader.discover(str(ROOT / 'api/tests'), pattern=pattern)
            result = unittest.TextTestRunner(verbosity=2).run(suite)
        finally:
            os.chdir(old_cwd)
    print(f'network_attempts={len(attempts)}')
    return int(not result.wasSuccessful() or bool(attempts) or bool(result.skipped))


if __name__ == '__main__':
    sys.exit(main())
