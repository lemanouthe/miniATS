import pytest
from django.core.exceptions import ImproperlyConfigured
from rest_framework.test import APIClient

from config.env import env_bool, env_pair


@pytest.mark.parametrize("raw, expected", [
    ("True", True), ("true", True), ("1", True), ("yes", True), ("on", True),
    ("False", False), ("false", False), ("0", False), ("no", False), ("off", False),
])
def test_env_bool_values(monkeypatch, raw, expected):
    monkeypatch.setenv("FLAG", raw)
    assert env_bool("FLAG", not expected) is expected


@pytest.mark.parametrize("raw", [None, "", "  "])
def test_env_bool_default_when_absent_or_empty(monkeypatch, raw):
    if raw is None:
        monkeypatch.delenv("FLAG", raising=False)
    else:
        monkeypatch.setenv("FLAG", raw)
    assert env_bool("FLAG", True) is True


def test_env_bool_rejects_typos(monkeypatch):
    monkeypatch.setenv("FLAG", "Ture")
    with pytest.raises(ImproperlyConfigured, match="FLAG"):
        env_bool("FLAG", False)


def test_env_pair(monkeypatch):
    monkeypatch.setenv("HEADER", "HTTP_X_FORWARDED_PROTO, https")
    assert env_pair("HEADER", None) == ("HTTP_X_FORWARDED_PROTO", "https")
    monkeypatch.setenv("HEADER", "None")
    assert env_pair("HEADER", ("A", "b")) is None
    monkeypatch.delenv("HEADER")
    assert env_pair("HEADER", ("A", "b")) == ("A", "b")
    monkeypatch.setenv("HEADER", "HTTP_X_FORWARDED_PROTO")
    with pytest.raises(ImproperlyConfigured):
        env_pair("HEADER", None)


@pytest.fixture
def ssl_redirect(settings):
    settings.SECURE_SSL_REDIRECT = True
    settings.SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")


def test_ssl_redirect_sends_http_to_https(db, ssl_redirect):
    res = APIClient().get("/api/applications/")
    assert res.status_code == 301
    assert res["Location"].startswith("https://")


def test_ssl_redirect_accepts_requests_forwarded_as_https(db, ssl_redirect):
    # Requête arrivée en HTTPS chez nginx-proxy : pas de redirection (401 car non authentifié).
    res = APIClient().get("/api/applications/", HTTP_X_FORWARDED_PROTO="https")
    assert res.status_code == 401


def test_healthcheck_is_exempt_from_ssl_redirect(db, ssl_redirect):
    # Le healthcheck Docker appelle l'API en HTTP depuis le conteneur.
    assert APIClient().get("/api/health/").status_code == 200


def test_database_from_postgres_variables(monkeypatch):
    from config.env import env_database

    monkeypatch.delenv("DATABASE_URL", raising=False)
    for name, value in {"POSTGRES_DB": "mini_ats", "POSTGRES_USER": "miniats", "POSTGRES_PASSWORD": "pw",
                        "POSTGRES_HOST": "172.17.0.1", "POSTGRES_PORT": "5433"}.items():
        monkeypatch.setenv(name, value)
    db = env_database()
    assert db["ENGINE"] == "django.db.backends.postgresql"
    assert (db["NAME"], db["USER"], db["HOST"], db["PORT"]) == ("mini_ats", "miniats", "172.17.0.1", "5433")


def test_database_url_takes_precedence(monkeypatch):
    from config.env import env_database

    monkeypatch.setenv("DATABASE_URL", "postgres://u:p@db.example:5432/autre")
    monkeypatch.setenv("POSTGRES_DB", "mini_ats")
    assert env_database()["NAME"] == "autre"


def test_database_missing_is_explicit(monkeypatch):
    from config.env import env_database

    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("POSTGRES_DB", raising=False)
    with pytest.raises(ImproperlyConfigured, match="POSTGRES_DB"):
        env_database()
