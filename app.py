import streamlit as st
from st_pages import add_page_title, get_nav_from_toml

st.set_page_config(layout="wide")

# Ajout du script de tracking
st.markdown("""
<script
    src="https://srv814883.hstgr.cloud/api/script.js"
    data-site-id="1"
    defer
></script>
""", unsafe_allow_html=True)

nav = get_nav_from_toml("pages.toml")
pg = st.navigation(nav)
add_page_title(pg)
pg.run()

