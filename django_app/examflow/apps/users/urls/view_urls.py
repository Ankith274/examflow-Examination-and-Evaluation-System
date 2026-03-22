"""django_app/examflow/apps/users/urls/view_urls.py"""
from django.urls import path
from django.shortcuts import render


def login_page(req):    return render(req, "auth/login.html",      {"title": "Login | ExamFlow"})
def register_page(req): return render(req, "auth/register.html",   {"title": "Register | ExamFlow"})
def dashboard(req):     return render(req, "student/dashboard.html",{"title": "Dashboard | ExamFlow"})
def exam_page(req, exam_id): return render(req, "student/exam.html", {"title": "Exam | ExamFlow", "exam_id": exam_id})
def result_page(req, result_id): return render(req, "student/result.html", {"title": "Result | ExamFlow", "result_id": result_id})
def admin_dash(req):    return render(req, "admin/dashboard.html",  {"title": "Admin | ExamFlow"})
def admin_exams(req):   return render(req, "admin/exams.html",      {"title": "Manage Exams | ExamFlow"})
def admin_create(req):  return render(req, "admin/exam_form.html",  {"title": "Create Exam | ExamFlow"})
def admin_users(req):   return render(req, "admin/users.html",      {"title": "Students | ExamFlow"})
def admin_results(req): return render(req, "admin/results.html",    {"title": "Results | ExamFlow"})

urlpatterns = [
    path("",                        login_page,    name="login-page"),
    path("register/",               register_page, name="register-page"),
    path("dashboard/",              dashboard,     name="dashboard-page"),
    path("exam/<str:exam_id>/",     exam_page,     name="exam-page"),
    path("result/<str:result_id>/", result_page,   name="result-page"),
    path("admin-panel/",            admin_dash,    name="admin-dash"),
    path("admin-panel/exams/",      admin_exams,   name="admin-exams"),
    path("admin-panel/exams/create/", admin_create, name="admin-create"),
    path("admin-panel/users/",      admin_users,   name="admin-users"),
    path("admin-panel/results/",    admin_results, name="admin-results"),
]
