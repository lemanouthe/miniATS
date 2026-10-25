#!/usr/bin/env bash
# Vérifications avant déploiement sur le serveur partagé. Sortie non nulle = ne pas déployer.
# Usage (sur le serveur) : cd ~/projects/miniAts && bash deploy/precheck.sh
set -uo pipefail
cd "$(dirname "$0")/.."

PROJECT=mini-ats
COMPOSE_FILE=docker-compose.prod.yml
MEDIA_UID=1000
errors=0

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; errors=$((errors + 1)); }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }

echo "Precheck $PROJECT"

# --- Fichiers du projet ---
if [ -f .env ]; then ok ".env présent"; else fail ".env absent (généré par la CI : deploy/setup_env_prod.sh)"; fi
[ -f "$COMPOSE_FILE" ] && ok "$COMPOSE_FILE présent" || fail "$COMPOSE_FILE absent"

# Valeur d'une variable du .env, sans les guillemets simples ajoutés par le workflow.
env_value() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- | sed -E "s/^'(.*)'$/\1/"; }
for var in IMAGE DJANGO_SECRET_KEY DJANGO_ALLOWED_HOSTS POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD POSTGRES_HOST; do
    value="$(env_value "$var")"
    if [ -z "$value" ] || [[ "$value" == *"<"* ]] || [ "$value" = "a-generer" ]; then
        fail "$var non renseigné dans .env"
    fi
done
case "$(env_value DJANGO_DEBUG | tr '[:upper:]' '[:lower:]')" in
    1|true|yes|on) fail "DJANGO_DEBUG activé : interdit en production" ;;
esac

# --- Infrastructure partagée ---
if docker network inspect net >/dev/null 2>&1; then ok "réseau externe 'net' présent"; else fail "réseau 'net' absent"; fi

running_with_image() { docker ps --format '{{.Names}} {{.Image}}' | grep -iE "$1" | head -1 | cut -d' ' -f1; }
proxy="$(running_with_image 'nginx-proxy|jwilder/nginx')"
acme="$(running_with_image 'acme-companion|letsencrypt-nginx-proxy-companion')"
[ -n "$proxy" ] && ok "nginx-proxy actif ($proxy)" || fail "nginx-proxy introuvable ou arrêté"
[ -n "$acme" ]  && ok "acme-companion actif ($acme)" || fail "acme-companion introuvable ou arrêté"

# --- Compose : nom de projet, ports, domaine ---
DOMAIN=""
# Valeur d'une variable d'environnement du service, telle que Compose la résout (compose + .env).
service_env() { printf '%s\n' "$config" | sed -n "s/^ *$1: //p" | head -1 | sed -E 's/^"(.*)"$/\1/'; }
if config="$(docker compose -f "$COMPOSE_FILE" config 2>&1)"; then
    name="$(printf '%s\n' "$config" | sed -n 's/^name: //p' | head -1)"
    [ "$name" = "$PROJECT" ] && ok "nom de projet Compose : $name" || fail "nom de projet Compose '$name' (attendu : $PROJECT)"
    if printf '%s\n' "$config" | grep -qE '^\s+published:'; then
        fail "un port est publié sur l'hôte (interdit sur le serveur partagé)"
    else
        ok "aucun port publié sur l'hôte"
    fi

    DOMAIN="$(service_env VIRTUAL_HOST)"
    vport="$(service_env VIRTUAL_PORT)"; port="$(service_env PORT)"
    [ -n "$DOMAIN" ] && ok "VIRTUAL_HOST : $DOMAIN" || fail "VIRTUAL_HOST absent du service"
    [ -n "$(service_env LETSENCRYPT_HOST)" ] && [ -n "$(service_env LETSENCRYPT_EMAIL)" ] \
        && ok "LETSENCRYPT_HOST et LETSENCRYPT_EMAIL définis" || fail "LETSENCRYPT_HOST ou LETSENCRYPT_EMAIL absent"
    # nginx-proxy envoie le trafic sur VIRTUAL_PORT : gunicorn doit écouter sur ce même port.
    if [ -n "$vport" ] && [ "$vport" = "${port:-8000}" ]; then
        ok "gunicorn écoute sur VIRTUAL_PORT ($vport)"
    else
        fail "VIRTUAL_PORT ($vport) différent de PORT (${port:-8000 par défaut}) : nginx-proxy répondrait 502"
    fi
    allowed="$(service_env DJANGO_ALLOWED_HOSTS)"
    if [ -n "$DOMAIN" ] && printf '%s' "$allowed" | tr ',' '\n' | grep -qxF "$DOMAIN"; then
        ok "DJANGO_ALLOWED_HOSTS contient $DOMAIN"
    else
        fail "DJANGO_ALLOWED_HOSTS ($allowed) ne contient pas $DOMAIN : Django répondrait 400"
    fi
else
    fail "docker compose config échoue : $config"
fi

# --- Unicité du VIRTUAL_HOST ---
if [ -n "$DOMAIN" ]; then
    conflict=""
    for id in $(docker ps -q); do
        project="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$id")"
        [ "$project" = "$PROJECT" ] && continue
        hosts="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$id" | sed -n 's/^VIRTUAL_HOST=//p')"
        if printf '%s' "$hosts" | tr ',' '\n' | grep -qxF "$DOMAIN"; then
            conflict="$(docker inspect -f '{{.Name}}' "$id")"
        fi
    done
    [ -z "$conflict" ] && ok "VIRTUAL_HOST $DOMAIN unique" || fail "VIRTUAL_HOST $DOMAIN déjà utilisé par $conflict"
fi

# --- Dossier monté ---
mkdir -p media
owner="$(stat -c %u media 2>/dev/null || stat -f %u media)"
if [ "$owner" = "$MEDIA_UID" ] && [ -w media ]; then
    ok "media/ appartient à l'UID $MEDIA_UID (utilisateur du conteneur)"
else
    fail "media/ doit appartenir à l'UID $MEDIA_UID (actuel : $owner) : sudo chown -R $MEDIA_UID:$MEDIA_UID media"
fi
[ -d static ] && warn "dossier ./static inutile (statiques dans l'image, servis par WhiteNoise)"

echo
if [ "$errors" -gt 0 ]; then
    echo "Precheck : $errors erreur(s), ne pas déployer."
    exit 1
fi
echo "Precheck OK."
