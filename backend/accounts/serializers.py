from rest_framework import serializers

from .models import User

MAX_AVATAR_SIZE = 2 * 1024 * 1024


class UserSerializer(serializers.ModelSerializer):
    avatar = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "full_name", "avatar",
            "job_title", "phone", "location", "linkedin_url", "bio", "date_joined",
        ]
        read_only_fields = ["id", "email", "full_name", "date_joined"]

    def validate_avatar(self, value):
        if value and value.size > MAX_AVATAR_SIZE:
            raise serializers.ValidationError("La photo ne doit pas dépasser 2 Mo.")
        return value

    def update(self, instance, validated_data):
        old_avatar = instance.avatar.name if instance.avatar else None
        if "avatar" in validated_data and validated_data["avatar"] is None:
            validated_data["avatar"] = ""
        user = super().update(instance, validated_data)
        if old_avatar and old_avatar != user.avatar.name:
            user.avatar.storage.delete(old_avatar)
        return user
