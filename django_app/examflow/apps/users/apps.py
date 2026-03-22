"""django_app/examflow/apps/users/apps.py"""
from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name  = "examflow.apps.users"
    label = "users"
