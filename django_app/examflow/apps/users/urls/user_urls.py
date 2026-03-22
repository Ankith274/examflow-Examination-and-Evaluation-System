"""django_app/examflow/apps/users/urls/user_urls.py"""
from django.urls import path
from examflow.apps.users.views import (
    UserListView, UserDetailView, ProfileView, DashboardView
)

urlpatterns = [
    path("",              UserListView.as_view(),    name="user-list"),
    path("dashboard/",    DashboardView.as_view(),   name="dashboard"),
    path("profile/",      ProfileView.as_view(),     name="profile"),
    path("<uuid:user_id>/", UserDetailView.as_view(), name="user-detail"),
]
