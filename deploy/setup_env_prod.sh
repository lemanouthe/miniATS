#!/usr/bin/env bash
# Génère le .env de production (CI). Secrets : DJANGO_SECRET_KEY, POSTGRES_PASSWORD.
# Secrets URL-safe uniquement (A-Z a-z 0-9 _ -) : python3 -c "import secrets; print(secrets.token_urlsafe(64))"
set -e

for secret in DJANGO_SECRET_KEY POSTGRES_PASSWORD; do
    value="${!secret}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    printf -v "$secret" '%s' "$value"

    [ -n "$value" ] || { echo "✗ $secret manquant (secret GitHub)" >&2; exit 1; }
    if ! [[ "$value" =~ ^[A-Za-z0-9_-]+$ ]]; then
        bad="$(printf '%s' "$value" | LC_ALL=C tr -d 'A-Za-z0-9_-' | wc -c | tr -d ' ')"
        echo "✗ $secret contient $bad caractère(s) interdit(s) sur ${#value} (seuls A-Z a-z 0-9 _ -)." >&2
        echo "  Regénérer : python3 -c \"import secrets; print(secrets.token_urlsafe(64))\"" >&2
        exit 1
    fi
done

cat > .env <<EOF
# Généré par setup_env_prod.sh

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
POSTGRES_USER=mini
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_HOST=172.17.0.1
POSTGRES_PORT=5432

# --- Conteneur ---
# = VIRTUAL_PORT
PORT=8012
GUNICORN_WORKERS=3
SEED_DEMO=1
EOF

echo "✓ .env généré ($(wc -l < .env) lignes)"
