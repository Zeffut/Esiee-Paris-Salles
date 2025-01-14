import streamlit as st
from st_pages import add_page_title, get_nav_from_toml
from streamlit_cookies_controller import CookieController
import requests, uuid, os

controller = CookieController()

API_URL = API_URL = os.getenv('DB_URL')

def load_config():
    try:
        response = requests.get(API_URL)
        if response.status_code == 200:
            return response.json()
        return {}
    except:
        return {}

def save_config(config):
    try:
        response = requests.post(API_URL, json=config)
        return response.status_code == 200
    except:
        return False

def gen_pseudo():
    return f"user_{uuid.uuid4().hex[:8]}"

def gen_token():
    token = str(uuid.uuid4())
    return token

def get_token():
    try:
        token = controller.get('token')
        if token:
            config = load_config()
            if 'users' in config:
                user = next((user for user in config['users'] if user['token'] == token), None)
                if user:
                    return token
        config = load_config()
        if 'users' not in config:
            config['users'] = []
        pseudo = gen_pseudo()
        while any(user['pseudo'] == pseudo for user in config['users']):
            pseudo = gen_pseudo()
        token = gen_token()
        config['users'].append({'pseudo': pseudo, 'token': token})
        save_config(config)
        controller.set('token', token)
        return token
    except Exception as e:
        return ""

def get_pseudo(token):
    try:
        config = load_config()
        user = next((user for user in config['users'] if user['token'] == token), None)
        if user:
            return user['pseudo']
        return None
    except:
        return None

def change_pseudo(new_pseudo):
    try:
        token = controller.get('token')
        if token:
            config = load_config()
            user = next((user for user in config['users'] if user['token'] == token), None)
            if user:
                user['pseudo'] = new_pseudo
                save_config(config)
                return new_pseudo
        return None
    except Exception as e:
        return None

token = get_token()
pseudo = get_pseudo(token)

st.write(f"**Pseudo**: {pseudo}")
if st.button('Modifier', key="show_input_button"):
    st.session_state.show_input = not st.session_state.get('show_input', False)

if st.session_state.get('show_input', False):
    @st.dialog("Changer le pseudo")
    def change_pseudo_dialog():
        new_pseudo_input = st.text_input("Nouveau pseudo", key="new_pseudo_input")
        if st.button('Changer', key="change_pseudo_button"):
            if new_pseudo_input:
                new_pseudo = change_pseudo(new_pseudo_input)
                if new_pseudo:
                    pseudo = new_pseudo
                    st.session_state.show_input = False
                    st.rerun()
                else:
                    st.write("Erreur lors du changement de pseudo")
            else:
                st.write("Veuillez entrer un pseudo valide")
    change_pseudo_dialog()
