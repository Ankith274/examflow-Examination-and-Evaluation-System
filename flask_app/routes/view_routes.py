"""
flask_app/routes/view_routes.py
EJS/Jinja2 HTML page routes.
"""

from flask import Blueprint, render_template

view_bp = Blueprint("views", __name__)

# ── Student pages ─────────────────────────────────────────────────────────────
@view_bp.get("/")
def login_page():
    return render_template("auth/login.html", title="Login | ExamFlow")

@view_bp.get("/register")
def register_page():
    return render_template("auth/register.html", title="Register | ExamFlow")

@view_bp.get("/dashboard")
def dashboard_page():
    return render_template("student/dashboard.html", title="Dashboard | ExamFlow")

@view_bp.get("/exam/<exam_id>")
def exam_page(exam_id):
    return render_template("student/exam.html", title="Exam | ExamFlow", exam_id=exam_id)

@view_bp.get("/result/<result_id>")
def result_page(result_id):
    return render_template("student/result.html", title="Result | ExamFlow", result_id=result_id)

# ── Admin pages ───────────────────────────────────────────────────────────────
@view_bp.get("/admin")
def admin_dashboard():
    return render_template("admin/dashboard.html", title="Admin | ExamFlow")

@view_bp.get("/admin/exams")
def admin_exams():
    return render_template("admin/exams.html", title="Manage Exams | ExamFlow")

@view_bp.get("/admin/exams/create")
def admin_exam_create():
    return render_template("admin/exam_form.html", title="Create Exam | ExamFlow")

@view_bp.get("/admin/users")
def admin_users():
    return render_template("admin/users.html", title="Students | ExamFlow")

@view_bp.get("/admin/results")
def admin_results():
    return render_template("admin/results.html", title="Results | ExamFlow")
