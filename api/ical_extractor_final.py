#!/usr/bin/env python3
"""
Extracteur iCal final optimisé pour ESIEE
Utilise les paramètres de date découverts pour extraire les données de n'importe quelle semaine
"""

import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import json
import logging
import re

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ESIEEiCalExtractor:
    """Extracteur de base pour iCal ESIEE"""

    def __init__(self):
        self.base_ical_url = "https://edt-consult.univ-eiffel.fr/jsp/custom/modules/plannings/anonymous_cal.jsp"
        self.events_data = []
        self.rooms_data = {}

    def extract_from_ical_url(self, url: str) -> bool:
        """Extrait les données depuis une URL iCal"""
        try:
            logger.info(f"📡 Récupération depuis: {url}")
            response = requests.get(url, timeout=30)
            response.raise_for_status()

            ical_content = response.text
            logger.info(f"📄 {len(ical_content)} caractères reçus")

            return self._parse_ical_content(ical_content)

        except Exception as e:
            logger.error(f"❌ Erreur lors de l'extraction: {e}")
            return False

    def _parse_ical_content(self, content: str) -> bool:
        """Parse le contenu iCal"""
        events = []
        rooms_summary = {}

        # Diviser le contenu en événements
        event_blocks = content.split('BEGIN:VEVENT')[1:]

        for block in event_blocks:
            event_data = self._parse_event_block(block)
            if event_data:
                events.append(event_data)

                # Traiter les données de salle
                room_full = event_data.get('room_full')
                if room_full:
                    if room_full not in rooms_summary:
                        building, room_number = self._extract_room_info(room_full)
                        rooms_summary[room_full] = {
                            'building': building,
                            'room_number': room_number,
                            'events_count': 0,
                            'time_slots_used': []
                        }

                    rooms_summary[room_full]['events_count'] += 1
                    rooms_summary[room_full]['time_slots_used'].append({
                        'start': event_data.get('start_datetime'),
                        'end': event_data.get('end_datetime'),
                        'summary': event_data.get('summary', '')
                    })

        # Stocker les résultats
        self.events_data = events
        self.rooms_data = {
            'total_events': len(events),
            'total_rooms': len(rooms_summary),
            'rooms_summary': rooms_summary
        }

        logger.info(f"✅ {len(events)} événements et {len(rooms_summary)} salles extraits")
        return True

    def _parse_event_block(self, block: str) -> Optional[Dict]:
        """Parse un bloc d'événement iCal"""
        try:
            lines = block.split('\n')
            event = {}

            for line in lines:
                line = line.strip()
                if ':' in line:
                    key, value = line.split(':', 1)

                    if key == 'DTSTART':
                        event['start_datetime'] = self._parse_ical_datetime(value)
                    elif key == 'DTEND':
                        event['end_datetime'] = self._parse_ical_datetime(value)
                    elif key == 'SUMMARY':
                        event['summary'] = value
                    elif key == 'LOCATION':
                        event['location'] = value
                        event['room_full'] = value

            return event if event else None

        except Exception as e:
            logger.warning(f"⚠️ Erreur lors du parsing d'un événement: {e}")
            return None

    def _parse_ical_datetime(self, datetime_str: str) -> Optional[datetime]:
        """Parse une date/heure iCal en prenant en compte le fuseau horaire français"""
        try:
            # Format iCal standard: 20251009T080000Z ou 20251009T080000
            from datetime import timedelta

            datetime_str = datetime_str.replace('Z', '').replace('T', '')
            if len(datetime_str) == 14:  # YYYYMMDDHHMMSS
                # Parse comme UTC d'abord
                utc_dt = datetime.strptime(datetime_str, '%Y%m%d%H%M%S')

                # Convertir en heure française (UTC+1 en hiver, UTC+2 en été)
                # Déterminer si on est en heure d'été ou d'hiver
                if self._is_dst(utc_dt):
                    # Heure d'été (CEST) = UTC + 2 heures
                    local_dt = utc_dt + timedelta(hours=2)
                else:
                    # Heure d'hiver (CET) = UTC + 1 heure
                    local_dt = utc_dt + timedelta(hours=1)

                return local_dt
            return None
        except Exception:
            return None

    def _is_dst(self, dt: datetime) -> bool:
        """Détermine si une date est en période d'heure d'été en France"""
        # Heure d'été en France: dernier dimanche de mars au dernier dimanche d'octobre
        year = dt.year

        # Dernier dimanche de mars
        march_last_sunday = datetime(year, 3, 31)
        while march_last_sunday.weekday() != 6:  # 6 = dimanche
            march_last_sunday = march_last_sunday.replace(day=march_last_sunday.day - 1)

        # Dernier dimanche d'octobre
        october_last_sunday = datetime(year, 10, 31)
        while october_last_sunday.weekday() != 6:
            october_last_sunday = october_last_sunday.replace(day=october_last_sunday.day - 1)

        return march_last_sunday <= dt <= october_last_sunday

    def _extract_room_info(self, room_full: str) -> tuple:
        """Extrait le bâtiment et numéro de salle"""
        # Format attendu: "BâtimentXXX - NuméroSalle"
        if ' - ' in room_full:
            parts = room_full.split(' - ')
            return parts[0].strip(), parts[1].strip()
        return room_full, ''

    def save_data(self, filename: str):
        """Sauvegarde les données dans un fichier JSON"""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump({
                'events': self.events_data,
                'rooms': self.rooms_data
            }, f, ensure_ascii=False, indent=2, default=str)
        logger.info(f"💾 Données sauvegardées dans {filename}")

class ESIEEiCalFinalExtractor(ESIEEiCalExtractor):
    """Extracteur iCal final avec gestion complète des dates"""

    def __init__(self):
        super().__init__()

    def extract_for_week(self, week_offset: int = 0, nb_weeks: int = 1) -> bool:
        """
        Extrait les données pour une semaine spécifique

        Args:
            week_offset: Offset en semaines (0=cette semaine, 1=semaine prochaine, -1=semaine dernière)
            nb_weeks: Nombre de semaines à extraire
        """
        # Calculer la date du lundi de la semaine cible
        today = datetime.now()
        current_monday = today - timedelta(days=today.weekday())
        target_monday = current_monday + timedelta(weeks=week_offset)

        week_name = self._get_week_name(week_offset)
        logger.info(f"📅 Extraction pour {week_name} (du {target_monday.strftime('%d/%m/%Y')})")

        return self._extract_for_date(target_monday, nb_weeks)

    def extract_next_week(self) -> bool:
        """Extrait les données de la semaine prochaine"""
        return self.extract_for_week(week_offset=1, nb_weeks=1)

    def extract_current_week(self) -> bool:
        """Extrait les données de la semaine courante"""
        return self.extract_for_week(week_offset=0, nb_weeks=1)

    def extract_last_week(self) -> bool:
        """Extrait les données de la semaine dernière"""
        return self.extract_for_week(week_offset=-1, nb_weeks=1)

    def extract_next_month(self) -> bool:
        """Extrait les données du mois prochain (4 semaines)"""
        return self.extract_for_week(week_offset=1, nb_weeks=4)

    def extract_for_date_range(self, start_date: str, end_date: str) -> bool:
        """
        Extrait les données pour une plage de dates

        Args:
            start_date: Date de début (format YYYY-MM-DD)
            end_date: Date de fin (format YYYY-MM-DD)
        """
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        end_dt = datetime.strptime(end_date, '%Y-%m-%d')

        # Calculer le nombre de semaines
        delta = end_dt - start_dt
        nb_weeks = max(1, (delta.days // 7) + 1)

        logger.info(f"📈 Extraction du {start_date} au {end_date} ({nb_weeks} semaines)")

        return self._extract_for_date(start_dt, nb_weeks)

    def _extract_for_date(self, start_date: datetime, nb_weeks: int) -> bool:
        """Extrait les données pour une date et durée spécifiques"""
        # Utiliser firstDate qui donne le plus de résultats
        date_str = start_date.strftime('%Y-%m-%d')

        url = (f"{self.base_ical_url}?"
               f"resources=410&projectId=1&calType=ical&"
               f"nbWeeks={nb_weeks}&displayConfigId=8&"
               f"firstDate={date_str}")

        logger.info(f"🔗 URL: {url}")

        return self.extract_from_ical_url(url)

    def _get_week_name(self, week_offset: int) -> str:
        """Retourne le nom de la semaine selon l'offset"""
        if week_offset == 0:
            return "la semaine courante"
        elif week_offset == 1:
            return "la semaine prochaine"
        elif week_offset == -1:
            return "la semaine dernière"
        elif week_offset > 1:
            return f"dans {week_offset} semaines"
        else:
            return f"il y a {abs(week_offset)} semaines"

    def get_room_availability_for_week(self, week_offset: int = 1) -> Dict:
        """
        Retourne la disponibilité des salles pour une semaine spécifique
        avec calcul des créneaux libres
        """
        if not self.extract_for_week(week_offset):
            return {}

        rooms_summary = self.rooms_data.get('rooms_summary', {})
        availability = {}

        # Définir les créneaux horaires standards (8h-18h par tranches de 30min)
        time_slots = []
        for hour in range(8, 18):
            time_slots.append(f"{hour:02d}h00")
            time_slots.append(f"{hour:02d}h30")

        # Jours de la semaine
        weekdays = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']

        for room_name, room_data in rooms_summary.items():
            # Initialiser tous les créneaux comme libres
            room_schedule = {}
            for day in weekdays:
                room_schedule[day] = {slot: 'libre' for slot in time_slots}

            # Marquer les créneaux occupés
            for event in room_data.get('time_slots_used', []):
                event_date = event.get('start')
                if isinstance(event_date, datetime):
                    day_name = event_date.strftime('%A')
                    # Traduire en français
                    day_mapping = {
                        'Monday': 'Lundi', 'Tuesday': 'Mardi', 'Wednesday': 'Mercredi',
                        'Thursday': 'Jeudi', 'Friday': 'Vendredi'
                    }
                    day_fr = day_mapping.get(day_name)

                    if day_fr and day_fr in room_schedule:
                        hour = event_date.hour
                        minute = event_date.minute
                        time_slot = f"{hour:02d}h{minute:02d}"

                        if time_slot in room_schedule[day_fr]:
                            room_schedule[day_fr][time_slot] = 'occupé'

            availability[room_name] = {
                'building': room_data.get('building'),
                'room_number': room_data.get('room_number'),
                'schedule': room_schedule,
                'occupation_rate': self._calculate_occupation_rate(room_schedule)
            }

        return availability

    def _calculate_occupation_rate(self, schedule: Dict) -> float:
        """Calcule le taux d'occupation d'une salle"""
        total_slots = 0
        occupied_slots = 0

        for day_schedule in schedule.values():
            for status in day_schedule.values():
                total_slots += 1
                if status == 'occupé':
                    occupied_slots += 1

        return (occupied_slots / total_slots * 100) if total_slots > 0 else 0

def demo_usage():
    """Démonstration d'utilisation de l'extracteur final"""
    print("🚀 Démonstration de l'extracteur iCal final")

    extractor = ESIEEiCalFinalExtractor()

    # Test 1: Semaine courante
    print("\n📍 1. Extraction semaine courante...")
    if extractor.extract_current_week():
        data = extractor.rooms_data
        print(f"   ✅ {data['total_events']} événements, {data['total_rooms']} salles")
        extractor.save_data("semaine_courante.json")

    # Test 2: Semaine prochaine
    print("\n➡️ 2. Extraction semaine prochaine...")
    if extractor.extract_next_week():
        data = extractor.rooms_data
        print(f"   ✅ {data['total_events']} événements, {data['total_rooms']} salles")
        extractor.save_data("semaine_prochaine.json")

    # Test 3: Mois prochain
    print("\n📅 3. Extraction mois prochain (4 semaines)...")
    if extractor.extract_next_month():
        data = extractor.rooms_data
        print(f"   ✅ {data['total_events']} événements, {data['total_rooms']} salles")
        extractor.save_data("mois_prochain.json")

    # Test 4: Plage de dates spécifique
    print("\n📈 4. Extraction période spécifique (26/09 au 10/10)...")
    if extractor.extract_for_date_range("2025-09-26", "2025-10-10"):
        data = extractor.rooms_data
        print(f"   ✅ {data['total_events']} événements, {data['total_rooms']} salles")
        extractor.save_data("periode_specifique.json")

    # Test 5: Disponibilité des salles pour la semaine prochaine
    print("\n🏢 5. Calcul de disponibilité semaine prochaine...")
    availability = extractor.get_room_availability_for_week(week_offset=1)

    if availability:
        print(f"   📊 Disponibilité calculée pour {len(availability)} salles")

        # Afficher les 3 salles les moins occupées
        sorted_rooms = sorted(availability.items(),
                            key=lambda x: x[1]['occupation_rate'])

        print("   🟢 Top 3 des salles les moins occupées:")
        for i, (room_name, room_info) in enumerate(sorted_rooms[:3]):
            rate = room_info['occupation_rate']
            print(f"     {i+1}. {room_name}: {rate:.1f}% d'occupation")

        # Sauvegarder la disponibilité
        with open("disponibilite_semaine_prochaine.json", "w", encoding="utf-8") as f:
            json.dump(availability, f, ensure_ascii=False, indent=2, default=str)

        print("   💾 Disponibilité sauvegardée dans disponibilite_semaine_prochaine.json")

    print("\n🎉 Démonstration terminée !")
    print("💡 Vous pouvez maintenant extraire les données de n'importe quelle semaine !")

if __name__ == "__main__":
    demo_usage()