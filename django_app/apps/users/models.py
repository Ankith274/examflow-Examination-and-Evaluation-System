"""django_app/apps/users/models.py"""
import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user  = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("role", "admin")
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    ROLES = [("student", "Student"), ("admin", "Admin")]

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name        = models.CharField(max_length=100)
    email       = models.EmailField(unique=True, db_index=True)
    role        = models.CharField(max_length=20, choices=ROLES, default="student")
    roll_number = models.CharField(max_length=50, blank=True, null=True, db_index=True)
    section     = models.CharField(max_length=20, blank=True)
    year        = models.PositiveSmallIntegerField(default=1)
    is_active   = models.BooleanField(default=True)
    is_staff    = models.BooleanField(default=False)
    last_login  = models.DateTimeField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    USERNAME_FIELD  = "email"
    REQUIRED_FIELDS = ["name"]
    objects = UserManager()

    class Meta:
        db_table  = "users"
        ordering  = ["-created_at"]

    def __str__(self):
        return f"{self.email} [{self.role}]"
