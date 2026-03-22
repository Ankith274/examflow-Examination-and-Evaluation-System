"""
django_app/examflow/apps/users/serializers.py
DRF serializers for User registration, login, profile.
"""

from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = ["id", "name", "email", "role", "roll_number",
                  "section", "year", "is_active", "last_login", "created_at"]
        read_only_fields = ["id", "last_login", "created_at"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model  = User
        fields = ["name", "email", "password", "role",
                  "roll_number", "section", "year"]

    def validate_role(self, value):
        if value not in ("student", "admin"):
            raise serializers.ValidationError("Role must be student or admin")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError("Email already registered")
        return value.lower()

    def create(self, validated_data):
        password = validated_data.pop("password")
        user     = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    email    = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        from django.contrib.auth import authenticate
        user = authenticate(email=data["email"].lower(), password=data["password"])
        if not user:
            raise serializers.ValidationError("Invalid email or password")
        if not user.is_active:
            raise serializers.ValidationError("Account deactivated")
        data["user"] = user
        return data


class TokenResponseSerializer(serializers.Serializer):
    """Helper to build token + user response."""

    @staticmethod
    def get_tokens(user):
        refresh = RefreshToken.for_user(user)
        return {
            "access_token":  str(refresh.access_token),
            "refresh_token": str(refresh),
            "user":          UserSerializer(user).data,
        }


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = ["name", "section", "year"]
