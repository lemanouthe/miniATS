import os

from django.conf import settings
from django.core.management.base import BaseCommand
from dotenv import dotenv_values


def _mask(value):
    return f"{value[:4]}… ({len(value)} caractères)" if value else "(vide)"


def _database(_):
    db = settings.DATABASES["default"]
    user = f"{db.get('USER')}:***@" if db.get("USER") else ""
    return f"{db['ENGINE'].rsplit('.', 1)[-1]}://{user}{db.get('HOST') or ''}:{db.get('PORT') or ''}/{db['NAME']}"


VARIABLES = [
    ("DJANGO_DEBUG", "Django", lambda s: s.DEBUG),
    ("DJANGO_SECRET_KEY", "Django", lambda s: _mask(s.SECRET_KEY)),
    ("DJANGO_ALLOWED_HOSTS", "Django", lambda s: ", ".join(s.ALLOWED_HOSTS)),
    ("CSRF_TRUSTED_ORIGINS", "Django", lambda s: ", ".join(s.CSRF_TRUSTED_ORIGINS) or "—"),
    ("CORS_ALLOWED_ORIGINS", "Django", lambda s: ", ".join(s.CORS_ALLOWED_ORIGINS) or "—"),
    ("DJANGO_LOG_LEVEL", "Django", lambda s: s.LOGGING["root"]["level"]),
    ("DATABASE_URL", "Base", _database),
    ("POSTGRES_DB", "Base", lambda s: s.DATABASES["default"]["NAME"]),
    ("POSTGRES_USER", "Base", lambda s: s.DATABASES["default"].get("USER") or "—"),
    ("POSTGRES_PASSWORD", "Base", lambda s: "***" if s.DATABASES["default"].get("PASSWORD") else "(vide)"),
    ("POSTGRES_HOST", "Base", lambda s: s.DATABASES["default"].get("HOST") or "—"),
    ("POSTGRES_PORT", "Base", lambda s: s.DATABASES["default"].get("PORT") or "—"),
    ("DATABASE_HOST", "Base", lambda s: s.DATABASES["default"].get("HOST") or "—"),
    ("SECURE_SSL_REDIRECT", "Sécurité", lambda s: s.SECURE_SSL_REDIRECT),
    ("SECURE_PROXY_SSL_HEADER", "Sécurité", lambda s: ",".join(s.SECURE_PROXY_SSL_HEADER or ()) or "None"),
    ("SESSION_COOKIE_SECURE", "Sécurité", lambda s: s.SESSION_COOKIE_SECURE),
    ("CSRF_COOKIE_SECURE", "Sécurité", lambda s: s.CSRF_COOKIE_SECURE),
    ("SECURE_CONTENT_TYPE_NOSNIFF", "Sécurité", lambda s: s.SECURE_CONTENT_TYPE_NOSNIFF),
    ("SERVE_MEDIA", "Fichiers", lambda s: s.SERVE_MEDIA),
    ("FRONTEND_DIST", "Fichiers", lambda s: f"{s.FRONTEND_DIST}{'' if s.FRONTEND_DIST.is_dir() else ' (absent)'}"),
    # lues par l'entrypoint
    ("PORT", "Conteneur", lambda s: os.environ.get("PORT", "8000")),
    ("GUNICORN_WORKERS", "Conteneur", lambda s: os.environ.get("GUNICORN_WORKERS", "3")),
    ("SEED_DEMO", "Conteneur", lambda s: os.environ.get("SEED_DEMO", "0")),
]


class Command(BaseCommand):
    help = "Affiche les variables d'environnement, leur source et leur valeur effective (secrets masqués)."

    def handle(self, *args, **options):
        env_file = settings.BASE_DIR / ".env"
        file_values = dotenv_values(env_file) if env_file.is_file() else {}

        def source(name):
            if name not in os.environ:
                return "défaut"
            if name in file_values and file_values[name] == os.environ[name]:
                return ".env"
            return "environnement"

        self.stdout.write(f"Fichier .env : {env_file if file_values else 'absent'}\n")
        group = None
        for name, grp, effective in VARIABLES:
            if grp != group:
                group = grp
                self.stdout.write(self.style.MIGRATE_HEADING(f"\n{grp}"))
            self.stdout.write(f"  {name:<28} {source(name):<14} {effective(settings)}")

        unknown = sorted(set(file_values) - {name for name, _, _ in VARIABLES})
        if unknown:
            self.stdout.write(self.style.WARNING(
                f"\nVariables du .env non utilisées par le projet (faute de frappe ?) : {', '.join(unknown)}"
            ))
