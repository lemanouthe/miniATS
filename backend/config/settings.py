import os
from datetime import timedelta
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

from .env import env_bool, env_database, env_list, env_pair

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


DEBUG = env_bool("DJANGO_DEBUG", False)

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured("DJANGO_SECRET_KEY est obligatoire quand DJANGO_DEBUG vaut 0.")
    SECRET_KEY = "dev-only-insecure-key-change-me-in-production-please"

# localhost : healthcheck Docker
ALLOWED_HOSTS = list(dict.fromkeys([*env_list("DJANGO_ALLOWED_HOSTS"), "localhost", "127.0.0.1"]))
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

DATABASES = {"default": env_database()}
# docker-compose de dev
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

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        if DEBUG
        else "whitenoise.storage.CompressedManifestStaticFilesStorage"
    },
}

# Front buildé, présent uniquement dans l'image Docker
FRONTEND_DIST = Path(os.environ.get("FRONTEND_DIST", BASE_DIR / "frontend_dist"))
if FRONTEND_DIST.is_dir():
    WHITENOISE_ROOT = FRONTEND_DIST


def _whitenoise_immutable(path, url):
    # assets Vite hashés
    return url.startswith("/assets/")


WHITENOISE_IMMUTABLE_FILE_TEST = _whitenoise_immutable

SERVE_MEDIA = DEBUG or env_bool("SERVE_MEDIA", True)
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

# --- HTTPS (derrière nginx-proxy) ---
SECURE_PROXY_SSL_HEADER = env_pair(
    "SECURE_PROXY_SSL_HEADER", None if DEBUG else ("HTTP_X_FORWARDED_PROTO", "https")
)
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", False)
# appelé en HTTP par le healthcheck
SECURE_REDIRECT_EXEMPT = [r"^api/health/$"]
SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", not DEBUG)
CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE", not DEBUG)
SECURE_CONTENT_TYPE_NOSNIFF = env_bool("SECURE_CONTENT_TYPE_NOSNIFF", True)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": os.environ.get("DJANGO_LOG_LEVEL", "INFO")},
}
