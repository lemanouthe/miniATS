# Image de production : API + admin + front

# --- 1. Build du front -------------------------------------------------------
FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_URL=/api
RUN npm run build

# --- 2. Image Python ---------------------------------------------------------
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FRONTEND_DIST=/app/frontend_dist \
    PORT=8000

WORKDIR /app

# UID 1000 : propriétaire de ./media sur le serveur
RUN useradd --uid 1000 --create-home --shell /usr/sbin/nologin app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend /frontend/dist ${FRONTEND_DIST}
COPY deploy/entrypoint.sh /entrypoint.sh

RUN DJANGO_SECRET_KEY=build-only DATABASE_URL=sqlite:////tmp/build.sqlite3 \
        python manage.py collectstatic --noinput \
    && mkdir -p /app/media \
    && chown -R app:app /app/media \
    && chmod +x /entrypoint.sh

USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:${PORT}/api/health/', timeout=4)" || exit 1

ENTRYPOINT ["/entrypoint.sh"]
