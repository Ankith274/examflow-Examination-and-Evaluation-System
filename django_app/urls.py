"""django_app/urls.py"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/",       admin.site.urls),
    path("api/auth/",    include("django_app.apps.users.urls")),
    path("api/users/",   include("django_app.apps.users.user_urls")),
    path("api/exams/",   include("django_app.apps.exams.urls")),
    path("api/results/", include("django_app.apps.results.urls")),
    # Frontend views
    path("",             include("django_app.view_urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
