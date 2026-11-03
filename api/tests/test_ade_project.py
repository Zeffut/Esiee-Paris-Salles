import sys
import unittest
from pathlib import Path
from unittest.mock import patch

API_DIR = Path(__file__).resolve().parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

import ical_extractor_final as ade  # noqa: E402

EVENT = (
    "BEGIN:VEVENT\nDTSTART:20261103T090000Z\nDTEND:20261103T110000Z\n"
    "SUMMARY:Cours\nLOCATION:PER - 2205\nEND:VEVENT\n"
)


def fake_ical(projects_with_events):
    def fake_get(url, timeout=30):
        pid = int(url.split("projectId=")[1].split("&")[0])

        class R:
            text = "BEGIN:VCALENDAR\n" + (EVENT * 3 if pid in projects_with_events else "") + "END:VCALENDAR"

            def raise_for_status(self):
                pass

        return R()
    return fake_get


class AdeProjectDiscoveryTests(unittest.TestCase):
    def setUp(self):
        ade._ade_project.update({"id": 1, "last_scan": None})

    def test_switches_to_project_with_esiee_events(self):
        with patch.object(ade.requests, "get", side_effect=fake_ical({2})):
            extractor = ade.ESIEEiCalFinalExtractor()
            self.assertTrue(extractor.extract_current_week())
        self.assertEqual(ade._ade_project["id"], 2)
        self.assertEqual(extractor.rooms_data["total_events"], 3)

    def test_keeps_current_project_when_it_has_events(self):
        ade._ade_project["id"] = 2
        with patch.object(ade.requests, "get", side_effect=fake_ical({2, 3})) as get:
            ade.ESIEEiCalFinalExtractor().extract_current_week()
        self.assertEqual(get.call_count, 1)
        self.assertEqual(ade._ade_project["id"], 2)

    def test_holidays_do_not_rescan_more_than_every_six_hours(self):
        with patch.object(ade.requests, "get", side_effect=fake_ical(set())) as get:
            ade.ESIEEiCalFinalExtractor().extract_current_week()
            first = get.call_count
            ade.ESIEEiCalFinalExtractor().extract_current_week()
        self.assertEqual(first, ade.ADE_MAX_PROJECT_ID)  # 1 requête + 11 autres projets
        self.assertEqual(get.call_count, first + 1)      # pas de nouveau balayage
        self.assertEqual(ade._ade_project["id"], 1)


if __name__ == "__main__":
    unittest.main()
