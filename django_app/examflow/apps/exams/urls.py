"""django_app/examflow/apps/exams/urls.py"""
from django.urls import path
from .views import (
    ExamListCreateView, ExamDetailView,
    PublishExamView, StartExamView, SubmitExamView, LeaderboardView,
)

urlpatterns = [
    path("",                          ExamListCreateView.as_view(), name="exam-list-create"),
    path("<uuid:exam_id>/",           ExamDetailView.as_view(),     name="exam-detail"),
    path("<uuid:exam_id>/publish/",   PublishExamView.as_view(),    name="exam-publish"),
    path("<uuid:exam_id>/start/",     StartExamView.as_view(),      name="exam-start"),
    path("<uuid:exam_id>/submit/",    SubmitExamView.as_view(),     name="exam-submit"),
    path("<uuid:exam_id>/leaderboard/", LeaderboardView.as_view(),  name="exam-leaderboard"),
]
