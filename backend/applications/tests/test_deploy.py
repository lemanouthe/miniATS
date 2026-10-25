"""Comportements propres au déploiement : healthcheck et service du front."""
import pytest


def test_health_is_public(db, anon_client):
    res = anon_client.get("/api/health/")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


@pytest.fixture
def frontend_dist(settings, tmp_path):
    (tmp_path / "index.html").write_text("<!doctype html><div id=root></div>")
    settings.FRONTEND_DIST = tmp_path
    return tmp_path


@pytest.mark.parametrize("path", ["/", "/applications", "/applications/12", "/profile"])
def test_front_routes_return_index(anon_client, frontend_dist, path):
    res = anon_client.get(path)
    assert res.status_code == 200
    assert b'<div id=root>' in b"".join(res.streaming_content)
    assert res["Cache-Control"] == "no-cache"


def test_unknown_api_route_stays_404(db, anon_client, frontend_dist):
    assert anon_client.get("/api/inconnu/").status_code == 404
