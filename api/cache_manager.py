#!/usr/bin/env python3
"""
Gestionnaire de cache pour l'API ESIEE
Récupère les données une fois par heure et les stocke en JSON
"""

import json
import os
import re
import tempfile
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import logging
from events_api import get_events_this_week, get_available_rooms_today
from data_directory import data_path

logger = logging.getLogger(__name__)

class ESIEECacheManager:
    # Liste des salles connues de l'ESIEE (salles PER)
    # Ces salles sont toujours affichées, même sans cours programmés
    KNOWN_ROOMS = {
        # Amphithéâtres (Rue - 3 chiffres)
        '110': {'name': 'Amphithéâtre 110', 'board': 'Tableau à craie', 'capacity': '116', 'type': 'Amphithéâtre'},
        '160': {'name': 'Amphithéâtre 160', 'board': 'Tableau à craie', 'capacity': '116', 'type': 'Amphithéâtre'},
        '210': {'name': 'Amphithéâtre 210', 'board': 'Tableau à craie', 'capacity': '156', 'type': 'Amphithéâtre'},
        '260': {'name': 'Amphithéâtre 260', 'board': 'Tableau à craie', 'capacity': '156', 'type': 'Amphithéâtre'},
        # Salles Rue (3 chiffres)
        '112': {'name': 'Salle 112', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '113': {'name': 'Salle 113', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '115': {'name': 'Salle 115', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '164': {'name': 'Salle 164', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '165': {'name': 'Salle 165', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        # Epis 1
        '1101': {'name': 'Salle 1101', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '1102': {'name': 'Salle 1102', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '1103': {'name': 'Salle 1103', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '1201': {'name': 'Salle 1201', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '1202': {'name': 'Salle 1202', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '1203': {'name': 'Salle 1203', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        # Epis 2
        '2101': {'name': 'Salle 2101', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '2102': {'name': 'Salle 2102', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '2103': {'name': 'Salle 2103', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '2104': {'name': 'Salle 2104', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '2105': {'name': 'Salle 2105', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '2201': {'name': 'Salle 2201', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '2202': {'name': 'Salle 2202', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '2203': {'name': 'Salle 2203', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        # Epis 3
        '3101': {'name': 'Salle 3101', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '3102': {'name': 'Salle 3102', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '3103': {'name': 'Salle 3103', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '3201': {'name': 'Salle 3201', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '3202': {'name': 'Salle 3202', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '3203': {'name': 'Salle 3203', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        # Epis 4
        '4101': {'name': 'Salle 4101', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '4102': {'name': 'Salle 4102', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '4103': {'name': 'Salle 4103', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '4201': {'name': 'Salle 4201', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '4202': {'name': 'Salle 4202', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '4203': {'name': 'Salle 4203', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        # Epis 5
        '5101': {'name': 'Salle 5101', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '5102': {'name': 'Salle 5102', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '5103': {'name': 'Salle 5103', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '5201': {'name': 'Salle 5201', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '5202': {'name': 'Salle 5202', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
        '5203': {'name': 'Salle 5203', 'board': 'Tableau blanc', 'capacity': '30', 'type': 'Salle classique'},
    }

    def __init__(self, cache_file: Optional[str] = None, cache_duration_hours: int = 1):
        self.cache_file = data_path(cache_file, "esiee_cache.json")
        self.cache_duration = timedelta(hours=cache_duration_hours)
        self.cache_data = None
        self.last_update = None

        # Charger le cache existant s'il existe
        self.load_cache()

    def load_cache(self) -> bool:
        """Charge le cache depuis le fichier JSON"""
        try:
            if os.path.exists(self.cache_file):
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    cache_content = json.load(f)

                self.cache_data = cache_content.get('data')
                last_update_str = cache_content.get('last_update')

                if last_update_str:
                    self.last_update = datetime.fromisoformat(last_update_str)
                    logger.info(f"📁 Cache chargé depuis {self.cache_file}, dernière MAJ: {self.last_update}")
                    return True

        except Exception as e:
            logger.warning(f"⚠️ Erreur lors du chargement du cache: {e}")

        return False

    def save_cache(self) -> bool:
        """Sauvegarde le cache dans le fichier JSON"""
        temporary_path = None
        try:
            cache_content = {
                'last_update': self.last_update.isoformat() if self.last_update else None,
                'data': self.cache_data
            }

            # Écrire à côté du cache puis remplacer atomiquement : un disque plein
            # ou une sérialisation échouée ne doit pas détruire le dernier cache.
            directory = os.path.dirname(os.path.abspath(self.cache_file))
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8',
                                             dir=directory, prefix='.esiee-cache-',
                                             suffix='.tmp', delete=False) as f:
                temporary_path = f.name
                json.dump(cache_content, f, ensure_ascii=False, indent=2, default=str)
            os.replace(temporary_path, self.cache_file)
            temporary_path = None

            logger.info(f"💾 Cache sauvegardé dans {self.cache_file}")
            return True

        except Exception as e:
            logger.error(f"❌ Erreur lors de la sauvegarde du cache: {e}")
            return False
        finally:
            if temporary_path is not None:
                try:
                    os.unlink(temporary_path)
                except OSError:
                    logger.warning("⚠️ Impossible de supprimer le fichier temporaire du cache")

    def is_cache_valid(self) -> bool:
        """Vérifie si le cache est encore valide"""
        if not self.cache_data or not self.last_update:
            return False

        now = datetime.now()
        return timedelta(0) <= (now - self.last_update) < self.cache_duration

    def refresh_cache(self) -> bool:
        """Rafraîchit le cache avec de nouvelles données"""
        logger.info("🔄 Rafraîchissement du cache ESIEE...")

        try:
            # Récupérer toutes les données ESIEE
            logger.info("📡 Récupération des événements...")
            events = get_events_this_week()

            logger.info("🏢 Récupération des salles disponibles...")
            available_rooms = get_available_rooms_today(events)

            # Fonction de déduplication des événements
            def deduplicate_events(events_list):
                """Supprime les événements en doublons basés sur les propriétés clés"""
                seen_events = set()
                unique_events = []

                for event in events_list:
                    # Créer une clé unique basée sur les propriétés importantes de l'événement
                    event_key = (
                        event.get('summary', ''),
                        event.get('room_full', ''),
                        str(event.get('start_datetime', '')),
                        str(event.get('end_datetime', ''))
                    )

                    if event_key not in seen_events:
                        seen_events.add(event_key)
                        unique_events.append(event)
                    else:
                        logger.debug(f"🔄 Doublon supprimé: {event.get('summary')} en {event.get('room_full')}")

                return unique_events

            # Dédupliquer les événements avant traitement
            original_count = len(events)
            events = deduplicate_events(events)
            deduplicated_count = len(events)

            if original_count != deduplicated_count:
                logger.info(f"🧹 Déduplication: {original_count} → {deduplicated_count} événements ({original_count - deduplicated_count} doublons supprimés)")

            # Extraire les salles PER avec nettoyage
            all_per_rooms = set()
            room_events = {}

            for event in events:
                location = event.get('room_full', '')
                if 'PER - ' in location:
                    room_numbers_raw = location.replace('PER - ', '').strip()
                    # Nettoyer et valider
                    import re

                    # Gérer les salles multiples (ex: "113\,112\,165\,160\,164\,115")
                    room_numbers = []
                    if '\\,' in room_numbers_raw or ',' in room_numbers_raw:
                        # Séparer les salles multiples
                        room_list = room_numbers_raw.replace('\\,', ',').split(',')
                        for room_num in room_list:
                            room_num = room_num.strip()
                            if re.match(r'^[0-9]{3,4}$', room_num):
                                room_numbers.append(room_num)
                    else:
                        # Salle unique
                        if re.match(r'^[0-9]{3,4}$', room_numbers_raw):
                            room_numbers.append(room_numbers_raw)

                    # Traiter chaque salle
                    for room_number in room_numbers:
                        all_per_rooms.add(room_number)

                        # Organiser les événements par salle
                        if room_number not in room_events:
                            room_events[room_number] = []

                        # Convertir les datetime en strings pour la sérialisation JSON
                        serializable_event = event.copy()
                        for key in ['start_datetime', 'end_datetime']:
                            if key in serializable_event and isinstance(serializable_event[key], datetime):
                                serializable_event[key] = serializable_event[key].isoformat()

                        room_events[room_number].append(serializable_event)

            # Organiser les emplois du temps par salle pour le calcul côté client
            room_schedules = {}

            for event in events:
                location = event.get('room_full', '')
                if 'PER - ' in location:
                    room_numbers_raw = location.replace('PER - ', '').strip()
                    start_time = event.get('start_datetime')
                    end_time = event.get('end_datetime')

                    # Convertir les datetime en strings pour JSON
                    if isinstance(start_time, datetime):
                        start_time_str = start_time.isoformat()
                    else:
                        start_time_str = str(start_time)

                    if isinstance(end_time, datetime):
                        end_time_str = end_time.isoformat()
                    else:
                        end_time_str = str(end_time)

                    # Créer l'événement simplifié pour le client
                    schedule_event = {
                        'start': start_time_str,
                        'end': end_time_str,
                        'summary': event.get('summary', 'Cours')
                    }

                    # Gérer les salles multiples
                    room_numbers = []
                    if '\\,' in room_numbers_raw or ',' in room_numbers_raw:
                        room_list = room_numbers_raw.replace('\\,', ',').split(',')
                        for room_num in room_list:
                            room_num = room_num.strip()
                            if re.match(r'^[0-9]{3,4}$', room_num):
                                room_numbers.append(room_num)
                    else:
                        if re.match(r'^[0-9]{3,4}$', room_numbers_raw):
                            room_numbers.append(room_numbers_raw)

                    # Ajouter l'événement à chaque salle concernée
                    for room_number in room_numbers:
                        if room_number not in room_schedules:
                            room_schedules[room_number] = []
                        room_schedules[room_number].append(schedule_event)

            # Trier les emplois du temps par heure de début
            for room_number in room_schedules:
                room_schedules[room_number].sort(key=lambda x: x['start'])

            logger.info(f"📊 Emplois du temps générés pour {len(room_schedules)} salles")

            # Créer les données de salles en utilisant les salles connues comme base
            # Toutes les salles connues sont toujours incluses, même sans cours
            rooms_data = {}
            
            # D'abord, ajouter toutes les salles connues
            for room, room_info in self.KNOWN_ROOMS.items():
                rooms_data[room] = room_info.copy()
            
            # Ensuite, ajouter les salles découvertes dans les événements (si nouvelles)
            for room in all_per_rooms:
                if room not in rooms_data:
                    # Déterminer le type selon le numéro (les 4 amphithéâtres spécifiques)
                    if room in ['110', '160']:
                        room_type = 'Amphithéâtre'
                        capacity = '116'
                        board = 'Tableau à craie'
                    elif room in ['210', '260']:
                        room_type = 'Amphithéâtre'
                        capacity = '156'
                        board = 'Tableau à craie'
                    else:
                        room_type = 'Salle classique'
                        capacity = '30'
                        board = 'Tableau blanc'

                    rooms_data[room] = {
                        'name': f'Salle {room}',
                        'board': board,
                        'capacity': capacity,
                        'type': room_type
                    }
            
            # Nombre total de salles (connues + découvertes)
            total_rooms = len(rooms_data)

            # Structurer les données du cache
            previous_data, previous_update = self.cache_data, self.last_update
            self.cache_data = {
                'events': events,
                'available_rooms': list(available_rooms),
                'room_schedules': room_schedules,  # Emplois du temps par salle pour le client
                'rooms_data': rooms_data,
                'room_events': room_events,
                'stats': {
                    'total_events': len(events),
                    'total_rooms': total_rooms,
                    'rooms_with_schedules': len(room_schedules),
                    'known_rooms': len(self.KNOWN_ROOMS),
                    'discovered_rooms': len(all_per_rooms)
                }
            }

            self.last_update = datetime.now()

            # Sauvegarder le cache
            if not self.save_cache():
                self.cache_data, self.last_update = previous_data, previous_update
                return False

            logger.info(f"✅ Cache rafraîchi: {len(events)} événements, {total_rooms} salles ({len(self.KNOWN_ROOMS)} connues)")
            return True

        except Exception as e:
            logger.error(f"❌ Erreur lors du rafraîchissement du cache: {e}")
            return False

    def get_cached_data(self) -> Optional[Dict]:
        """Récupère les données du cache, les rafraîchit si nécessaire"""
        if not self.is_cache_valid():
            logger.info("⏰ Cache expiré, rafraîchissement nécessaire")
            if not self.refresh_cache():
                logger.warning("⚠️ Échec du rafraîchissement, utilisation du cache existant")
        else:
            time_left = self.cache_duration - (datetime.now() - self.last_update)
            logger.info(f"✅ Cache valide, prochaine MAJ dans {time_left}")

        return self.cache_data

    def force_refresh(self) -> bool:
        """Force le rafraîchissement du cache"""
        return self.refresh_cache()

    def get_cache_info(self) -> Dict:
        """Retourne les informations sur le cache"""
        return {
            'cache_file': self.cache_file,
            'last_update': self.last_update.isoformat() if self.last_update else None,
            'is_valid': self.is_cache_valid(),
            'cache_duration_hours': self.cache_duration.total_seconds() / 3600,
            'data_available': self.cache_data is not None
        }

# Instance globale du gestionnaire de cache
cache_manager = ESIEECacheManager()

def get_cached_events():
    """Récupère les événements depuis le cache avec conversion des datetime"""
    data = cache_manager.get_cached_data()
    if not data:
        return []

    events = data.get('events', [])

    # Convertir les strings ISO en objets datetime
    for event in events:
        for key in ['start_datetime', 'end_datetime']:
            if key in event and isinstance(event[key], str):
                try:
                    from datetime import datetime
                    event[key] = datetime.fromisoformat(event[key])
                except ValueError:
                    pass

    return events

def get_cached_room_schedules():
    """Récupère les emplois du temps des salles depuis le cache"""
    data = cache_manager.get_cached_data()
    return data.get('room_schedules', {}) if data else {}

def get_cached_rooms_data():
    """Récupère les données des salles depuis le cache"""
    data = cache_manager.get_cached_data()
    return data.get('rooms_data', {}) if data else {}

def get_cached_available_rooms():
    """Récupère les salles disponibles depuis le cache"""
    data = cache_manager.get_cached_data()
    return data.get('available_rooms', []) if data else []

def get_cache_stats():
    """Récupère les statistiques du cache"""
    data = cache_manager.get_cached_data()
    if data and 'stats' in data:
        stats = data['stats'].copy()
        stats['cache_info'] = cache_manager.get_cache_info()
        return stats
    return {}

def force_cache_refresh():
    """Force le rafraîchissement du cache"""
    return cache_manager.force_refresh()

if __name__ == "__main__":
    # Test du gestionnaire de cache
    logging.basicConfig(level=logging.INFO)

    print("🧪 Test du gestionnaire de cache ESIEE")

    # Test de récupération des données
    data = cache_manager.get_cached_data()
    if data:
        print(f"✅ Données récupérées: {data['stats']}")
    else:
        print("❌ Aucune donnée disponible")

    # Afficher les infos du cache
    cache_info = cache_manager.get_cache_info()
    print(f"📊 Info cache: {cache_info}")