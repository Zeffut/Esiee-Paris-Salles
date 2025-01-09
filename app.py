import streamlit as st
from base64 import b64decode, b64encode
from time import ctime, sleep, time
from threading import Thread
import gzip, requests, json
from getFreeRoomsFromAde2 import AdeRequest

st.set_page_config(layout="wide")

global freeRooms
freeRooms = {}
try:
    j = requests.get("https://olivier-truong-ade-free-rooms.hf.space/api").text
    freeRooms = json.loads(j)
except:
    pass
if freeRooms == {}:
    Ade = AdeRequest()
    infos = Ade.getRoomsInfos()
    freeRooms = Ade.getCurrentsFreeRooms()

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
    while True:
        try:
            sleep(600)
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
        except Exception as e:
            print("Err. When reload:", e)

if 'response_data' not in st.session_state:
    st.session_state['response_data'] = import_response_data()
if 'allowed' not in st.session_state:
    st.session_state['allowed'] = import_allowed()

Thread(target=reloadData).start()

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

col1, col2 = st.columns([2, 1], gap="large")

with col1:
    search_query = st.text_input("Rechercher une salle", "")
    
    # Ajouter un menu pour les filtres
    with st.expander("Filtres"):
        board_filter = st.selectbox("Type de tableau", ["Tous", "Blanc", "Craie"], disabled=False)
        room_type_filter = st.selectbox("Type de salle", ["Toutes", "Amphithéatre", "Salle normale"], disabled=False)
        epis_filter = st.selectbox("Épis", ["Tous", "Couloir principal", "1", "2", "3", "4", "5", "6"], disabled=False)

    def filter_rooms(room):
        room_name, free_until = room
        room_info = next((r for r in st.session_state['response_data'] if r[0] == room_name), None)
        if not room_info:
            return False

        # Filtrer par type de tableau
        if board_filter != "Tous" and room_info[4].lower() != board_filter.lower():
            return False

        # Filtrer par type de salle
        if room_type_filter == "Amphithéatre" and room_name not in ["0110", "0210", "0160", "0260"]:
            return False
        if room_type_filter == "Salle normale" and room_name in ["0110", "0210", "0160", "0260"]:
            return False

        # Filtrer par épis
        if epis_filter != "Tous":
            if epis_filter == "Couloir principal" and room_name[0] != "0":
                return False
            if epis_filter != "Couloir principal" and room_name[0] != epis_filter:
                return False

        return True

    filtered_rooms = [ip for ip in st.session_state['allowed'] if search_query.lower() in ip[0].lower() and filter_rooms(ip)]
    
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
