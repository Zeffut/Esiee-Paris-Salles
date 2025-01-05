import streamlit as st
from base64 import b64decode, b64encode
from time import ctime, sleep, time
from threading import Thread
import gzip, requests
from getFreeRoomsFromAde2 import AdeRequest

st.set_page_config(layout="wide")

Ade = AdeRequest()
infos = Ade.getRoomsInfos()
freeRooms = Ade.getCurrentsFreeRooms()

def import_allowed():
    tab = []
    for room in freeRooms:
        tab.append([room, freeRooms[room]["freeUntil"]])
    return tab

def import_response_data():
    tab = []
    for room in freeRooms:
        tab.append([room, freeRooms[room]["capacity"], freeRooms[room]["freeUntil"], freeRooms[room]["busy"]])
    return tab

def reloadData():
    while True:
        try:
            sleep(600)
            infos = Ade.getRoomsInfos()
            freeRooms = Ade.getCurrentsFreeRooms()
            st.session_state['response_data'] = import_response_data() # [numRoom: str, capacity: int, freeUntil: str, busy: tuple]
            st.session_state['allowed'] = import_allowed() # [numRoom: str, freeUtil: str]
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
    return f'- {str(ts[0]).zfill(2)}h{str(ts[1]).zfill(2)} à {str(te[0]).zfill(2)}h{str(te[1]).zfill(2)}\n'

def responsesFrom(ip):
    responses = "\r\n\r\n"
    for resp in st.session_state['response_data']:
        if resp[0] == ip:
            responses += str(ip) + "    capacité: " + str(resp[1]) + "    disponible jusqu'à: " + str(resp[2])
            if resp[3] != []:
                responses  += "\noccupée durrant:\n" + str("".join(busyUntil(x) for x in resp[3])) + "\r\n\r\n"
    return responses

st.title("Salles Disponible ESIEE Paris")

col1, col2 = st.columns([2, 1], gap="large")

with col1:
    search_query = st.text_input("Rechercher une salle", "")
    cols = st.columns(6)
    filtered_rooms = [ip for ip in st.session_state['allowed'] if search_query.lower() in ip[0].lower()]
    for i, ip in enumerate(filtered_rooms):
        room_name = ip[0]
        if room_name in ["0110", "0210", "0160", "0260"]:
            room_name += " 🏛️"
        else:
            room_name += " 🏫"
        with cols[i % 6].expander(f"{room_name}"):
            st.text(f"Disponible jusqu'à -> {ip[1]}")

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
    """)
