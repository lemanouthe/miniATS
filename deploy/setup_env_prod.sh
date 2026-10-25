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
    # Espaces et retours à la ligne en début/fin : souvent ajoutés par un copier-coller dans GitHub.
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    printf -v "$secret" '%s' "$value"

    [ -n "$value" ] || { echo "✗ $secret manquant (secret GitHub)" >&2; exit 1; }
    if ! [[ "$value" =~ ^[A-Za-z0-9_-]+$ ]]; then
        # Diagnostic sans jamais afficher le secret : longueur et nombre de caractères interdits.
        bad="$(printf '%s' "$value" | LC_ALL=C tr -d 'A-Za-z0-9_-' | wc -c | tr -d ' ')"
        echo "✗ $secret contient $bad caractère(s) interdit(s) sur ${#value} (seuls A-Z a-z 0-9 _ -)." >&2
        echo "  Regénérer : python3 -c \"import secrets; print(secrets.token_urlsafe(64))\"" >&2
        exit 1
    fi
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

# Pas de chmod 600 ici : scp-action tourne dans son propre conteneur, avec un autre utilisateur,
# et ne pourrait plus lire le fichier. Les droits 600 sont posés sur le serveur, juste après la
# copie (étape ssh-action), et le .env est supprimé du runner en fin de job.
echo "✓ .env généré ($(wc -l < .env) lignes)"
