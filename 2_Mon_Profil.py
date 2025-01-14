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
        print(f"Token from cookies: {token}")  # Debugging line
        if token:
            config = load_config()
            if 'users' in config:
                user = next((user for user in config['users'] if user['token'] == token), None)
                if user:
                    return token
        pseudo = gen_pseudo()
        print(f"Generated pseudo: {pseudo}")  # Debugging line
        config = load_config()
        if 'users' not in config:
            config['users'] = []
        user = next((user for user in config['users'] if user['pseudo'] == pseudo), None)
        if user:
            token = user['token']
        else:
            token = gen_token()
            print("Generating token...")  # Debugging line
            config['users'].append({'pseudo': pseudo, 'token': token})
            save_config(config)
        controller.set('token', token)
        return token
    except Exception as e:
        print(f"Error in get_token: {e}")  # Debugging line
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

token = get_token()
pseudo = get_pseudo(token)
st.write(f"**Pseudo**: {pseudo}")
