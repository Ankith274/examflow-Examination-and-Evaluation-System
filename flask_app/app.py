"""
ExamFlow — Flask Application
BCA 2023-2026 | KLH University
Student: Ankith Reddy | Roll: 2320520034

Entry point: flask --app flask_app/app.py run
"""

import os
from datetime import timedelta
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv

load_dotenv()

# ── Extension instances (no app bound yet) ────────────────────────────────────
db      = SQLAlchemy()
migrate = Migrate()
jwt     = JWTManager()
bcrypt  = Bcrypt()
limiter = Limiter(key_func=get_remote_address)


# ── Application factory ───────────────────────────────────────────────────────
def create_app(config_name: str = "development") -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")

    # ── Config ────────────────────────────────────────────────────────────────
    app.config.update(
        SECRET_KEY             = os.getenv("SECRET_KEY", "dev-secret"),
        SQLALCHEMY_DATABASE_URI= os.getenv("FLASK_DB_URI", "sqlite:///examflow.db"),
        SQLALCHEMY_TRACK_MODIFICATIONS = False,
        JWT_SECRET_KEY         = os.getenv("JWT_SECRET_KEY", "jwt-secret"),
        JWT_ACCESS_TOKEN_EXPIRES = timedelta(seconds=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES", 10800))),
        JWT_TOKEN_LOCATION     = ["headers", "cookies"],
        JWT_COOKIE_SECURE      = False,
        JWT_COOKIE_CSRF_PROTECT= False,
        TESTING                = config_name == "testing",
    )

    if config_name == "testing":
        app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        app.config["TESTING"] = True

    # ── Init extensions ───────────────────────────────────────────────────────
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    bcrypt.init_app(app)
    CORS(app)
    limiter.init_app(app)

    # ── Register blueprints ───────────────────────────────────────────────────
    from flask_app.routes.auth_routes   import auth_bp
    from flask_app.routes.user_routes   import user_bp
    from flask_app.routes.exam_routes   import exam_bp
    from flask_app.routes.result_routes import result_bp
    from flask_app.routes.view_routes   import view_bp

    app.register_blueprint(auth_bp,   url_prefix="/api/auth")
    app.register_blueprint(user_bp,   url_prefix="/api/users")
    app.register_blueprint(exam_bp,   url_prefix="/api/exams")
    app.register_blueprint(result_bp, url_prefix="/api/results")
    app.register_blueprint(view_bp)

    # ── JWT error handlers ────────────────────────────────────────────────────
    @jwt.unauthorized_loader
    def missing_token(reason):
        return jsonify(success=False, message=f"Missing token: {reason}"), 401

    @jwt.invalid_token_loader
    def invalid_token(reason):
        return jsonify(success=False, message=f"Invalid token: {reason}"), 401

    @jwt.expired_token_loader
    def expired_token(jwt_header, jwt_payload):
        return jsonify(success=False, message="Token expired"), 401

    # ── Global error handlers ─────────────────────────────────────────────────
    @app.errorhandler(404)
    def not_found(e):
        return jsonify(success=False, message="Resource not found"), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify(success=False, message="Method not allowed"), 405

    @app.errorhandler(500)
    def server_error(e):
        return jsonify(success=False, message="Internal server error"), 500

    # ── Health check ──────────────────────────────────────────────────────────
    @app.get("/health")
    def health():
        return jsonify(
            success=True,
            service="ExamFlow Flask API",
            university="KLH University",
            student="Ankith Reddy | 2320520034",
        )

    # ── Create tables ─────────────────────────────────────────────────────────
    with app.app_context():
        db.create_all()

    return app


# ── Run directly ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("FLASK_PORT", 5000))
    print(f"\n{'='*50}")
    print(f"  ExamFlow Flask API")
    print(f"  KLH University | BCA 2023-2026")
    print(f"  Running on http://localhost:{port}")
    print(f"{'='*50}\n")
    app.run(host="0.0.0.0", port=port, debug=True)
