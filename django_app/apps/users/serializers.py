"""django_app/apps/users/serializers.py"""
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from django_app.apps.users.models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = ["id","name","email","role","roll_number","section","year","is_active","last_login","created_at"]
        read_only_fields = ["id","created_at","last_login"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model  = User
        fields = ["name","email","password","role","roll_number","section","year"]

    def validate_email(self, value):
        if User.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError("Email already registered")
        return value.lower()

    def validate_role(self, value):
        if value not in ("student","admin"):
            raise serializers.ValidationError("Role must be student or admin")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        user     = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    email    = serializers.EmailField()
    password = serializers.CharField()


class TokenResponseSerializer(serializers.Serializer):
    """Used only for documentation shape."""
    access_token = serializers.CharField()
    user         = UserSerializer()


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        "access_token":  str(refresh.access_token),
        "refresh_token": str(refresh),
    }
