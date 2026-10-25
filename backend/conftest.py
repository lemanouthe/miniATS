import io

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from applications.models import Application

PASSWORD = "pass12345"

USER_DATA = {"email": "alice@example.com", "first_name": "Alice", "last_name": "Martin"}
OTHER_USER_DATA = {"email": "bob@example.com", "first_name": "Bob", "last_name": "Durand"}

PROFILE_DATA = {
    "job_title": "Développeuse React",
    "phone": "+33 6 12 34 56 78",
    "location": "Lyon",
    "linkedin_url": "https://www.linkedin.com/in/alice",
    "bio": "Front avant tout.",
}

APPLICATION_DATA = {"company": "Zenith", "position": "Dev full stack"}


@pytest.fixture(autouse=True)
def media_root(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    return tmp_path


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(password=PASSWORD, **USER_DATA)


@pytest.fixture
def other_user(db):
    return get_user_model().objects.create_user(password=PASSWORD, **OTHER_USER_DATA)


@pytest.fixture
def anon_client():
    return APIClient()


@pytest.fixture
def api_client(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def make_application(user):
    def make(**overrides):
        return Application.objects.create(**{"owner": user, **APPLICATION_DATA, **overrides})
    return make


@pytest.fixture
def make_image():
    def make(name="photo.png", size=(10, 10)):
        buf = io.BytesIO()
        Image.new("RGB", size, "blue").save(buf, format="PNG")
        return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")
    return make
