"""
django_app/examflow/apps/users/models.py
Custom User model with student/admin roles.
"""

import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user  = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", "admin")
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [("student", "Student"), ("admin", "Admin")]

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name        = models.CharField(max_length=100)
    email       = models.EmailField(unique=True, db_index=True)
    role        = models.CharField(max_length=20, choices=ROLE_CHOICES, default="student")
    roll_number = models.CharField(max_length=50, blank=True, null=True, db_index=True)
    section     = models.CharField(max_length=20, blank=True)
    year        = models.PositiveSmallIntegerField(default=1)
    is_active   = models.BooleanField(default=True)
    is_staff    = models.BooleanField(default=False)
    last_login  = models.DateTimeField(null=True, blank=True)
    created_at  = models.DateTimeField(default=timezone.now)
    updated_at  = models.DateTimeField(auto_now=True)

    USERNAME_FIELD  = "email"
    REQUIRED_FIELDS = ["name"]

    objects = UserManager()

    class Meta:
        db_table    = "users"
        ordering    = ["-created_at"]
        verbose_name = "User"

    def __str__(self):
        return f"{self.email} [{self.role}]"

    def to_dict(self):
        return {
            "id":          str(self.id),
            "name":        self.name,
            "email":       self.email,
            "role":        self.role,
            "roll_number": self.roll_number,
            "section":     self.section,
            "year":        self.year,
            "is_active":   self.is_active,
            "last_login":  self.last_login.isoformat() if self.last_login else None,
            "created_at":  self.created_at.isoformat(),
        }
