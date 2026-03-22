"""django_app/examflow/apps/results/apps.py"""
from django.apps import AppConfig


class ResultsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name  = "examflow.apps.results"
    label = "results"
