#!/usr/bin/env bash
# Déploiement (lancé par GitHub Actions, ou à la main sur le serveur).
# Ne touche qu'aux ressources du projet mini-ats.
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml"
SERVICE=mini-ats-api

bash deploy/precheck.sh

$COMPOSE pull
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
