from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime
from cache_manager import (
    get_cached_events, get_cached_room_schedules, get_cached_rooms_data,
    get_cached_available_rooms, get_cache_stats, force_cache_refresh,
    cache_manager
)
from events_api import get_events_next_week, get_events_for_room, get_available_rooms_today

app = Flask(__name__)
CORS(app)  # Permettre les requêtes cross-origin depuis le frontend



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
            # Vérifier la disponibilité actuelle depuis le cache
            statuses = get_dynamic_room_statuses()
            status = statuses.get(room_number, 'libre')

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
        statuses = get_dynamic_room_statuses()

        total_rooms = len(rooms_data)
        free_rooms = sum(1 for status in statuses.values() if status == 'libre')
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


# Initialiser le cache au démarrage (100% dynamique)
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

if __name__ == '__main__':
    import os
    # Port configurable via variable d'environnement
    port = 3001
    debug = False

    print(f"🚀 Démarrage de l'API ESIEE sur le port {port}")
    app.run(debug=debug, host='0.0.0.0', port=port)