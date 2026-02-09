import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import hashlib
import secrets

class ESIEEUserManager:
    """
    Gestionnaire des utilisateurs pour le système de réservation ESIEE
    - Validation des emails @esiee.fr + whitelist
    - Stockage JSON des données utilisateurs
    - Gestion des sessions et authentification
    """

    def __init__(self, users_file: str = "esiee_users.json", whitelist_file: str = "email_whitelist.json"):
        self.users_file = users_file
        self.whitelist_file = whitelist_file
        self.users_data = self._load_users()
        self.email_whitelist = self._load_whitelist()

    def _load_users(self) -> Dict:
        """Charger les données utilisateurs depuis le fichier JSON"""
        if os.path.exists(self.users_file):
            try:
                with open(self.users_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # Validation de la structure
                    if not isinstance(data, dict) or 'users' not in data:
                        return self._create_default_users_structure()
                    return data
            except (json.JSONDecodeError, IOError) as e:
                print(f"Erreur lors du chargement des utilisateurs: {e}")
                return self._create_default_users_structure()
        return self._create_default_users_structure()

    def _load_whitelist(self) -> List[str]:
        """Charger la whitelist des emails autorisés"""
        if os.path.exists(self.whitelist_file):
            try:
                with open(self.whitelist_file, 'r', encoding='utf-8') as f:
                    whitelist = json.load(f)
                    return whitelist.get('allowed_emails', []) if isinstance(whitelist, dict) else whitelist
            except (json.JSONDecodeError, IOError) as e:
                print(f"Erreur lors du chargement de la whitelist: {e}")
                return []
        return []

    def _create_default_users_structure(self) -> Dict:
        """Créer la structure par défaut du fichier utilisateurs"""
        return {
            "users": {},
            "sessions": {},
            "metadata": {
                "created": datetime.now().isoformat(),
                "last_updated": datetime.now().isoformat(),
                "version": "1.0"
            }
        }

    def _save_users(self) -> bool:
        """Sauvegarder les données utilisateurs"""
        try:
            self.users_data["metadata"]["last_updated"] = datetime.now().isoformat()
            with open(self.users_file, 'w', encoding='utf-8') as f:
                json.dump(self.users_data, f, ensure_ascii=False, indent=2)
            return True
        except IOError as e:
            print(f"Erreur lors de la sauvegarde des utilisateurs: {e}")
            return False

    def _save_whitelist(self) -> bool:
        """Sauvegarder la whitelist"""
        try:
            whitelist_data = {
                "allowed_emails": self.email_whitelist,
                "last_updated": datetime.now().isoformat()
            }
            with open(self.whitelist_file, 'w', encoding='utf-8') as f:
                json.dump(whitelist_data, f, ensure_ascii=False, indent=2)
            return True
        except IOError as e:
            print(f"Erreur lors de la sauvegarde de la whitelist: {e}")
            return False

    def is_email_authorized(self, email: str) -> bool:
        """
        Vérifier si un email est autorisé (ESIEE.fr ou whitelist)
        """
        if not email or '@' not in email:
            return False

        email = email.lower().strip()

        # Vérifier les domaines ESIEE
        esiee_domains = ['@esiee.fr', '@edu.esiee.fr', '@et.esiee.fr']
        if any(email.endswith(domain) for domain in esiee_domains):
            return True

        # Vérifier la whitelist
        return email in [w.lower().strip() for w in self.email_whitelist]

    def create_or_update_user(self, google_user_info: Dict) -> Dict:
        """
        Créer ou mettre à jour un utilisateur à partir des infos Google
        """
        email = google_user_info.get('email', '').lower().strip()

        if not self.is_email_authorized(email):
            raise ValueError(f"Email non autorisé: {email}")

        user_id = self._generate_user_id(email)
        current_time = datetime.now().isoformat()

        # Gérer les différents formats de données Google (JWT vs OAuth)
        google_id = google_user_info.get('sub') or google_user_info.get('id', '')
        given_name = google_user_info.get('given_name', '')
        family_name = google_user_info.get('family_name', '')

        # Si given_name et family_name ne sont pas disponibles, essayer de les extraire du nom complet
        if not given_name and not family_name:
            full_name = google_user_info.get('name', '')
            name_parts = full_name.split(' ', 1)
            given_name = name_parts[0] if name_parts else ''
            family_name = name_parts[1] if len(name_parts) > 1 else ''

        # Préparer les données utilisateur
        user_data = {
            "user_id": user_id,
            "email": email,
            "name": google_user_info.get('name', ''),
            "given_name": given_name,
            "family_name": family_name,
            "picture": google_user_info.get('picture', ''),
            "google_id": google_id,
            "verified_email": google_user_info.get('verified_email', False),
            "created_at": current_time,
            "last_login": current_time,
            "login_count": 1,
            "status": "active",
            "role": "user",  # user, admin, moderator
            "preferences": {
                "notifications": True,
                "theme": "auto"
            },
            "reservations": {
                "total": 0,
                "active": 0,
                "history": []
            }
        }

        # Si l'utilisateur existe déjà, conserver certaines données
        if user_id in self.users_data["users"]:
            existing_user = self.users_data["users"][user_id]
            user_data.update({
                "created_at": existing_user.get("created_at", current_time),
                "login_count": existing_user.get("login_count", 0) + 1,
                "role": existing_user.get("role", "user"),
                "status": existing_user.get("status", "active"),
                "preferences": existing_user.get("preferences", user_data["preferences"]),
                "reservations": existing_user.get("reservations", user_data["reservations"])
            })

        self.users_data["users"][user_id] = user_data
        self._save_users()

        return user_data

    def _generate_user_id(self, email: str) -> str:
        """Générer un ID utilisateur basé sur l'email"""
        return hashlib.sha256(email.encode()).hexdigest()[:16]

    def create_session(self, user_id: str, session_duration_hours: int = 168) -> tuple:  # 7 jours par défaut
        """
        Créer une session pour un utilisateur avec un token cryptographiquement sécurisé
        Retourne (session_token, csrf_token)
        """
        # Utiliser secrets.token_urlsafe() au lieu de SHA256 prévisible
        session_token = secrets.token_urlsafe(48)  # 48 bytes = 64 caractères base64
        csrf_token = secrets.token_urlsafe(32)  # Token CSRF distinct
        expires_at = datetime.now() + timedelta(hours=session_duration_hours)

        session_data = {
            "user_id": user_id,
            "csrf_token": csrf_token,
            "created_at": datetime.now().isoformat(),
            "expires_at": expires_at.isoformat(),
            "last_activity": datetime.now().isoformat(),
            "status": "active"
        }

        self.users_data["sessions"][session_token] = session_data
        self._save_users()

        return session_token, csrf_token

    def validate_session(self, session_token: str) -> Optional[Dict]:
        """
        Valider une session et retourner les infos utilisateur
        """
        if not session_token or session_token not in self.users_data["sessions"]:
            return None

        session = self.users_data["sessions"][session_token]

        # Vérifier l'expiration
        expires_at = datetime.fromisoformat(session["expires_at"])
        if datetime.now() > expires_at:
            self.invalidate_session(session_token)
            return None

        # Mettre à jour la dernière activité
        session["last_activity"] = datetime.now().isoformat()
        self._save_users()

        # Retourner les infos utilisateur
        user_id = session["user_id"]
        if user_id in self.users_data["users"]:
            return self.users_data["users"][user_id]

        return None

    def validate_csrf_token(self, session_token: str, csrf_token: str) -> bool:
        """
        Valider le token CSRF pour une session donnée
        """
        if not session_token or session_token not in self.users_data["sessions"]:
            return False

        session = self.users_data["sessions"][session_token]

        # Vérifier que le token CSRF correspond
        return session.get("csrf_token") == csrf_token

    def invalidate_session(self, session_token: str) -> bool:
        """
        Invalider une session
        """
        if session_token in self.users_data["sessions"]:
            del self.users_data["sessions"][session_token]
            self._save_users()
            return True
        return False

    def cleanup_expired_sessions(self) -> int:
        """
        Nettoyer les sessions expirées
        """
        current_time = datetime.now()
        expired_sessions = []

        for token, session in self.users_data["sessions"].items():
            expires_at = datetime.fromisoformat(session["expires_at"])
            if current_time > expires_at:
                expired_sessions.append(token)

        for token in expired_sessions:
            del self.users_data["sessions"][token]

        if expired_sessions:
            self._save_users()

        return len(expired_sessions)

    def get_user_by_email(self, email: str) -> Optional[Dict]:
        """
        Récupérer un utilisateur par email
        """
        user_id = self._generate_user_id(email.lower().strip())
        return self.users_data["users"].get(user_id)

    def get_user_by_id(self, user_id: str) -> Optional[Dict]:
        """
        Récupérer un utilisateur par ID
        """
        return self.users_data["users"].get(user_id)

    def add_email_to_whitelist(self, email: str) -> bool:
        """
        Ajouter un email à la whitelist
        """
        email = email.lower().strip()
        if email not in self.email_whitelist:
            self.email_whitelist.append(email)
            return self._save_whitelist()
        return True

    def remove_email_from_whitelist(self, email: str) -> bool:
        """
        Retirer un email de la whitelist
        """
        email = email.lower().strip()
        if email in self.email_whitelist:
            self.email_whitelist.remove(email)
            return self._save_whitelist()
        return True

    def get_user_stats(self) -> Dict:
        """
        Statistiques des utilisateurs
        """
        total_users = len(self.users_data["users"])
        active_sessions = len([s for s in self.users_data["sessions"].values()
                             if datetime.fromisoformat(s["expires_at"]) > datetime.now()])

        # Compter par domaine
        domain_count = {}
        for user in self.users_data["users"].values():
            domain = user["email"].split('@')[1] if '@' in user["email"] else 'unknown'
            domain_count[domain] = domain_count.get(domain, 0) + 1

        return {
            "total_users": total_users,
            "active_sessions": active_sessions,
            "total_sessions": len(self.users_data["sessions"]),
            "whitelist_size": len(self.email_whitelist),
            "domains": domain_count,
            "last_updated": self.users_data["metadata"]["last_updated"]
        }

# Instance globale
user_manager = ESIEEUserManager()