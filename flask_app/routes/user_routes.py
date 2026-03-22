"""
flask_app/routes/user_routes.py
User management: list, profile, dashboard, deactivate
"""

from flask import Blueprint, request
from flask_app.app import db
from flask_app.models.models import User, Result
from flask_app.utils.helpers import (
    success_response, error_response,
    login_required, admin_required, paginate_query
)

user_bp = Blueprint("users", __name__)


# ── GET /api/users  (admin) ───────────────────────────────────────────────────
@user_bp.get("/")
@admin_required
def list_users(current_user):
    page     = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    role     = request.args.get("role")
    search   = request.args.get("search", "").strip()

    q = User.query
    if role:   q = q.filter_by(role=role)
    if search: q = q.filter(
        User.name.ilike(f"%{search}%") |
        User.email.ilike(f"%{search}%") |
        User.roll_number.ilike(f"%{search}%")
    )
    q = q.order_by(User.created_at.desc())

    paged = paginate_query(q, page, per_page)
    return success_response({
        "users":    [u.to_dict() for u in paged["items"]],
        "total":    paged["total"],
        "page":     paged["page"],
        "pages":    paged["pages"],
    })


# ── GET /api/users/dashboard  (student) ──────────────────────────────────────
@user_bp.get("/dashboard")
@login_required
def dashboard(current_user):
    results = (Result.query
               .filter_by(student_id=current_user.id, status="submitted")
               .order_by(Result.submitted_at.desc())
               .limit(5).all())

    all_results = (Result.query
                   .filter_by(student_id=current_user.id, status="submitted")
                   .all())

    total  = len(all_results)
    passed = sum(1 for r in all_results if r.is_passed)
    avg    = round(sum(r.percentage for r in all_results) / total, 2) if total else 0

    return success_response({
        "stats": {
            "total_exams":  total,
            "total_passed": passed,
            "avg_score":    avg,
        },
        "recent_results": [r.to_dict() for r in results],
    })


# ── GET /api/users/profile  (self) ───────────────────────────────────────────
@user_bp.get("/profile")
@login_required
def get_profile(current_user):
    return success_response(data=current_user.to_dict())


# ── PUT /api/users/profile  (self) ───────────────────────────────────────────
@user_bp.put("/profile")
@login_required
def update_profile(current_user):
    data    = request.get_json(silent=True) or {}
    allowed = ["name", "section", "year"]
    for field in allowed:
        if field in data:
            setattr(current_user, field, data[field])
    db.session.commit()
    return success_response(data=current_user.to_dict(), message="Profile updated")


# ── GET /api/users/:id  (admin) ───────────────────────────────────────────────
@user_bp.get("/<user_id>")
@admin_required
def get_user(user_id, current_user):
    user = User.query.get(user_id)
    if not user:
        return error_response("User not found", 404)
    return success_response(data=user.to_dict())


# ── DELETE /api/users/:id  (admin = soft delete) ──────────────────────────────
@user_bp.delete("/<user_id>")
@admin_required
def deactivate_user(user_id, current_user):
    user = User.query.get(user_id)
    if not user:
        return error_response("User not found", 404)
    user.is_active = False
    db.session.commit()
    return success_response(message=f"User '{user.name}' deactivated")
