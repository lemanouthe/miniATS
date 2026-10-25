from applications.models import Application
from conftest import APPLICATION_DATA, PASSWORD

URL = "/api/applications/"


def detail(app):
    return f"{URL}{app.id}/"


def test_requires_authentication(db, anon_client):
    assert anon_client.get(URL).status_code == 401


def test_jwt_login_flow(user, anon_client):
    res = anon_client.post("/api/auth/token/", {"email": user.email, "password": PASSWORD}, format="json")
    assert res.status_code == 200
    anon_client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    assert anon_client.get(URL).status_code == 200

    refreshed = anon_client.post("/api/auth/token/refresh/", {"refresh": res.data["refresh"]}, format="json")
    assert refreshed.status_code == 200
    assert "access" in refreshed.data


def test_create_sets_owner(api_client, user):
    res = api_client.post(URL, APPLICATION_DATA, format="json")
    assert res.status_code == 201
    assert Application.objects.get(id=res.data["id"]).owner == user
    assert res.data["status"] == "to_apply"


def test_owner_in_payload_is_ignored(api_client, user, other_user):
    res = api_client.post(URL, {**APPLICATION_DATA, "owner": other_user.id}, format="json")
    assert Application.objects.get(id=res.data["id"]).owner == user


def test_create_validation_errors(api_client):
    res = api_client.post(URL, {"job_url": "pas-une-url"}, format="json")
    assert res.status_code == 400
    assert {"company", "position", "job_url"} <= set(res.data)


def test_user_cannot_see_others_applications(api_client, other_user, make_application):
    other = make_application(owner=other_user)
    assert api_client.get(detail(other)).status_code == 404
    assert api_client.patch(detail(other), {"status": "offer"}, format="json").status_code == 404
    assert api_client.delete(detail(other)).status_code == 404
    assert api_client.get(URL).data["count"] == 0


def test_filter_by_status(api_client, make_application):
    make_application(company="A", status="applied")
    make_application(company="B", status="offer")
    res = api_client.get(URL, {"status": "offer"})
    assert res.data["count"] == 1
    assert res.data["results"][0]["company"] == "B"


def test_search(api_client, make_application):
    make_application(company="Zenith", position="Django dev")
    make_application(company="Autre", position="Java dev")
    assert api_client.get(URL, {"search": "django"}).data["count"] == 1


def test_ordering(api_client, make_application):
    make_application(company="B")
    make_application(company="A")
    res = api_client.get(URL, {"ordering": "company"})
    assert [r["company"] for r in res.data["results"]] == ["A", "B"]


def test_pagination(api_client, make_application):
    for i in range(12):
        make_application(company=f"C{i}")
    res = api_client.get(URL, {"page": 2})
    assert res.data["count"] == 12
    assert len(res.data["results"]) == 2


def test_patch_status(api_client, make_application):
    app = make_application()
    res = api_client.patch(detail(app), {"status": "interview"}, format="json")
    assert res.status_code == 200
    app.refresh_from_db()
    assert app.status == "interview"


def test_delete(api_client, make_application):
    app = make_application()
    assert api_client.delete(detail(app)).status_code == 204
    assert not Application.objects.filter(id=app.id).exists()
