# API ESIEE - Déploiement Docker

Cette API Flask gère les salles ESIEE et leurs réservations.

## Prérequis

- Docker
- Dokploy (pour le déploiement en production)

## Déploiement avec Dokploy

### 1. Accéder à Dokploy

Ouvrez https://dockploy.zeffut.fr et connectez-vous.

### 2. Créer une nouvelle application

1. Cliquez sur **"Create Project"** ou **"New Application"**
2. Sélectionnez **"Docker"** comme type de déploiement
3. Choisissez l'une des options suivantes :

#### Option A : Depuis un repository Git (recommandé)
- Connectez votre repository GitHub/GitLab
- Dokploy détectera automatiquement le `Dockerfile`
- Sélectionnez la branche à déployer

#### Option B : Upload manuel
- Uploadez le dossier `api/` contenant le Dockerfile
- Dokploy construira l'image automatiquement

### 3. Configuration de l'application

Configurez les paramètres suivants dans l'interface Dokploy :

**Ports :**
- Container Port : `3001`
- Host Port : `3001` (ou autre selon vos besoins)

**Volumes (important pour la persistance) :**
- `/app/esiee_cache.json` → Volume persistant pour le cache
- `/app/esiee_users.json` → Volume persistant pour les utilisateurs
- `/app/email_whitelist.json` → Volume pour la whitelist

**Variables d'environnement :**
- `PYTHONUNBUFFERED=1`

**Network :**
- Utilisez le réseau par défaut ou créez un réseau dédié

### 4. Build et déploiement

- Cliquez sur **"Deploy"**
- Dokploy va construire l'image et démarrer le conteneur
- Suivez les logs en temps réel dans l'interface

### 5. Configuration Nginx (si nécessaire)

Si vous avez besoin d'un domaine personnalisé, Dokploy peut gérer automatiquement :
- Le reverse proxy
- Les certificats SSL
- Le renouvellement automatique

## Déploiement manuel avec Docker

Si vous préférez déployer manuellement sans Dokploy :

```bash
# Construction de l'image
docker build -t esiee-api .

# Lancement du conteneur
docker run -d \
  --name esiee-api \
  -p 3001:3001 \
  -v esiee-cache:/app/esiee_cache.json \
  -v esiee-users:/app/esiee_users.json \
  -v esiee-whitelist:/app/email_whitelist.json \
  --restart unless-stopped \
  esiee-api

# Voir les logs
docker logs -f esiee-api

# Arrêter le conteneur
docker stop esiee-api

# Redémarrer le conteneur
docker restart esiee-api
```

## Configuration

### Port par défaut
- Port : `3001`
- Host : `0.0.0.0`

### Fichiers persistants

Les fichiers suivants doivent être persistés via des volumes :
- `esiee_cache.json` - Cache des événements et salles
- `esiee_users.json` - Base de données utilisateurs
- `email_whitelist.json` - Liste des emails autorisés

## Endpoints principaux

- `GET /api/rooms` - Liste des salles
- `GET /api/rooms/{room_number}/schedule` - Emploi du temps d'une salle
- `GET /api/reservations/active` - Réservations actives
- `POST /api/auth/login` - Connexion utilisateur
- `POST /api/reservations` - Créer une réservation

## Healthcheck

Le conteneur inclut un healthcheck automatique pour surveiller l'état de l'API.

## Sécurité

- L'application tourne avec un utilisateur non-root (`appuser`)
- Image multi-stage pour réduire la taille et la surface d'attaque
- Pas de fichiers de développement dans l'image finale
- Python 3.13-slim pour minimiser les vulnérabilités

## Développement local

Pour développer localement sans Docker :

```bash
# Installer les dépendances
pip install -r requirements.txt

# Lancer l'API
python app.py
```

Pour tester avec Docker localement :

```bash
# Build
docker build -t esiee-api .

# Run
docker run -p 3001:3001 esiee-api

# Test
curl http://localhost:3001/api/rooms
```

## Dépannage

### L'API ne démarre pas

```bash
# Vérifier les logs dans Dokploy (interface web)
# Ou en ligne de commande :
docker logs esiee-api
```

### Problème de permissions sur les fichiers JSON

Assurez-vous que les volumes sont correctement configurés dans Dokploy pour persister les données.

### Reconstruire après modifications

Dans Dokploy :
1. Ouvrez votre application
2. Cliquez sur **"Rebuild"** ou **"Redeploy"**
3. Dokploy reconstruira l'image avec les dernières modifications

## Migration depuis systemd

Si vous migrez depuis le service systemd actuel :

1. **Copier les fichiers de données** :
   ```bash
   # Sur le serveur
   cp /opt/esiee-api/esiee_cache.json ./
   cp /opt/esiee-api/esiee_users.json ./
   cp /opt/esiee-api/email_whitelist.json ./
   ```

2. **Arrêter le service systemd** :
   ```bash
   sudo systemctl stop esiee-api
   sudo systemctl disable esiee-api
   ```

3. **Déployer avec Dokploy** en suivant les étapes ci-dessus

4. **Mettre à jour Nginx** si nécessaire (Dokploy peut le gérer automatiquement)
