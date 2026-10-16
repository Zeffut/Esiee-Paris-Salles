"""Offline regressions: all events/calendars are synthetic, not school data.
Run: PYTHONPATH=api python -m unittest discover -s api/tests -v
"""
import copy
import importlib
import os
import socket
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import Mock, patch


class CacheRegressions(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        cls.cwd = os.getcwd()
        os.chdir(cls.directory.name)
        cls.network = patch.object(socket.socket, 'connect', side_effect=AssertionError('offline test: network forbidden'))
        cls.network.start()
        # Import the real application, but never start telemetry or daemon threads.
        with patch('posthog.Posthog'), patch('threading.Thread.start'):
            cls.cache_module = importlib.import_module('cache_manager')
            cls.events_module = importlib.import_module('events_api')
            cls.application = importlib.import_module('app')

    @classmethod
    def tearDownClass(cls):
        cls.network.stop()
        os.chdir(cls.cwd)
        cls.directory.cleanup()

    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.cache = self.cache_module.ESIEECacheManager(str(Path(directory.name) / 'cache.json'))
        self.cache.last_update = datetime.now() - timedelta(hours=2)
        self.cache.cache_data = {'events': [{'summary': 'synthetic previous event'}]}
        self.cache.save_cache = Mock(return_value=True)

    def test_failed_fetch_must_not_replace_last_good_cache(self):
        before = copy.deepcopy(self.cache.cache_data)
        timestamp = self.cache.last_update
        with patch.object(self.events_module.ESIEEiCalFinalExtractor, 'extract_current_week', return_value=False):
            result = self.cache.refresh_cache()
        self.assertEqual(self.cache.cache_data, before)
        self.assertEqual(self.cache.last_update, timestamp)
        self.assertFalse(result)
        self.cache.save_cache.assert_not_called()

    def test_failed_persistence_must_not_report_refresh_success(self):
        self.cache.save_cache.return_value = False
        with patch.object(self.cache_module, 'get_events_this_week', return_value=[]), patch.object(self.cache_module, 'get_available_rooms_today', return_value=[]):
            self.assertFalse(self.cache.refresh_cache())

    def test_future_timestamp_must_not_be_valid(self):
        self.cache.last_update = datetime.now() + timedelta(days=2)
        self.assertFalse(self.cache.is_cache_valid())

    def test_multi_room_event_must_appear_in_each_room_schedule(self):
        start = datetime(2026, 10, 12, 10)
        events = [{'room_full': 'PER - 113\\,112', 'start_datetime': start,
                   'end_datetime': start + timedelta(hours=1), 'summary': 'synthetic fixture'}]
        with patch.object(self.application, 'get_cached_events', return_value=events):
            for room in ['113', '112']:
                self.assertEqual(len(self.application.get_room_schedule_from_cache(room)['monday']), 1)
                self.assertFalse(self.application.is_room_available_at_time(room, 'monday', '10:30'))

    def test_successful_empty_calendar_is_persisted(self):
        with patch('requests.get') as request:
            request.return_value.text = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n'
            self.assertTrue(self.cache.refresh_cache())
        self.assertEqual(self.cache.cache_data['events'], [])
        self.assertEqual(self.cache.cache_data['stats']['known_rooms'], 41)
        self.cache.save_cache.assert_called_once()
        request.assert_called_once()

    def test_invalid_payload_must_not_replace_last_good_cache(self):
        before = copy.deepcopy(self.cache.cache_data)
        with patch('requests.get') as request:
            request.return_value.text = '<html>upstream unavailable</html>'
            self.assertFalse(self.cache.refresh_cache())
        self.assertEqual(self.cache.cache_data, before)
        self.cache.save_cache.assert_not_called()

    def test_persistence_failure_preserves_memory_and_timestamp(self):
        before = copy.deepcopy(self.cache.cache_data)
        timestamp = self.cache.last_update
        self.cache.save_cache.return_value = False
        with patch.object(self.cache_module, 'get_events_this_week', return_value=[]), patch.object(self.cache_module, 'get_available_rooms_today', return_value=[]):
            self.assertFalse(self.cache.refresh_cache())
        self.assertEqual(self.cache.cache_data, before)
        self.assertEqual(self.cache.last_update, timestamp)

    def test_failed_serialization_does_not_truncate_persisted_cache(self):
        path = Path(self.cache.cache_file)
        path.write_text('previous synthetic cache', encoding='utf-8')
        with patch.object(self.cache_module.json, 'dump', side_effect=OSError('synthetic disk full')):
            self.assertFalse(self.cache_module.ESIEECacheManager.save_cache(self.cache))
        self.assertEqual(path.read_text(encoding='utf-8'), 'previous synthetic cache')
        self.assertEqual(list(path.parent.glob('.*.tmp')), [])

    def test_offline_calendar_cache_disk_and_flask_endpoints(self):
        fixture = (Path(__file__).parent / 'fixtures' / 'synthetic-week.ics').read_text()
        del self.cache.save_cache  # use real JSON persistence, not a mock
        with patch('requests.get') as request:
            request.return_value.text = fixture
            self.assertTrue(self.cache.refresh_cache())
            request.assert_called_once()
        self.assertEqual(self.cache.cache_data['stats']['total_events'], 2)
        self.assertEqual(self.cache.cache_data['stats']['rooms_with_schedules'], 3)
        reloaded = self.cache_module.ESIEECacheManager(self.cache.cache_file)
        self.assertTrue(reloaded.is_cache_valid())
        with patch.object(self.cache_module, 'cache_manager', reloaded), patch.object(self.application, 'cache_manager', reloaded):
            client = self.application.app.test_client()
            response = client.get('/api/health')
            self.assertEqual(response.status_code, 200)
            for room in ['112', '113']:
                schedule = client.get(f'/api/rooms/{room}/schedule')
                self.assertEqual(schedule.status_code, 200)
                self.assertEqual(len(schedule.json['schedule']['monday']), 1)
                self.assertEqual(schedule.json['schedule']['monday'][0]['start'], '10:00')
                occupied = client.get(f'/api/rooms/{room}/availability?day=monday&time=10:30')
                self.assertEqual(occupied.status_code, 200)
                self.assertEqual(occupied.json['status'], 'occupé')
                free = client.get(f'/api/rooms/{room}/availability?day=monday&time=11:00')
                self.assertEqual(free.json['status'], 'libre')
            rooms = client.get('/api/rooms')
            self.assertEqual(rooms.status_code, 200)
            self.assertEqual(rooms.json['total_rooms'], 41)
            self.assertEqual(len(rooms.json['room_schedules']), 3)
            events = client.get('/api/events/this-week')
            self.assertEqual(events.status_code, 200)
            self.assertEqual(events.json['total_events'], 2)
            stats = client.get('/api/stats')
            self.assertEqual(stats.status_code, 200)
            self.assertEqual(stats.json['stats']['total_rooms'], 41)

    def test_successful_empty_calendar_round_trips_to_disk(self):
        del self.cache.save_cache
        with patch('requests.get') as request:
            request.return_value.text = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR\n'
            self.assertTrue(self.cache.refresh_cache())
            request.assert_called_once()
        reloaded = self.cache_module.ESIEECacheManager(self.cache.cache_file)
        self.assertTrue(reloaded.is_cache_valid())
        self.assertEqual(reloaded.cache_data['events'], [])

    def test_fetch_exception_keeps_last_good_cache(self):
        before = copy.deepcopy(self.cache.cache_data)
        with patch('requests.get', side_effect=TimeoutError('synthetic timeout')):
            self.assertFalse(self.cache.refresh_cache())
        self.assertEqual(self.cache.cache_data, before)
        self.cache.save_cache.assert_not_called()

    def test_cache_age_boundaries(self):
        fixed = datetime(2026, 10, 12, 12)
        with patch.object(self.cache_module, 'datetime') as clock:
            clock.now.return_value = fixed
            for age, valid in [(timedelta(0), True), (timedelta(minutes=59), True),
                               (timedelta(hours=1), False), (timedelta(microseconds=-1), False)]:
                with self.subTest(age=age):
                    self.cache.last_update = fixed - age
                    self.assertEqual(self.cache.is_cache_valid(), valid)

    def test_room_tokens_are_exact_and_support_both_comma_formats(self):
        for location, rooms in [('PER - 113', ['113']), ('PER - 113, 112', ['113', '112']),
                                ('PER - 113\\,112', ['113', '112']), ('OTHER - 113', []),
                                ('PER - 1130', ['1130']), ('PER - 113x', []), ('', []), (None, [])]:
            with self.subTest(location=location):
                self.assertEqual(self.events_module.get_per_room_numbers(location), rooms)

    def test_multisalle_direct_room_fetch(self):
        fixture = (Path(__file__).parent / 'fixtures' / 'synthetic-week.ics').read_text()
        with patch('requests.get') as request:
            request.return_value.text = fixture
            self.assertEqual(len(self.events_module.get_events_for_room('PER - 112')), 2)
            self.assertEqual(self.events_module.get_events_for_room('PER - 1130'), [])

    def test_replace_failure_preserves_old_disk_cache(self):
        path = Path(self.cache.cache_file)
        path.write_text('synthetic previous cache')
        with patch.object(self.cache_module.os, 'replace', side_effect=PermissionError('synthetic permission denied')):
            self.assertFalse(self.cache_module.ESIEECacheManager.save_cache(self.cache))
        self.assertEqual(path.read_text(), 'synthetic previous cache')
        self.assertEqual(list(path.parent.glob('.*.tmp')), [])


if __name__ == '__main__':
    unittest.main()
