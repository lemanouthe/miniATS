import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError

from conftest import PASSWORD, USER_DATA

User = get_user_model()
pytestmark = pytest.mark.django_db


def test_create_user_normalizes_email():
    user = User.objects.create_user(email="Alice@EXAMPLE.com", password=PASSWORD)
    assert user.email == "Alice@example.com"
    assert user.check_password(PASSWORD)
    assert not user.is_staff and not user.is_superuser


def test_create_user_requires_email():
    with pytest.raises(ValueError):
        User.objects.create_user(email="", password=PASSWORD)


def test_create_superuser():
    admin = User.objects.create_superuser(email="admin@example.com", password=PASSWORD)
    assert admin.is_staff and admin.is_superuser


def test_email_is_unique(user):
    with pytest.raises(IntegrityError):
        User.objects.create_user(email=user.email, password=PASSWORD)


def test_login_with_email(user, anon_client):
    res = anon_client.post("/api/auth/token/", {"email": user.email, "password": PASSWORD}, format="json")
    assert res.status_code == 200
    assert {"access", "refresh"} <= set(res.data)


def test_me_returns_current_user(api_client):
    res = api_client.get("/api/auth/me/")
    assert res.status_code == 200
    assert res.data["email"] == USER_DATA["email"]
    assert res.data["full_name"] == f"{USER_DATA['first_name']} {USER_DATA['last_name']}"


def test_me_email_is_read_only(api_client, user):
    res = api_client.patch("/api/auth/me/", {"first_name": "Alicia", "email": "pirate@example.com"}, format="json")
    assert res.status_code == 200
    user.refresh_from_db()
    assert user.first_name == "Alicia"
    assert user.email == USER_DATA["email"]


def test_me_requires_authentication(anon_client):
    assert anon_client.get("/api/auth/me/").status_code == 401
