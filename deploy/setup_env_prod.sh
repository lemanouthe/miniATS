#!/usr/bin/env bash
# Génère le .env de PRODUCTION dans la CI (GitHub Actions), puis il est copié
# sur le serveur par scp (job deploy).
#
# Valeurs non sensibles : en dur ci-dessous.
# Valeurs sensibles : lues depuis l'environnement (secrets GitHub) :
#   DJANGO_SECRET_KEY, POSTGRES_PASSWORD
# IMAGE_TAG : fourni par le workflow (SHA du commit), "latest" par défaut.
#
# ⚠️ Les secrets doivent être "URL-safe" (A-Z a-z 0-9 _ -) : PAS de $ # " ' espace,
#    sinon Docker Compose casse le .env (interpolation $VAR, commentaire #).
#    Générer : python3 -c "import secrets; print(secrets.token_urlsafe(64))"
set -e

for secret in DJANGO_SECRET_KEY POSTGRES_PASSWORD; do
    value="${!secret}"
    [ -n "$value" ] || { echo "✗ $secret manquant (secret GitHub)" >&2; exit 1; }
    [[ "$value" =~ ^[A-Za-z0-9_-]+$ ]] || { echo "✗ $secret contient des caractères interdits (seuls A-Z a-z 0-9 _ -)" >&2; exit 1; }
done

cat > .env <<EOF
# Généré par setup_env_prod.sh (CI) — ne pas éditer à la main sur le serveur.

# --- Image ---
IMAGE=ghcr.io/lemanouthe/mini-ats:${IMAGE_TAG:-latest}

# --- Django ---
DJANGO_DEBUG=False
DJANGO_SECRET_KEY=${DJANGO_SECRET_KEY}
DJANGO_ALLOWED_HOSTS=miniats.lemanouthe.com,localhost
CSRF_TRUSTED_ORIGINS=https://miniats.lemanouthe.com

# --- Sécurité HTTPS (derrière nginx-proxy) ---
SECURE_SSL_REDIRECT=True
SECURE_PROXY_SSL_HEADER=HTTP_X_FORWARDED_PROTO,https
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
SECURE_CONTENT_TYPE_NOSNIFF=True

# --- PostgreSQL (base externe, sur l'hôte) ---
POSTGRES_DB=mini_ats
POSTGRES_USER=miniatsuser
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_HOST=172.17.0.1
POSTGRES_PORT=5432

# --- Conteneur ---
# Port d'écoute de gunicorn : doit être égal au VIRTUAL_PORT de docker-compose.prod.yml.
PORT=8012
GUNICORN_WORKERS=3
SEED_DEMO=1
EOF

chmod 600 .env
echo "✓ .env généré ($(wc -l < .env) lignes)"
