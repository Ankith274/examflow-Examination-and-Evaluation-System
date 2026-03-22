#!/usr/bin/env python
"""
Django management utility for ExamFlow.
BCA 2023-2026 | KLH University
Student: Ankith Reddy | Roll: 2320520034

Usage:
  python django_app/manage.py runserver 8000
  python django_app/manage.py migrate
  python django_app/manage.py createsuperuser
"""
import os
import sys


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "examflow.settings.base")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Could not import Django. Ensure it is installed and available "
            "on your PYTHONPATH environment variable."
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
