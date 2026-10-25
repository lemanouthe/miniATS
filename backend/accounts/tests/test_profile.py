from django.core.files.uploadedfile import SimpleUploadedFile

from conftest import PROFILE_DATA


def upload(client, image):
    return client.patch("/api/auth/me/", {"avatar": image}, format="multipart")


def test_update_profile_fields(api_client, user):
    res = api_client.patch("/api/auth/me/", PROFILE_DATA, format="json")
    assert res.status_code == 200
    user.refresh_from_db()
    for field, value in PROFILE_DATA.items():
        assert getattr(user, field) == value


def test_invalid_phone_and_linkedin(api_client):
    res = api_client.patch("/api/auth/me/", {"phone": "abc", "linkedin_url": "pas-une-url"}, format="json")
    assert res.status_code == 400
    assert {"phone", "linkedin_url"} <= set(res.data)


def test_upload_avatar_returns_absolute_url(api_client, user, media_root, make_image):
    res = upload(api_client, make_image())
    assert res.status_code == 200
    assert res.data["avatar"].startswith("http://testserver/media/avatars/")
    user.refresh_from_db()
    assert (media_root / user.avatar.name).exists()


def test_replacing_avatar_deletes_old_file(api_client, user, media_root, make_image):
    upload(api_client, make_image())
    user.refresh_from_db()
    old = media_root / user.avatar.name

    upload(api_client, make_image("new.png"))
    user.refresh_from_db()
    assert not old.exists()
    assert (media_root / user.avatar.name).exists()


def test_remove_avatar(api_client, user, media_root, make_image):
    upload(api_client, make_image())
    user.refresh_from_db()
    path = media_root / user.avatar.name

    res = api_client.patch("/api/auth/me/", {"avatar": None}, format="json")
    assert res.status_code == 200
    assert res.data["avatar"] is None
    assert not path.exists()


def test_rejects_non_image(api_client):
    fake = SimpleUploadedFile("cv.pdf", b"%PDF-1.4 pas une image", content_type="application/pdf")
    res = upload(api_client, fake)
    assert res.status_code == 400
    assert "avatar" in res.data


def test_rejects_avatar_over_2mb(api_client, make_image, monkeypatch):
    monkeypatch.setattr("accounts.serializers.MAX_AVATAR_SIZE", 100)
    res = upload(api_client, make_image(size=(200, 200)))
    assert res.status_code == 400
    assert "2 Mo" in str(res.data["avatar"])
