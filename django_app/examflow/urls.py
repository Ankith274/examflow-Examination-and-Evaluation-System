"""
django_app/examflow/urls.py
Root URL configuration — routes API and page views.
"""

from django.contrib import admin
from django.urls     import path, include
from django.conf     import settings
from django.conf.urls.static import static
from django.http     import JsonResponse


def health(request):
    return JsonResponse({
        "success":    True,
        "service":    "ExamFlow Django API",
        "university": "KLH University",
        "student":    "Ankith Reddy | 2320520034",
    })


urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("health/",        health),

    # ── API routes ──────────────────────────────────────────────────────────
    path("api/auth/",    include("examflow.apps.users.urls.auth_urls")),
    path("api/users/",   include("examflow.apps.users.urls.user_urls")),
    path("api/exams/",   include("examflow.apps.exams.urls")),
    path("api/results/", include("examflow.apps.results.urls")),

    # ── HTML page routes ────────────────────────────────────────────────────
    path("", include("examflow.apps.users.urls.view_urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
