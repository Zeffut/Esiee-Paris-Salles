import streamlit as st
from st_pages import add_page_title, get_nav_from_toml
from datetime import datetime
import requests, json
from getFreeRoomsFromAde2 import AdeRequest

# Définir freeRooms comme une variable globale
freeRooms = {}

def import_allowed():
    global freeRooms
    tab = []
    for room in freeRooms:
        tab.append([room, freeRooms[room]["freeUntil"]])
    return tab

def import_response_data():
    global freeRooms
    tab = []
    
    for room in freeRooms:
        boardKind = ""
        if "board" in freeRooms[room]:
            boardKind = freeRooms[room].get("board")
        tab.append([room, freeRooms[room]["capacity"], freeRooms[room]["freeUntil"], freeRooms[room]["busy"], boardKind])
    return tab

def reloadData():
    global freeRooms
    try:
        j = requests.get("https://olivier-truong-ade-free-rooms.hf.space/api").text
        freeRooms = json.loads(j)
    except:
        Ade = AdeRequest()
        infos = Ade.getRoomsInfos()
        freeRooms = Ade.getCurrentsFreeRooms()
    st.session_state['response_data'] = import_response_data()
    st.session_state['allowed'] = import_allowed()
    print("[+] Refresh Data From Ade")

if 'response_data' not in st.session_state:
    st.session_state['response_data'] = import_response_data()
if 'allowed' not in st.session_state:
    st.session_state['allowed'] = import_allowed()

reloadData()

def busyUntil(tab):
    ts, te = tab
    return [f'{str(ts[0]).zfill(2)}h{str(ts[1]).zfill(2)}', f'{str(te[0]).zfill(2)}h{str(te[1]).zfill(2)}']

def responsesFrom(ip):
    responses = "\r\n\r\n"
    for resp in st.session_state['response_data']:
        if resp[0] == ip:
            responses += str(ip) + "    capacité: " + str(resp[1]) + "    disponible jusqu'à: " + str(resp[2])
            if resp[3] != [] and resp[2] != "demain":
                responses  += "\noccupée entre:\n" + str("".join(busyUntil(x) for x in resp[3])) + "\r\n\r\n"
    return responses

def filter_rooms(room, combined_filter, search_query):
    room_name, free_until = room
    room_info = next((r for r in st.session_state['response_data'] if r[0] == room_name), None)
    if not room_info:
        return False
    if combined_filter != "Tous":
        if combined_filter in ["Blanc", "Craie"]:
            if room_info[4].lower() != combined_filter.lower():
                return False
        elif combined_filter == "Amphithéâtre":
            if room_name not in ["0110", "0210", "0160", "0260"]:
                return False
        elif combined_filter == "Salle normale":
            if room_name in ["0110", "0210", "0160", "0260"]:
                return False
        elif combined_filter == "Rue":
            if room_name[0] != "0":
                return False
        elif combined_filter in ["1", "2", "3", "4", "5", "6"]:
            if room_name[0] != combined_filter:
                return False
    return search_query.lower() in room_name.lower()

current_hour = datetime.now().hour

col1, col2 = st.columns([1, 2], gap="large")

with col1:
    if 22 <= current_hour or current_hour < 5:
        st.write("L'établissement est fermé entre 23:00 et 6:00. Veuillez revenir pendant les heures d'ouverture.")
    else:
        search_query = st.text_input("Rechercher une salle", "")
        combined_filter = st.selectbox("Filtrer par", ["Tous", "Blanc", "Craie", "Amphithéâtre", "Salle normale", "Rue", "1", "2", "3", "4", "5", "6"])
    filtered_rooms = [ip for ip in st.session_state['allowed'] if filter_rooms(ip, combined_filter, search_query)]
    if not filtered_rooms:
        st.write("Aucune salle libre disponible répondant aux filtres sélectionnés")
    else:
        for ip in filtered_rooms:
            room_name = ip[0]
            if room_name in ["0110", "0210", "0160", "0260"]:
                room_name += " 🏛️"
            else:
                room_name += " 🏫"
            with st.expander(f"{room_name}"):
                room_info = next((room for room in st.session_state['response_data'] if room[0] == ip[0]), None)
                if room_info:
                    busy_periods = [busyUntil(x) for x in room_info[3]] if room_info[3] and ip[1] != "demain" else []
                    busy_table = "\n ".join([f' - {start} à {end}' for start, end in busy_periods]) if busy_periods else "Aucune occupation"
                    if busy_periods:
                        st.markdown(f"""
                            **Disponible jusqu'à**: {ip[1]}  
                            **Capacité**: {room_info[1]}  
                            **Tableau**: {room_info[4]}
                            \n**Occupée entre**:  
                            \n{busy_table}
                        """)
                    else:
                        st.markdown(f"""
                            **Disponible jusqu'à**: {ip[1]}  
                            **Capacité**: {room_info[1]}  
                            **Tableau**: {room_info[4]}
                        """)

    with col2:
        st.header("Explication")
        st.markdown("""
        Les salles présentes sont les salles libres. Le menu déroulant des salles indique jusqu'à quand elles sont disponibles.
        Les salles avec l'émoji 🏛️ sont des amphithéâtres, tandis que les autres salles avec l'émoji 🏫 sont des salles normales.
        """)
        st.header("Informations")
        st.markdown("""
        Vous trouverez ici, la liste des salles disponibles ou aucun cours n'a lieu en ce moment même.
            
        Le fonctionnement est simple: ci-dessous une liste vous indique le numéro de la salle et l'heure jusqu'à
        laquelle elle est disponible (avant le cours suivant). En cliquant sur un élément de la liste,
        il est possible d'avoir des infos supplémentaires comme la capacité théorique de la salle et la liste
        des heures auxquelles la salle se voit occupée. Je vous conseille de regarder ces infos juste pour vous
        assurer que l'estimation de disponibilité est correcte et à le reporter à olivier.truong@edu.esiee.fr
        si vous constatez que la corrélation est mauvaise. (avec des screenshots svp <3).
        Made with ❤️ by Zeffut and Glz_SQL
        """)