import streamlit as st
from st_pages import add_page_title, get_nav_from_toml
import streamlit.components.v1 as components

st.set_page_config(layout="wide")

# Ajout du script de tracking Rybbit
components.html("""
<html>
  <head>
    <script
      src="https://srv814883.hstgr.cloud/api/script.js"
      data-site-id="1"
      defer
    ></script>
  </head>
</html>
""")

nav = get_nav_from_toml("pages.toml")
pg = st.navigation(nav)
add_page_title(pg)
pg.run()
