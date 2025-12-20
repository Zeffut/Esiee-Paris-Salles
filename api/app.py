# API ESIEE - Gestion des salles et réservations
# Version avec autodeploy configuré
from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime, timedelta
import requests
import threading
from collections import defaultdict
from cache_manager import (
    get_cached_events, get_cached_room_schedules, get_cached_rooms_data,
    get_cached_available_rooms, get_cache_stats, force_cache_refresh,
    cache_manager
)
from events_api import get_events_next_week, get_events_for_room, get_available_rooms_today
from user_manager import user_manager

app = Flask(__name__)
CORS(app,
     supports_credentials=True,
     origins=['http://localhost:8000', 'http://localhost:5500', 'https://esiee.zeffut.fr'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization', 'X-CSRF-Token'])

# Verrou global pour éviter les race conditions sur les réservations
reservation_lock = threading.Lock()

# Rate limiting - Dictionnaire pour tracker les requêtes par IP
rate_limit_storage = defaultdict(list)
rate_limit_lock = threading.Lock()


def get_session_token():
    """
    Récupère le token de session depuis les cookies ou le header Authorization
    """
    # D'abord essayer depuis les cookies
    token = request.cookies.get('esiee_auth_token')
    if token:
        return token

    # Sinon essayer depuis le header Authorization (format: "Bearer <token>")
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        return auth_header[7:]  # Enlever "Bearer "

    return None


def get_room_schedule_from_cache(room_number, week_offset=0):
    """
    Récupère l'emploi du temps d'une salle depuis le cache (ultra rapide)
    """
    try:
        # Pour cette semaine (week_offset=0), utiliser le cache
        if week_offset == 0:
            # Construire le nom complet de la salle
            room_full_name = f"PER - {room_number}"

            # Récupérer tous les événements depuis le cache
            all_events = get_cached_events()

            # Filtrer les événements pour cette salle
            room_events = []
            for event in all_events:
                if event.get('room_full') == room_full_name:
                    room_events.append(event)

            # Organiser par jour de la semaine
            schedule = {
                'monday': [], 'tuesday': [], 'wednesday': [], 'thursday': [],
                'friday': [], 'saturday': [], 'sunday': []
            }

            day_mapping = {
                0: 'monday', 1: 'tuesday', 2: 'wednesday', 3: 'thursday',
                4: 'friday', 5: 'saturday', 6: 'sunday'
            }

            for event in room_events:
                start_time = event.get('start_datetime')
                end_time = event.get('end_datetime')

                if isinstance(start_time, datetime) and isinstance(end_time, datetime):
                    day_name = day_mapping.get(start_time.weekday())
                    if day_name:
                        schedule[day_name].append({
                            'start': start_time.strftime('%H:%M'),
                            'end': end_time.strftime('%H:%M'),
                            'course': event.get('summary', 'Cours'),
                            'full_event': event
                        })

            # Trier chaque jour par heure de début
            for day in schedule:
                schedule[day].sort(key=lambda x: x['start'])

            return schedule

        else:
            # Pour les autres semaines, utiliser l'ancienne méthode (plus lent mais nécessaire)
            room_full_name = f"PER - {room_number}"
            events = get_events_for_room(room_full_name, week_offset)

            schedule = {
                'monday': [], 'tuesday': [], 'wednesday': [], 'thursday': [],
                'friday': [], 'saturday': [], 'sunday': []
            }

            day_mapping = {
                0: 'monday', 1: 'tuesday', 2: 'wednesday', 3: 'thursday',
                4: 'friday', 5: 'saturday', 6: 'sunday'
            }

            for event in events:
                start_time = event.get('start_datetime')
                end_time = event.get('end_datetime')

                if isinstance(start_time, datetime) and isinstance(end_time, datetime):
                    day_name = day_mapping.get(start_time.weekday())
                    if day_name:
                        schedule[day_name].append({
                            'start': start_time.strftime('%H:%M'),
                            'end': end_time.strftime('%H:%M'),
                            'course': event.get('summary', 'Cours'),
                            'full_event': event
                        })

            for day in schedule:
                schedule[day].sort(key=lambda x: x['start'])

            return schedule

    except Exception as e:
        print(f"Erreur lors de la récupération de l'emploi du temps de {room_number}: {e}")
        return {
            'monday': [], 'tuesday': [], 'wednesday': [], 'thursday': [],
            'friday': [], 'saturday': [], 'sunday': []
        }

def is_room_available_at_time(room_number, day, time):
    """
    Détermine si une salle est libre à un moment donné
    en consultant son emploi du temps dynamique depuis le cache ESIEE.

    Args:
        room_number (str): Numéro de la salle
        day (str): Jour de la semaine (monday, tuesday, etc.)
        time (str): Heure au format 'HH:MM'

    Returns:
        bool: True si la salle est libre, False sinon
    """
    schedule = get_room_schedule_from_cache(room_number)
    day_schedule = schedule.get(day, [])

    if not day_schedule:
        return True  # Aucun cours prévu = salle libre

    # Convertir l'heure en minutes pour faciliter la comparaison
    def time_to_minutes(time_str):
        hours, minutes = map(int, time_str.split(':'))
        return hours * 60 + minutes

    current_time_minutes = time_to_minutes(time)

    # Vérifier si l'heure actuelle est dans une plage de cours
    for course in day_schedule:
        start_minutes = time_to_minutes(course['start'])
        end_minutes = time_to_minutes(course['end'])

        if start_minutes <= current_time_minutes < end_minutes:
            return False  # Salle occupée par un cours

    return True  # Aucun conflit trouvé = salle libre

def get_room_availability_from_api(room_number):
    """
    Détermine la disponibilité actuelle d'une salle en utilisant
    les données ESIEE dynamiques depuis le cache - maintenant côté client
    """
    # Cette fonction ne calcule plus le statut, elle retourne juste l'emploi du temps
    # Le calcul du statut se fait côté client
    try:
        schedules = get_dynamic_room_schedules()
        return schedules.get(room_number, [])
    except Exception as e:
        print(f"Erreur lors de la récupération de l'emploi du temps de {room_number}: {e}")
        return []

def get_dynamic_rooms_data():
    """Récupère toutes les données de salles dynamiquement depuis le cache ESIEE"""
    try:
        return get_cached_rooms_data()
    except Exception as e:
        print(f"Erreur lors de la récupération des données de salles: {e}")
        return {}

def get_dynamic_room_schedules():
    """Récupère les emplois du temps des salles dynamiquement depuis le cache ESIEE"""
    try:
        return get_cached_room_schedules()
    except Exception as e:
        print(f"Erreur lors de la récupération des emplois du temps depuis le cache: {e}")
        return {}

def get_room_epis(room_number):
    """Détermine l'Epis selon le premier chiffre du numéro de salle"""
    first_digit = room_number[0]
    epis_map = {
        '0': 'Rue',
        '1': 'Epis 1',
        '2': 'Epis 2',
        '3': 'Epis 3',
        '4': 'Epis 4',
        '5': 'Epis 5',
        '6': 'Epis 6',
        '7': 'Epis 7'
    }
    return epis_map.get(first_digit, 'Rue')

def get_room_floor(room_number):
    """Détermine l'étage selon le deuxième chiffre du numéro de salle"""
    if len(room_number) < 2:
        return 'Étage inconnu'

    second_digit = room_number[1]
    floor_map = {
        '0': 'Sous-sol',
        '1': '1er étage',
        '2': '2ème étage',
        '3': '3ème étage',
        '4': '4ème étage',
        '5': '5ème étage',
        '6': '6ème étage',
        '7': '7ème étage',
        '8': '8ème étage',
        '9': '9ème étage'
    }
    return floor_map.get(second_digit, 'Étage inconnu')

@app.route('/api/rooms', methods=['GET'])
def get_rooms():
    """Endpoint pour récupérer toutes les salles avec leurs emplois du temps (100% dynamique)"""
    # Initialiser le cache pour Vercel
    init_cache_if_needed()

    try:
        rooms_data = get_dynamic_rooms_data()
        room_schedules = get_dynamic_room_schedules()
        rooms = []

        for room_number, room_info in rooms_data.items():
            room_data = {
                'number': room_number,
                'schedule': room_schedules.get(room_number, []),  # Emploi du temps au lieu du statut
                'name': room_info['name'],
                'board': room_info['board'],
                'capacity': room_info['capacity'],
                'type': room_info['type'],
                'epis': get_room_epis(room_number),
                'floor': get_room_floor(room_number)
            }
            rooms.append(room_data)

        return jsonify({
            'success': True,
            'rooms': rooms_data,
            'room_schedules': room_schedules,  # Emplois du temps pour calcul côté client
            'rooms_list': rooms,
            'total_rooms': len(rooms_data),
            'dynamic': True,
            'client_status_calculation': True,  # Flag pour indiquer que le client doit calculer les statuts
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/rooms/<room_number>', methods=['GET'])
def get_room(room_number):
    """Endpoint pour récupérer les détails d'une salle spécifique (100% dynamique)"""
    try:
        rooms_data = get_dynamic_rooms_data()
        room_schedules = get_dynamic_room_schedules()

        if room_number not in rooms_data:
            return jsonify({
                'success': False,
                'error': 'Salle non trouvée'
            }), 404

        room_info = rooms_data[room_number]
        schedule = room_schedules.get(room_number, [])

        room_data = {
            'number': room_number,
            'schedule': schedule,  # Emploi du temps au lieu du statut
            'name': room_info['name'],
            'board': room_info['board'],
            'capacity': room_info['capacity'],
            'type': room_info['type'],
            'epis': get_room_epis(room_number),
            'floor': get_room_floor(room_number),
            'dynamic': True,
            'client_status_calculation': True
        }

        return jsonify({
            'success': True,
            'room': room_data,
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Endpoint de santé pour vérifier que l'API fonctionne"""
    return jsonify({
        'success': True,
        'message': 'API ESIEE Salles fonctionnelle',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0'
    })

@app.route('/api/rooms/<room_number>/schedule', methods=['GET'])
def get_room_schedule(room_number):
    """Endpoint pour récupérer l'emploi du temps d'une salle spécifique (100% dynamique)"""
    try:
        rooms_data = get_dynamic_rooms_data()

        if room_number not in rooms_data:
            return jsonify({
                'success': False,
                'error': 'Salle non trouvée'
            }), 404

        schedule = get_room_schedule_from_cache(room_number)

        return jsonify({
            'success': True,
            'room_number': room_number,
            'schedule': schedule,
            'dynamic': True,
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/rooms/<room_number>/availability', methods=['GET'])
def get_room_availability(room_number):
    """Endpoint pour vérifier la disponibilité d'une salle à un moment donné (100% dynamique)"""
    try:
        rooms_data = get_dynamic_rooms_data()

        if room_number not in rooms_data:
            return jsonify({
                'success': False,
                'error': 'Salle non trouvée'
            }), 404

        # Récupérer les paramètres optionnels
        from flask import request
        day = request.args.get('day')  # Format: monday, tuesday, etc.
        time = request.args.get('time')  # Format: HH:MM

        if day and time:
            # Vérifier la disponibilité à un moment spécifique
            is_available = is_room_available_at_time(room_number, day, time)
            status = 'libre' if is_available else 'occupé'
        else:
            # Vérifier la disponibilité actuelle en utilisant l'emploi du temps
            now = datetime.now()
            day_mapping = {
                0: 'monday', 1: 'tuesday', 2: 'wednesday', 3: 'thursday',
                4: 'friday', 5: 'saturday', 6: 'sunday'
            }
            current_day = day_mapping.get(now.weekday(), 'monday')
            current_time = now.strftime('%H:%M')
            is_available = is_room_available_at_time(room_number, current_day, current_time)
            status = 'libre' if is_available else 'occupé'

        return jsonify({
            'success': True,
            'room_number': room_number,
            'status': status,
            'checked_day': day,
            'checked_time': time,
            'dynamic': True,
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Endpoint pour récupérer les statistiques des salles (100% dynamique)"""
    try:
        rooms_data = get_dynamic_rooms_data()
        room_schedules = get_dynamic_room_schedules()
        
        # Calculer les statuts en temps réel
        now = datetime.now()
        day_mapping = {
            0: 'monday', 1: 'tuesday', 2: 'wednesday', 3: 'thursday',
            4: 'friday', 5: 'saturday', 6: 'sunday'
        }
        current_day = day_mapping.get(now.weekday(), 'monday')
        current_time = now.strftime('%H:%M')
        
        total_rooms = len(rooms_data)
        free_rooms = 0
        
        for room_number in rooms_data.keys():
            if is_room_available_at_time(room_number, current_day, current_time):
                free_rooms += 1
        
        occupied_rooms = total_rooms - free_rooms

        # Statistiques par type
        types_stats = {}
        for room_info in rooms_data.values():
            room_type = room_info['type']
            if room_type not in types_stats:
                types_stats[room_type] = 0
            types_stats[room_type] += 1

        # Statistiques par Epis
        epis_stats = {}
        for room_number in rooms_data.keys():
            epis = get_room_epis(room_number)
            if epis not in epis_stats:
                epis_stats[epis] = 0
            epis_stats[epis] += 1

        return jsonify({
            'success': True,
            'stats': {
                'total_rooms': total_rooms,
                'free_rooms': free_rooms,
                'occupied_rooms': occupied_rooms,
                'availability_rate': round((free_rooms / total_rooms) * 100, 1) if total_rooms > 0 else 0,
                'types': types_stats,
                'epis': epis_stats
            },
            'dynamic': True,
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Nouveaux endpoints pour les événements ESIEE

@app.route('/api/events/this-week', methods=['GET'])
def get_events_this_week_endpoint():
    """Endpoint pour récupérer tous les événements de cette semaine (depuis le cache)"""
    try:
        # Utiliser le cache au lieu de l'API directe
        events = get_cached_events()

        # Formater les événements pour l'API
        formatted_events = []
        for event in events:
            start_time = event.get('start_datetime')
            end_time = event.get('end_datetime')

            formatted_event = {
                'summary': event.get('summary', ''),
                'location': event.get('room_full', ''),
                'start_time': start_time.isoformat() if isinstance(start_time, datetime) else None,
                'end_time': end_time.isoformat() if isinstance(end_time, datetime) else None,
                'start_date': start_time.strftime('%Y-%m-%d') if isinstance(start_time, datetime) else None,
                'start_hour': start_time.strftime('%H:%M') if isinstance(start_time, datetime) else None,
                'end_hour': end_time.strftime('%H:%M') if isinstance(end_time, datetime) else None,
                'day_of_week': start_time.strftime('%A') if isinstance(start_time, datetime) else None
            }
            formatted_events.append(formatted_event)

        # Ajouter les infos du cache
        cache_info = cache_manager.get_cache_info()

        return jsonify({
            'success': True,
            'events': formatted_events,
            'total_events': len(formatted_events),
            'week': 'current',
            'cached': True,
            'cache_info': cache_info,
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/events/next-week', methods=['GET'])
def get_events_next_week_endpoint():
    """Endpoint pour récupérer tous les événements de la semaine prochaine"""
    try:
        events = get_events_next_week()

        # Formater les événements pour l'API
        formatted_events = []
        for event in events:
            start_time = event.get('start_datetime')
            end_time = event.get('end_datetime')

            formatted_event = {
                'summary': event.get('summary', ''),
                'location': event.get('room_full', ''),
                'start_time': start_time.isoformat() if isinstance(start_time, datetime) else None,
                'end_time': end_time.isoformat() if isinstance(end_time, datetime) else None,
                'start_date': start_time.strftime('%Y-%m-%d') if isinstance(start_time, datetime) else None,
                'start_hour': start_time.strftime('%H:%M') if isinstance(start_time, datetime) else None,
                'end_hour': end_time.strftime('%H:%M') if isinstance(end_time, datetime) else None,
                'day_of_week': start_time.strftime('%A') if isinstance(start_time, datetime) else None
            }
            formatted_events.append(formatted_event)

        return jsonify({
            'success': True,
            'events': formatted_events,
            'total_events': len(formatted_events),
            'week': 'next',
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/rooms/<room_number>/events', methods=['GET'])
def get_room_events_endpoint(room_number):
    """Endpoint pour récupérer les événements d'une salle spécifique"""
    try:
        # Paramètres optionnels
        week_offset = request.args.get('week', 0, type=int)

        room_full_name = f"PER - {room_number}"
        events = get_events_for_room(room_full_name, week_offset)

        # Formater les événements pour l'API
        formatted_events = []
        for event in events:
            start_time = event.get('start_datetime')
            end_time = event.get('end_datetime')

            formatted_event = {
                'summary': event.get('summary', ''),
                'location': event.get('room_full', ''),
                'start_time': start_time.isoformat() if isinstance(start_time, datetime) else None,
                'end_time': end_time.isoformat() if isinstance(end_time, datetime) else None,
                'start_date': start_time.strftime('%Y-%m-%d') if isinstance(start_time, datetime) else None,
                'start_hour': start_time.strftime('%H:%M') if isinstance(start_time, datetime) else None,
                'end_hour': end_time.strftime('%H:%M') if isinstance(end_time, datetime) else None,
                'day_of_week': start_time.strftime('%A') if isinstance(start_time, datetime) else None
            }
            formatted_events.append(formatted_event)

        return jsonify({
            'success': True,
            'room_number': room_number,
            'room_full_name': room_full_name,
            'events': formatted_events,
            'total_events': len(formatted_events),
            'week_offset': week_offset,
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/rooms/available', methods=['GET'])
def get_available_rooms_endpoint():
    """Endpoint pour récupérer les salles disponibles maintenant"""
    try:
        available_rooms = get_available_rooms_today()

        # Filtrer et formater les salles PER avec données dynamiques
        rooms_data = get_dynamic_rooms_data()
        per_rooms = []
        for room_full in available_rooms:
            if "PER - " in room_full:
                room_number = room_full.replace("PER - ", "")
                if room_number in rooms_data:
                    room_info = rooms_data[room_number]
                    per_rooms.append({
                        'number': room_number,
                        'full_name': room_full,
                        'name': room_info['name'],
                        'type': room_info['type'],
                        'capacity': room_info['capacity'],
                        'epis': get_room_epis(room_number),
                        'floor': get_room_floor(room_number)
                    })

        return jsonify({
            'success': True,
            'available_rooms': per_rooms,
            'total_available': len(per_rooms),
            'all_available_rooms': available_rooms,
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/search/room/<room_query>', methods=['GET'])
def search_room_endpoint(room_query):
    """Endpoint pour rechercher des informations sur une salle"""
    try:
        # Paramètres optionnels
        time_query = request.args.get('time')  # Format HH:MM
        date_query = request.args.get('date')  # Format YYYY-MM-DD

        # Construire le nom complet de la salle
        if not room_query.startswith('PER - '):
            room_full_name = f"PER - {room_query}"
        else:
            room_full_name = room_query
            room_query = room_query.replace('PER - ', '')

        # Récupérer les événements de la salle
        events = get_events_for_room(room_full_name, week_offset=0)

        result = {
            'room_number': room_query,
            'room_full_name': room_full_name,
            'query_time': time_query,
            'query_date': date_query,
            'current_status': get_room_availability_from_api(room_query),
        }

        # Si une heure et date spécifiques sont demandées
        if time_query and date_query:
            query_datetime = datetime.strptime(f"{date_query} {time_query}", '%Y-%m-%d %H:%M')

            found_event = None
            for event in events:
                start_time = event.get('start_datetime')
                end_time = event.get('end_datetime')

                if isinstance(start_time, datetime) and isinstance(end_time, datetime):
                    if start_time <= query_datetime <= end_time:
                        found_event = {
                            'summary': event.get('summary', ''),
                            'start_time': start_time.isoformat(),
                            'end_time': end_time.isoformat(),
                            'start_hour': start_time.strftime('%H:%M'),
                            'end_hour': end_time.strftime('%H:%M')
                        }
                        break

            result['event_at_time'] = found_event
            result['status_at_time'] = 'occupé' if found_event else 'libre'

        # Ajouter les informations de la salle si elle existe dans les données dynamiques
        rooms_data = get_dynamic_rooms_data()
        if room_query in rooms_data:
            room_info = rooms_data[room_query]
            result['room_info'] = {
                'name': room_info['name'],
                'type': room_info['type'],
                'capacity': room_info['capacity'],
                'board': room_info['board'],
                'epis': get_room_epis(room_query),
                'floor': get_room_floor(room_query)
            }

        return jsonify({
            'success': True,
            'result': result,
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Nouveaux endpoints pour la gestion du cache

@app.route('/api/cache/status', methods=['GET'])
def get_cache_status():
    """Endpoint pour récupérer l'état du cache"""
    try:
        cache_info = cache_manager.get_cache_info()
        stats = get_cache_stats()

        return jsonify({
            'success': True,
            'cache_info': cache_info,
            'stats': stats,
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/cache/refresh', methods=['POST'])
def refresh_cache():
    """Endpoint pour forcer le rafraîchissement du cache"""
    try:
        success = force_cache_refresh()

        if success:
            stats = get_cache_stats()
            return jsonify({
                'success': True,
                'message': 'Cache rafraîchi avec succès',
                'stats': stats,
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Échec du rafraîchissement du cache'
            }), 500

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# Variable globale pour le cache en mémoire (Vercel)
_memory_cache = None
_cache_timestamp = None

def init_cache_if_needed():
    """Initialise le cache si nécessaire (pour Vercel serverless)"""
    global _memory_cache, _cache_timestamp

    try:
        # Vérifier si on a déjà un cache en mémoire valide
        if _memory_cache and _cache_timestamp:
            age = datetime.now() - _cache_timestamp
            if age.total_seconds() < 3600:  # Cache valide 1 heure
                return _memory_cache

        # Tenter de charger depuis le fichier
        cache_data = cache_manager.get_cached_data()
        if not cache_data:
            print("⚠️ Cache vide, forçage du rafraîchissement...")
            cache_manager.force_refresh()
            cache_data = cache_manager.get_cached_data()

        # Stocker en mémoire pour Vercel
        _memory_cache = cache_data
        _cache_timestamp = datetime.now()

        return cache_data
    except Exception as e:
        print(f"❌ Erreur lors de l'initialisation du cache: {e}")
        return None

# =============================================================================
# ENDPOINTS D'AUTHENTIFICATION ET GESTION DES UTILISATEURS
# =============================================================================

def verify_google_token(id_token: str) -> dict:
    """
    Vérifier un token Google ID et récupérer les infos utilisateur
    """
    try:
        # Vérification via l'API Google uniquement - pas de faux JWT acceptés
        response = requests.get(
            f'https://oauth2.googleapis.com/tokeninfo?id_token={id_token}',
            timeout=10
        )

        if response.status_code == 200:
            return response.json()
        else:
            print(f"Token Google invalide, status: {response.status_code}")
            return None
    except Exception as e:
        print(f"Erreur lors de la vérification du token Google: {e}")
        return None

def get_current_user_from_request():
    """
    Récupérer l'utilisateur actuel depuis la requête (session token)
    """
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None

    session_token = auth_header[7:]  # Retirer "Bearer "
    return user_manager.validate_session(session_token)

def csrf_protected(f):
    """
    Décorateur pour protéger les endpoints contre les attaques CSRF
    Vérifie que le token CSRF est présent et valide
    """
    from functools import wraps

    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Récupérer le token de session
        session_token = request.cookies.get('esiee_auth_token')
        if not session_token:
            return jsonify({
                'success': False,
                'error': 'Session manquante'
            }), 401

        # Récupérer le token CSRF depuis le header
        csrf_token = request.headers.get('X-CSRF-Token')
        if not csrf_token:
            return jsonify({
                'success': False,
                'error': 'Token CSRF manquant'
            }), 403

        # Valider le token CSRF
        if not user_manager.validate_csrf_token(session_token, csrf_token):
            return jsonify({
                'success': False,
                'error': 'Token CSRF invalide'
            }), 403

        return f(*args, **kwargs)

    return decorated_function

def rate_limit(max_requests=100, window_seconds=3600):
    """
    Décorateur pour limiter le nombre de requêtes par IP
    Par défaut: 100 requêtes par heure
    """
    from functools import wraps

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Récupérer l'IP du client
            client_ip = request.remote_addr
            if request.headers.get('X-Forwarded-For'):
                client_ip = request.headers.get('X-Forwarded-For').split(',')[0].strip()

            current_time = datetime.now()

            with rate_limit_lock:
                # Nettoyer les anciennes requêtes
                rate_limit_storage[client_ip] = [
                    req_time for req_time in rate_limit_storage[client_ip]
                    if current_time - req_time < timedelta(seconds=window_seconds)
                ]

                # Vérifier si la limite est atteinte
                if len(rate_limit_storage[client_ip]) >= max_requests:
                    return jsonify({
                        'success': False,
                        'error': 'Trop de requêtes. Veuillez réessayer plus tard.'
                    }), 429

                # Ajouter la requête actuelle
                rate_limit_storage[client_ip].append(current_time)

            return f(*args, **kwargs)

        return decorated_function
    return decorator

@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    """
    Connexion utilisateur via Google OAuth
    """
    try:
        data = request.get_json()
        if not data or 'credential' not in data:
            return jsonify({
                'success': False,
                'error': 'Token Google manquant'
            }), 400

        # Vérifier le token Google
        google_user_info = verify_google_token(data['credential'])
        if not google_user_info:
            return jsonify({
                'success': False,
                'error': 'Token Google invalide'
            }), 401

        # Créer ou mettre à jour l'utilisateur
        try:
            user = user_manager.create_or_update_user(google_user_info)
        except ValueError as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 403

        # Créer une session
        session_token = user_manager.create_session(user['user_id'])

        # Nettoyer les sessions expirées
        user_manager.cleanup_expired_sessions()

        return jsonify({
            'success': True,
            'user': {
                'user_id': user['user_id'],
                'email': user['email'],
                'name': user['name'],
                'picture': user['picture'],
                'role': user['role'],
                'preferences': user['preferences'],
                'reservations': user.get('reservations', {
                    'total': 0,
                    'active': 0,
                    'history': []
                })
            },
            'session_token': session_token,
            'expires_in': 168 * 3600  # 7 jours en secondes
        })

    except Exception as e:
        print(f"Erreur lors de la connexion: {e}")
        return jsonify({
            'success': False,
            'error': 'Erreur interne du serveur'
        }), 500

@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    """
    Déconnexion utilisateur
    """
    try:
        user = get_current_user_from_request()
        if not user:
            return jsonify({'success': True})  # Déjà déconnecté

        # Invalider la session
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            session_token = auth_header[7:]
            user_manager.invalidate_session(session_token)

        return jsonify({'success': True})

    except Exception as e:
        print(f"Erreur lors de la déconnexion: {e}")
        return jsonify({
            'success': False,
            'error': 'Erreur interne du serveur'
        }), 500

@app.route('/api/auth/verify', methods=['GET'])
def auth_verify():
    """
    Vérifier la session actuelle
    """
    try:
        user = get_current_user_from_request()
        if not user:
            return jsonify({
                'success': False,
                'error': 'Session invalide ou expirée'
            }), 401

        return jsonify({
            'success': True,
            'user': {
                'user_id': user['user_id'],
                'email': user['email'],
                'name': user['name'],
                'picture': user['picture'],
                'role': user['role'],
                'preferences': user['preferences'],
                'reservations': user.get('reservations', {
                    'total': 0,
                    'active': 0,
                    'history': []
                })
            }
        })

    except Exception as e:
        print(f"Erreur lors de la vérification: {e}")
        return jsonify({
            'success': False,
            'error': 'Erreur interne du serveur'
        }), 500

@app.route('/api/auth/profile', methods=['GET', 'PUT'])
def auth_profile():
    """
    Récupérer ou mettre à jour le profil utilisateur
    """
    try:
        user = get_current_user_from_request()
        if not user:
            return jsonify({
                'success': False,
                'error': 'Authentification requise'
            }), 401

        if request.method == 'GET':
            return jsonify({
                'success': True,
                'user': user
            })

        elif request.method == 'PUT':
            data = request.get_json()
            if not data:
                return jsonify({
                    'success': False,
                    'error': 'Données manquantes'
                }), 400

            # Mettre à jour les préférences utilisateur
            if 'preferences' in data:
                user['preferences'].update(data['preferences'])

            # Sauvegarder les modifications
            user_manager.users_data['users'][user['user_id']] = user
            user_manager._save_users()

            return jsonify({
                'success': True,
                'user': user
            })

    except Exception as e:
        print(f"Erreur lors de la gestion du profil: {e}")
        return jsonify({
            'success': False,
            'error': 'Erreur interne du serveur'
        }), 500

@app.route('/api/admin/users', methods=['GET'])
def admin_get_users():
    """
    Liste des utilisateurs (admin uniquement)
    """
    try:
        user = get_current_user_from_request()
        if not user or user.get('role') != 'admin':
            return jsonify({
                'success': False,
                'error': 'Accès administrateur requis'
            }), 403

        # Nettoyer les sessions expirées
        user_manager.cleanup_expired_sessions()

        # Récupérer les statistiques
        stats = user_manager.get_user_stats()

        # Liste des utilisateurs (sans données sensibles)
        users_list = []
        for user_data in user_manager.users_data['users'].values():
            users_list.append({
                'user_id': user_data['user_id'],
                'email': user_data['email'],
                'name': user_data['name'],
                'role': user_data['role'],
                'status': user_data['status'],
                'last_login': user_data['last_login'],
                'login_count': user_data['login_count'],
                'created_at': user_data['created_at']
            })

        return jsonify({
            'success': True,
            'users': users_list,
            'stats': stats
        })

    except Exception as e:
        print(f"Erreur lors de la récupération des utilisateurs: {e}")
        return jsonify({
            'success': False,
            'error': 'Erreur interne du serveur'
        }), 500

@app.route('/api/admin/whitelist', methods=['GET', 'POST', 'DELETE'])
def admin_whitelist():
    """
    Gestion de la whitelist des emails (admin uniquement)
    """
    try:
        user = get_current_user_from_request()
        if not user or user.get('role') != 'admin':
            return jsonify({
                'success': False,
                'error': 'Accès administrateur requis'
            }), 403

        if request.method == 'GET':
            return jsonify({
                'success': True,
                'whitelist': user_manager.email_whitelist
            })

        elif request.method == 'POST':
            data = request.get_json()
            if not data or 'email' not in data:
                return jsonify({
                    'success': False,
                    'error': 'Email manquant'
                }), 400

            success = user_manager.add_email_to_whitelist(data['email'])
            return jsonify({
                'success': success,
                'whitelist': user_manager.email_whitelist
            })

        elif request.method == 'DELETE':
            data = request.get_json()
            if not data or 'email' not in data:
                return jsonify({
                    'success': False,
                    'error': 'Email manquant'
                }), 400

            success = user_manager.remove_email_from_whitelist(data['email'])
            return jsonify({
                'success': success,
                'whitelist': user_manager.email_whitelist
            })

    except Exception as e:
        print(f"Erreur lors de la gestion de la whitelist: {e}")
        return jsonify({
            'success': False,
            'error': 'Erreur interne du serveur'
        }), 500

@app.route('/api/reservations', methods=['POST'])
def create_reservation():
    """Créer une nouvelle réservation"""
    try:
        # Récupérer le token de session (cookies ou header)
        session_token = get_session_token()

        if not session_token:
            return jsonify({
                'success': False,
                'error': 'Non authentifié'
            }), 401

        # Valider la session
        user = user_manager.validate_session(session_token)

        if not user:
            return jsonify({
                'success': False,
                'error': 'Session invalide'
            }), 401

        user_id = user['user_id']

        # Récupérer les données de la requête
        data = request.get_json()
        room_number = data.get('room_number')
        date = data.get('date')
        start_time = data.get('start_time')
        end_time = data.get('end_time')

        if not all([room_number, date, start_time, end_time]):
            return jsonify({
                'success': False,
                'error': 'Données manquantes'
            }), 400

        # Vérifier que la réservation est dans les 2 heures à venir
        from datetime import datetime, timedelta
        now = datetime.now()

        # Vérifier que l'utilisateur n'a pas déjà une réservation active (non terminée)
        reservations = user.get('reservations', {}).get('history', [])
        active_reservations = []
        for r in reservations:
            if r['status'] in ['active', 'upcoming']:
                # Vérifier que la réservation n'est pas terminée
                reservation_end = datetime.fromisoformat(r['end_time'])
                if reservation_end > now:
                    active_reservations.append(r)

        if len(active_reservations) > 0:
            return jsonify({
                'success': False,
                'error': 'Vous avez déjà une réservation active'
            }), 400
        reservation_datetime = datetime.fromisoformat(f"{date}T{start_time}:00")
        reservation_end_datetime = datetime.fromisoformat(f"{date}T{end_time}:00")

        # Calculer la différence en heures par rapport au début de la réservation
        time_diff = (reservation_datetime - now).total_seconds() / 3600

        # Vérifier si la fin de la réservation est dans le futur (permet de réserver le créneau actuel)
        end_time_diff = (reservation_end_datetime - now).total_seconds() / 3600

        if end_time_diff <= 0:
            return jsonify({
                'success': False,
                'error': 'Impossible de réserver dans le passé'
            }), 400

        if time_diff > 2:
            return jsonify({
                'success': False,
                'error': 'Les réservations sont limitées aux 2 heures à venir'
            }), 400

        # Vérifier que la durée est de 1h
        start_dt = datetime.fromisoformat(f"{date}T{start_time}:00")
        end_dt = datetime.fromisoformat(f"{date}T{end_time}:00")
        duration = (end_dt - start_dt).total_seconds() / 3600

        if duration != 1.0:
            return jsonify({
                'success': False,
                'error': 'La durée de réservation doit être d\'exactement 1 heure'
            }), 400

        # Vérifier que la salle existe réellement dans le système
        cached_rooms = get_cached_rooms_data()

        if room_number not in cached_rooms:
            return jsonify({
                'success': False,
                'error': f'La salle {room_number} n\'existe pas'
            }), 400

        # Section critique : vérification et création de la réservation (protégée par verrou)
        with reservation_lock:
            # Vérifier qu'il n'y a pas de conflit avec une autre réservation
            users_data = user_manager.users_data.get('users', {})
            for other_user_id, other_user in users_data.items():
                other_reservations = other_user.get('reservations', {}).get('history', [])
                for other_res in other_reservations:
                    # Vérifier seulement les réservations actives/upcoming et pour la même salle
                    if (other_res.get('status') in ['active', 'upcoming'] and
                        other_res.get('room_number') == room_number):

                        # Vérifier le chevauchement horaire
                        other_start = datetime.fromisoformat(other_res['start_time'])
                        other_end = datetime.fromisoformat(other_res['end_time'])

                        # Il y a conflit si les créneaux se chevauchent
                        if (start_dt < other_end and end_dt > other_start):
                            return jsonify({
                                'success': False,
                                'error': f'La salle {room_number} est déjà réservée pour ce créneau'
                            }), 409  # 409 Conflict

            # Créer la réservation
            import uuid
            reservation = {
                'id': str(uuid.uuid4()),
                'room_number': room_number,
                'start_time': reservation_datetime.isoformat(),
                'end_time': end_dt.isoformat(),
                'status': 'upcoming' if time_diff > 0 else 'active',
                'created_at': now.isoformat()
            }

            # Ajouter la réservation
            user['reservations']['history'].append(reservation)
            user['reservations']['total'] = len(user['reservations']['history'])
            user['reservations']['active'] = len([r for r in user['reservations']['history'] if r['status'] in ['active', 'upcoming']])

            # Sauvegarder
            user_manager.users_data['users'][user_id] = user
            user_manager._save_users()

        return jsonify({
            'success': True,
            'message': 'Réservation créée avec succès',
            'reservation': reservation,
            'reservations': user['reservations']['history']
        })

    except Exception as e:
        print(f"Erreur lors de la création de la réservation: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': 'Erreur interne du serveur'
        }), 500

@app.route('/api/reservations/<reservation_id>', methods=['DELETE'])
def cancel_reservation(reservation_id):
    """Annuler une réservation"""
    try:
        # Récupérer le token de session (cookies ou header)
        session_token = get_session_token()

        if not session_token:
            return jsonify({
                'success': False,
                'error': 'Non authentifié'
            }), 401

        # Valider la session
        user = user_manager.validate_session(session_token)

        if not user:
            return jsonify({
                'success': False,
                'error': 'Session invalide'
            }), 401

        user_id = user['user_id']

        # Récupérer les réservations de l'utilisateur
        reservations = user.get('reservations', {}).get('history', [])

        # Trouver la réservation et vérifier qu'elle appartient à l'utilisateur
        reservation_found = False
        reservation_to_delete = None
        updated_reservations = []

        for reservation in reservations:
            if reservation.get('id') == reservation_id:
                reservation_found = True
                reservation_to_delete = reservation
                # Ne pas ajouter cette réservation (= suppression)
            else:
                updated_reservations.append(reservation)

        if not reservation_found:
            return jsonify({
                'success': False,
                'error': 'Réservation non trouvée ou vous n\'êtes pas autorisé à l\'annuler'
            }), 404

        # Mettre à jour les données utilisateur
        user['reservations']['history'] = updated_reservations
        user['reservations']['total'] = len(updated_reservations)
        user['reservations']['active'] = len([r for r in updated_reservations if r['status'] in ['active', 'upcoming']])

        # Sauvegarder
        user_manager.users_data['users'][user_id] = user
        user_manager._save_users()

        return jsonify({
            'success': True,
            'message': 'Réservation annulée avec succès',
            'reservations': updated_reservations
        })

    except Exception as e:
        print(f"Erreur lors de l'annulation de la réservation: {e}")
        return jsonify({
            'success': False,
            'error': 'Erreur interne du serveur'
        }), 500

@app.route('/api/reservations/active', methods=['GET'])
def get_active_reservations():
    """Récupérer toutes les réservations actives pour toutes les salles"""
    try:
        users_data = user_manager.users_data.get('users', {})
        active_reservations = []

        from datetime import datetime
        now = datetime.now()

        for user_id, user in users_data.items():
            reservations = user.get('reservations', {}).get('history', [])
            for reservation in reservations:
                if reservation.get('status') in ['active', 'upcoming']:
                    # Vérifier que la réservation n'est pas terminée
                    end_time = datetime.fromisoformat(reservation['end_time'])
                    if end_time > now:
                        active_reservations.append({
                            'room_number': reservation['room_number'],
                            'start_time': reservation['start_time'],
                            'end_time': reservation['end_time'],
                            'status': reservation['status'],
                            'user_name': user.get('name', 'Utilisateur')
                        })

        return jsonify({
            'success': True,
            'reservations': active_reservations,
            'total': len(active_reservations)
        })

    except Exception as e:
        print(f"Erreur lors de la récupération des réservations actives: {e}")
        return jsonify({
            'success': False,
            'error': 'Erreur interne du serveur'
        }), 500

# Initialiser le cache au démarrage pour le développement local
if __name__ == '__main__':
    print("🚀 Initialisation du cache ESIEE dynamique...")
    try:
        cache_data = cache_manager.get_cached_data()
        if cache_data:
            cached_rooms = cache_data.get('rooms_data', {})
            print(f"✅ Cache initialisé: {len(cached_rooms)} salles dynamiques chargées")
            print(f"📊 API 100% dynamique - Aucune salle fixe utilisée")
        else:
            print("⚠️ Aucune donnée de cache disponible, forçage du rafraîchissement...")
            cache_manager.force_refresh()
    except Exception as e:
        print(f"❌ Erreur lors de l'initialisation du cache: {e}")

    import os
    port = 3001
    debug = False

    print(f"🚀 Démarrage de l'API ESIEE sur le port {port}")
    app.run(debug=debug, host='0.0.0.0', port=port)

# Export de l'app pour Vercel (WSGI)
# Vercel utilise l'objet 'app' directement pour les applications Flask


