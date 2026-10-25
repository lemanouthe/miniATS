from io import StringIO

from django.core.management import call_command


def run():
    out = StringIO()
    call_command("showconfig", stdout=out)
    return out.getvalue()


def test_secrets_are_masked(settings):
    settings.SECRET_KEY = "super-secret-value-1234567890"
    output = run()
    assert "super-secret-value" not in output
    assert "supe… (29 caractères)" in output
    # Le vrai mot de passe de la base (celui du .env ou de la CI) ne doit jamais apparaître.
    password = settings.DATABASES["default"].get("PASSWORD")
    assert password, "les tests tournent avec une base protégée par mot de passe"
    db_line = next(line for line in output.splitlines() if "DATABASE_URL" in line)
    assert f":{password}@" not in db_line
    assert ":***@" in db_line


def test_reports_source_of_each_variable(monkeypatch):
    monkeypatch.setenv("SECURE_SSL_REDIRECT", "True")
    monkeypatch.delenv("GUNICORN_WORKERS", raising=False)
    lines = {l.split()[0]: l for l in run().splitlines() if l.startswith("  ")}
    assert "environnement" in lines["SECURE_SSL_REDIRECT"]
    assert "défaut" in lines["GUNICORN_WORKERS"]
