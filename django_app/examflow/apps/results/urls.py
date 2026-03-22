"""django_app/examflow/apps/results/urls.py"""
from django.urls import path
from .views import ResultListView, ResultDetailView, ExamResultsView, AnalyticsView

urlpatterns = [
    path("",                       ResultListView.as_view(),   name="result-list"),
    path("analytics/",             AnalyticsView.as_view(),    name="analytics"),
    path("exam/<uuid:exam_id>/",   ExamResultsView.as_view(),  name="exam-results"),
    path("<uuid:result_id>/",      ResultDetailView.as_view(), name="result-detail"),
]
