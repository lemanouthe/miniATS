import os

from django.core.exceptions import ImproperlyConfigured

TRUE_VALUES = {"1", "true", "yes", "on"}
FALSE_VALUES = {"0", "false", "no", "off"}


def env_list(name, default=""):
    return [v.strip() for v in os.environ.get(name, default).split(",") if v.strip()]


def env_bool(name, default):
    raw = os.environ.get(name, "").strip().lower()
    if not raw:
        return default
    if raw in TRUE_VALUES:
        return True
    if raw in FALSE_VALUES:
        return False
    raise ImproperlyConfigured(f"{name}={os.environ[name]!r} : valeur attendue True ou False.")


def env_pair(name, default):
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    if raw.lower() == "none":
        return None
    parts = env_list(name)
    if len(parts) != 2:
        raise ImproperlyConfigured(f"{name}={raw!r} : format attendu EN_TETE,valeur.")
    return tuple(parts)


def env_database():
    import dj_database_url

    if os.environ.get("DATABASE_URL"):
        return dj_database_url.config(conn_max_age=60)
    if os.environ.get("POSTGRES_DB"):
        return {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ["POSTGRES_DB"],
            "USER": os.environ.get("POSTGRES_USER", ""),
            "PASSWORD": os.environ.get("POSTGRES_PASSWORD", ""),
            "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
            "PORT": os.environ.get("POSTGRES_PORT", "5432"),
            "CONN_MAX_AGE": 60,
        }
    raise ImproperlyConfigured(
        "Base non configurée : définir DATABASE_URL (backend/.env en développement) "
        "ou POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD et POSTGRES_HOST (production)."
    )
