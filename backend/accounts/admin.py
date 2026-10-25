from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm

from .models import User


class UserCreateForm(UserCreationForm):
    class Meta:
        model = User
        fields = ["email", "first_name", "last_name"]


class UserEditForm(UserChangeForm):
    class Meta:
        model = User
        fields = "__all__"


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    # Le UserAdmin de Django suppose un champ username : on remplace ses fieldsets.
    form = UserEditForm
    add_form = UserCreateForm
    list_display = ["email", "first_name", "last_name", "is_staff", "is_active"]
    search_fields = ["email", "first_name", "last_name"]
    ordering = ["email"]
    fieldsets = [
        (None, {"fields": ["email", "password"]}),
        ("Identité", {"fields": ["first_name", "last_name", "avatar"]}),
        ("Profil", {"fields": ["job_title", "phone", "location", "linkedin_url", "bio"]}),
        ("Permissions", {"fields": ["is_active", "is_staff", "is_superuser", "groups", "user_permissions"]}),
        ("Dates", {"fields": ["last_login", "date_joined"]}),
    ]
    add_fieldsets = [
        (None, {
            "classes": ["wide"],
            "fields": ["email", "first_name", "last_name", "password1", "password2"],
        }),
    ]
