import uuid
from pathlib import Path

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.validators import RegexValidator
from django.db import models


def avatar_upload_to(instance, filename):
    return f"avatars/{instance.pk}/{uuid.uuid4().hex}{Path(filename).suffix.lower()}"


phone_validator = RegexValidator(
    r"^\+?[0-9 .()-]{6,20}$", "Numéro de téléphone invalide."
)


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("L'adresse e-mail est obligatoire.")
        user = self.model(email=self.normalize_email(email), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if not extra_fields["is_staff"] or not extra_fields["is_superuser"]:
            raise ValueError("Un superutilisateur doit avoir is_staff et is_superuser à True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    username = None
    email = models.EmailField("adresse e-mail", unique=True)
    avatar = models.ImageField("photo", upload_to=avatar_upload_to, blank=True)
    job_title = models.CharField("poste recherché", max_length=120, blank=True)
    phone = models.CharField("téléphone", max_length=20, blank=True, validators=[phone_validator])
    location = models.CharField("ville", max_length=120, blank=True)
    linkedin_url = models.URLField("profil LinkedIn", max_length=300, blank=True)
    bio = models.TextField("présentation", max_length=1000, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    objects = UserManager()

    class Meta:
        verbose_name = "utilisateur"
        verbose_name_plural = "utilisateurs"
        ordering = ["email"]

    def __str__(self):
        return self.email

    @property
    def full_name(self):
        return self.get_full_name() or self.email
