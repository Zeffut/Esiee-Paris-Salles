# Stage de build
FROM python:3.13-slim AS builder

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY requirements.txt .

# Installer les dépendances
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Stage de production
FROM python:3.13-slim

# Définir le répertoire de travail
WORKDIR /app

# Copier les dépendances Python depuis le builder
COPY --from=builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages

# Copier le code source de l'application
COPY . .

# Créer un utilisateur non-root pour la sécurité
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

# Passer à l'utilisateur non-root
USER appuser

# Exposer le port de l'application
EXPOSE 3001

# Variable d'environnement pour Python
ENV PYTHONUNBUFFERED=1

# Commande de démarrage
CMD ["python", "app.py"]