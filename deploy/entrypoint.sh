#!/bin/sh
# Point d'entrée du conteneur de production.
set -e

python manage.py migrate --noinput

# Compte de démonstration (demo@example.com / demo12345), idempotent.
if [ "${SEED_DEMO:-0}" = "1" ]; then
    python manage.py seed_demo
fi

exec gunicorn config.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers "${GUNICORN_WORKERS:-3}" \
    --timeout 60 \
    --access-logfile - \
    --error-logfile -
