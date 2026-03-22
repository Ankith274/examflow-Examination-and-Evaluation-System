# tests/django/conftest.py
import sys, os
django_app = os.path.join(os.path.dirname(__file__), "..", "..", "django_app")
sys.path.insert(0, django_app)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "examflow.settings.test")

import django
django.setup()
