"""django_app/examflow/apps/users/urls/auth_urls.py"""
from django.urls import path
from examflow.apps.users.views import RegisterView, LoginView, MeView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/",    LoginView.as_view(),    name="login"),
    path("me/",       MeView.as_view(),       name="me"),
]
