import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Les variables déjà définies (CI, docker-compose) restent prioritaires sur le fichier .env.
load_dotenv(BASE_DIR / ".env")


def env_list(name, default=""):
    return [v.strip() for v in os.environ.get(name, default).split(",") if v.strip()]


# DEBUG est désactivé par défaut : il faut DJANGO_DEBUG=1 (dans backend/.env) pour le développement.
DEBUG = os.environ.get("DJANGO_DEBUG", "0") == "1"

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured("DJANGO_SECRET_KEY est obligatoire quand DJANGO_DEBUG vaut 0.")
    SECRET_KEY = "dev-only-insecure-key-change-me-in-production-please"

# localhost reste autorisé pour le healthcheck Docker, qui appelle l'API depuis le conteneur.
ALLOWED_HOSTS = [*env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1"), "localhost", "127.0.0.1"]
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "django_filters",
    "corsheaders",
    "accounts",
    "applications",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

if not os.environ.get("DATABASE_URL"):
    raise ImproperlyConfigured(
        "DATABASE_URL manquant : copier backend/.env.example vers backend/.env et le renseigner."
    )
DATABASES = {"default": dj_database_url.config(conn_max_age=60)}
# Dans Docker, "localhost" désigne le conteneur : docker-compose fournit l'hôte à utiliser.
if os.environ.get("DATABASE_HOST"):
    DATABASES["default"]["HOST"] = os.environ["DATABASE_HOST"]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Europe/Paris"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# Fichiers statiques (admin) servis par WhiteNoise, compressés et versionnés en production.
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        if DEBUG
        else "whitenoise.storage.CompressedManifestStaticFilesStorage"
    },
}

# Build du front (frontend/dist), copié dans l'image Docker : Django sert l'application React
# sur le même domaine que l'API. Absent en développement, où Vite sert le front.
FRONTEND_DIST = Path(os.environ.get("FRONTEND_DIST", BASE_DIR / "frontend_dist"))
if FRONTEND_DIST.is_dir():
    WHITENOISE_ROOT = FRONTEND_DIST


def _whitenoise_immutable(path, url):
    # Fichiers de Vite (/assets/nom-<hash>.js) : leur nom change à chaque build, cache illimité possible.
    return url.startswith("/assets/")


WHITENOISE_IMMUTABLE_FILE_TEST = _whitenoise_immutable
# index.html n'est jamais servi par WhiteNoise : la vue spa_index le renvoie avec Cache-Control: no-cache.

# Photos de profil servies par Django. Suffisant pour un projet de démonstration ;
# à plus grande échelle, on passerait par un stockage objet (S3, Scaleway Object Storage).
SERVE_MEDIA = DEBUG or os.environ.get("SERVE_MEDIA", "1") == "1"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 10,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:5173")

# Derrière nginx-proxy : TLS terminé par le proxy, qui transmet X-Forwarded-Proto.
# La redirection HTTP -> HTTPS et HSTS sont déjà assurés par nginx-proxy.
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": os.environ.get("DJANGO_LOG_LEVEL", "INFO")},
}
