"""django_app/examflow/apps/exams/apps.py"""
from django.apps import AppConfig


class ExamsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name  = "examflow.apps.exams"
    label = "exams"
