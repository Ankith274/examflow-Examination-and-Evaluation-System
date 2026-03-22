"""
flask_app/utils/helpers.py
Shared utilities, response helpers, and decorators.
"""

from functools import wraps
from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from flask_app.models.models import User


# ── Standard JSON responses ───────────────────────────────────────────────────
def success_response(data=None, message="success", status=200):
    body = {"success": True, "message": message}
    if data is not None:
        body["data"] = data
    return jsonify(body), status


def error_response(message="Error", status=400, errors=None):
    body = {"success": False, "message": message}
    if errors:
        body["errors"] = errors
    return jsonify(body), status


# ── Auth decorators ───────────────────────────────────────────────────────────
def login_required(fn):
    """Require valid JWT. Attaches current_user to kwargs."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = User.query.get(user_id)
            if not user or not user.is_active:
                return error_response("User not found or deactivated", 401)
            kwargs["current_user"] = user
            return fn(*args, **kwargs)
        except Exception as e:
            return error_response(str(e), 401)
    return wrapper


def admin_required(fn):
    """Require valid JWT + admin role."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = User.query.get(user_id)
            if not user or not user.is_active:
                return error_response("User not found", 401)
            if user.role != "admin":
                return error_response("Admin access required", 403)
            kwargs["current_user"] = user
            return fn(*args, **kwargs)
        except Exception as e:
            return error_response(str(e), 401)
    return wrapper


def student_required(fn):
    """Require valid JWT + student role."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = User.query.get(user_id)
            if not user or not user.is_active:
                return error_response("User not found", 401)
            if user.role != "student":
                return error_response("Student access required", 403)
            kwargs["current_user"] = user
            return fn(*args, **kwargs)
        except Exception as e:
            return error_response(str(e), 401)
    return wrapper


# ── Validation helpers ────────────────────────────────────────────────────────
def require_json(*fields):
    """Decorator: ensure JSON body contains all required fields."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            data = request.get_json(silent=True) or {}
            missing = [f for f in fields if not data.get(f)]
            if missing:
                return error_response(
                    f"Missing required fields: {', '.join(missing)}", 422
                )
            return fn(*args, **kwargs)
        return wrapper
    return decorator


# ── Grade calculator ──────────────────────────────────────────────────────────
def compute_grade(percentage: float) -> str:
    if percentage >= 90: return "O"
    if percentage >= 80: return "A+"
    if percentage >= 70: return "A"
    if percentage >= 60: return "B+"
    if percentage >= 50: return "B"
    if percentage >= 40: return "C"
    return "F"


# ── Pagination ────────────────────────────────────────────────────────────────
def paginate_query(query, page=1, per_page=20):
    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return {
        "items":    items,
        "total":    total,
        "page":     page,
        "per_page": per_page,
        "pages":    -(-total // per_page),  # ceiling division
    }
