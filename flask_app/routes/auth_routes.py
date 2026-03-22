"""
flask_app/routes/auth_routes.py
Authentication: register, login, logout, me
"""

from datetime import datetime, timezone
from flask import Blueprint, request
from flask_jwt_extended import (
    create_access_token, set_access_cookies,
    unset_jwt_cookies, get_jwt_identity
)
from flask_app.app import db
from flask_app.models.models import User
from flask_app.utils.helpers import (
    success_response, error_response, login_required
)

auth_bp = Blueprint("auth", __name__)


# ── POST /api/auth/register ───────────────────────────────────────────────────
@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}

    name     = (data.get("name") or "").strip()
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role     = data.get("role", "student")

    # Validate
    errors = {}
    if not name:            errors["name"]     = "Name is required"
    if not email:           errors["email"]    = "Email is required"
    if len(password) < 6:  errors["password"] = "Password must be at least 6 characters"
    if role not in ("student", "admin"):
        errors["role"] = "Role must be student or admin"
    if errors:
        return error_response("Validation failed", 422, errors)

    # Duplicate check
    if User.query.filter_by(email=email).first():
        return error_response("Email already registered", 409)

    user = User(
        name        = name,
        email       = email,
        role        = role,
        roll_number = data.get("roll_number", ""),
        section     = data.get("section", ""),
        year        = int(data.get("year", 1)),
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=user.id)
    resp  = success_response(
        data    = {"access_token": token, "user": user.to_dict()},
        message = "Registration successful",
        status  = 201,
    )
    set_access_cookies(resp[0], token)
    return resp


# ── POST /api/auth/login ──────────────────────────────────────────────────────
@auth_bp.post("/login")
def login():
    data     = request.get_json(silent=True) or {}
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return error_response("Email and password required", 400)

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return error_response("Invalid email or password", 401)
    if not user.is_active:
        return error_response("Account deactivated", 403)

    user.last_login = datetime.now(timezone.utc).replace(tzinfo=None)
    db.session.commit()

    token = create_access_token(identity=user.id)
    resp  = success_response(
        data    = {"access_token": token, "user": user.to_dict()},
        message = "Login successful",
    )
    set_access_cookies(resp[0], token)
    return resp


# ── POST /api/auth/logout ─────────────────────────────────────────────────────
@auth_bp.post("/logout")
def logout():
    resp = success_response(message="Logged out")
    unset_jwt_cookies(resp[0])
    return resp


# ── GET /api/auth/me ──────────────────────────────────────────────────────────
@auth_bp.get("/me")
@login_required
def me(current_user):
    return success_response(data=current_user.to_dict())
