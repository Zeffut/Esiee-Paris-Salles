#!/bin/bash
set -e

echo "=== Setup frontend esiee.zeffut.fr ==="

# 1. Clone ou mise à jour du repo
if [ -d "/opt/esiee-salles" ]; then
  echo "-> Mise à jour du repo..."
  git -C /opt/esiee-salles pull
else
  echo "-> Clonage du repo..."
  git clone https://github.com/Zeffut/Esiee-Paris-Salles.git /opt/esiee-salles
fi

# 2. Build de l'image Docker
echo "-> Build de l'image Docker..."
cd /opt/esiee-salles/frontend
docker build -t esiee-frontend:latest .

# 3. Lancer le conteneur (port 8081 sur le host)
echo "-> Lancement du conteneur..."
docker rm -f esiee-frontend 2>/dev/null || true
docker run -d \
  --name esiee-frontend \
  --restart always \
  -p 127.0.0.1:8081:80 \
  esiee-frontend:latest

# 4. Config nginx (HTTP d'abord, certbot ajoute HTTPS ensuite)
echo "-> Configuration nginx..."
cat > /etc/nginx/sites-available/esiee << 'EOF'
server {
    listen 80;
    server_name esiee.zeffut.fr;

    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/esiee /etc/nginx/sites-enabled/esiee
nginx -t && systemctl reload nginx

echo ""
echo "✅ Setup HTTP terminé. Conteneur: $(docker ps --format '{{.Names}} ({{.Status}})' -f name=esiee-frontend)"
echo ""
echo "⚡ Étape suivante (après changement DNS esiee.zeffut.fr -> 72.60.94.131) :"
echo "   certbot --nginx -d esiee.zeffut.fr --non-interactive --agree-tos -m admin@zeffut.fr"
