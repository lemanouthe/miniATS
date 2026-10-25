#!/usr/bin/env bash
# Déploiement (lancé par GitHub Actions, ou à la main sur le serveur).
# Ne touche qu'aux ressources du projet mini-ats. Le .env est généré par la CI (deploy/setup_env_prod.sh).
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml"
SERVICE=mini-ats-api

bash deploy/precheck.sh

$COMPOSE pull

# Vérifie la base avec la NOUVELLE image, sur le réseau `net` et avec le vrai .env, AVANT de
# remplacer le conteneur en service : en cas d'échec, la version en ligne continue de tourner.
# VIRTUAL_HOST vide : nginx-proxy ignore ce conteneur temporaire et ne lui envoie aucun trafic.
echo "Vérification de la connexion à la base…"
if ! $COMPOSE run --rm --no-deps -T \
        -e VIRTUAL_HOST= -e LETSENCRYPT_HOST= \
        --entrypoint python "$SERVICE" -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from django.db import connection
connection.ensure_connection()
print('Base joignable :', connection.settings_dict['HOST'], connection.settings_dict['NAME'])
"; then
    cat <<'HELP'
Échec : la base n'est pas joignable depuis le réseau `net`. Le conteneur en service n'a pas été touché.
Pistes (Postgres sur l'hôte, POSTGRES_HOST=172.17.0.1) :
  - postgresql.conf : listen_addresses doit inclure 172.17.0.1 (ou '*') ;
  - pg_hba.conf : autoriser le sous-réseau de `net` (docker network inspect net -f '{{range .IPAM.Config}}{{.Subnet}}{{end}}') ;
  - ufw : sudo ufw allow from <sous-réseau de net> to any port 5432 proto tcp ;
  - POSTGRES_USER / POSTGRES_DB (deploy/setup_env_prod.sh) et le secret POSTGRES_PASSWORD.
HELP
    exit 1
fi

$COMPOSE up -d --remove-orphans

# Attend le healthcheck de l'image (migrations comprises) avant de déclarer le déploiement réussi.
container="$($COMPOSE ps -q "$SERVICE")"
echo "Attente du healthcheck…"
for _ in $(seq 1 30); do
    status="$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || echo starting)"
    if [ "$status" = "healthy" ]; then
        echo "Conteneur sain."
        docker image prune -f >/dev/null  # images « dangling » uniquement, jamais celles des autres projets
        exit 0
    fi
    [ "$status" = "unhealthy" ] && break
    sleep 5
done

echo "Échec : le conteneur n'est pas sain (statut : ${status:-inconnu}). Derniers logs :"
$COMPOSE logs --tail 50 "$SERVICE"
exit 1
