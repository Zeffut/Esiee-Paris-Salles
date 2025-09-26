#!/usr/bin/env python3
"""
API simple pour récupérer les événements ESIEE
Fonction principale : get_events_this_week()
"""

from datetime import datetime
from typing import List, Dict, Optional
from ical_extractor_final import ESIEEiCalFinalExtractor

def get_events_this_week() -> List[Dict]:
    """
    Fonction principale pour récupérer les événements de cette semaine

    Returns:
        List[Dict]: Liste des événements avec leurs informations

    Exemple d'utilisation:
        events = get_events_this_week()
        print(f"Il y a {len(events)} événements cette semaine")

        for event in events:
            print(f"- {event['summary']} à {event['location']}")
    """
    try:
        extractor = ESIEEiCalFinalExtractor()

        if extractor.extract_current_week():
            return extractor.events_data
        else:
            return []

    except Exception as e:
        print(f"Erreur lors de la récupération des événements: {e}")
        return []

def get_events_next_week() -> List[Dict]:
    """Récupère les événements de la semaine prochaine"""
    try:
        extractor = ESIEEiCalFinalExtractor()

        if extractor.extract_next_week():
            return extractor.events_data
        else:
            return []

    except Exception as e:
        print(f"Erreur lors de la récupération des événements: {e}")
        return []

def get_events_for_room(room_name: str, week_offset: int = 0) -> List[Dict]:
    """
    Récupère les événements pour une salle spécifique

    Args:
        room_name: Nom de la salle (ex: "PER - 210")
        week_offset: 0=cette semaine, 1=semaine prochaine, etc.

    Returns:
        List[Dict]: Événements de cette salle
    """
    try:
        extractor = ESIEEiCalFinalExtractor()

        if extractor.extract_for_week(week_offset=week_offset):
            # Filtrer les événements pour cette salle
            room_events = []
            for event in extractor.events_data:
                if event.get('room_full') == room_name:
                    room_events.append(event)

            return sorted(room_events, key=lambda x: x.get('start_datetime', datetime.min))
        else:
            return []

    except Exception as e:
        print(f"Erreur lors de la récupération des événements pour {room_name}: {e}")
        return []

def get_available_rooms_today() -> List[str]:
    """
    Récupère la liste des salles disponibles maintenant

    Returns:
        List[str]: Liste des noms de salles libres maintenant
    """
    try:
        events = get_events_this_week()
        now = datetime.now()

        # Récupérer toutes les salles
        all_rooms = set()
        occupied_rooms = set()

        for event in events:
            room = event.get('room_full')
            start_time = event.get('start_datetime')
            end_time = event.get('end_datetime')

            if room:
                all_rooms.add(room)

                # Vérifier si la salle est occupée maintenant
                if isinstance(start_time, datetime) and isinstance(end_time, datetime):
                    if start_time <= now <= end_time:
                        occupied_rooms.add(room)

        # Salles libres = toutes les salles - salles occupées
        available_rooms = sorted(list(all_rooms - occupied_rooms))

        return available_rooms

    except Exception as e:
        print(f"Erreur lors de la vérification des salles disponibles: {e}")
        return []

# Fonction de test simple
def test_api():
    """Test simple de l'API"""
    print("🧪 Test de l'API événements ESIEE")

    # Test 1: Événements cette semaine
    print("\n1️⃣ Événements cette semaine:")
    events = get_events_this_week()
    print(f"   📊 {len(events)} événements trouvés")

    if events:
        # Afficher quelques exemples
        print("   📋 Premiers événements:")
        for i, event in enumerate(events[:3]):
            summary = event.get('summary', 'Sans titre')
            location = event.get('room_full', 'Lieu non spécifié')
            start = event.get('start_datetime')

            if isinstance(start, datetime):
                time_str = start.strftime('%d/%m à %H:%M')
            else:
                time_str = 'Heure inconnue'

            print(f"     • {summary} - {location} ({time_str})")

    # Test 2: Événements semaine prochaine
    print("\n2️⃣ Événements semaine prochaine:")
    next_events = get_events_next_week()
    print(f"   📊 {len(next_events)} événements trouvés")

    # Test 3: Salles disponibles maintenant
    print("\n3️⃣ Salles disponibles maintenant:")
    available = get_available_rooms_today()
    print(f"   🟢 {len(available)} salles libres")

    if available:
        print("   📍 Exemples de salles libres:")
        for room in available[:5]:
            print(f"     • {room}")

    # Test 4: Événements d'une salle spécifique
    if events:
        # Prendre la première salle trouvée
        first_room = events[0].get('room_full')
        if first_room:
            print(f"\n4️⃣ Événements de la salle {first_room}:")
            room_events = get_events_for_room(first_room)
            print(f"   📊 {len(room_events)} événements trouvés")

    print("\n✅ Test terminé!")

if __name__ == "__main__":
    test_api()
