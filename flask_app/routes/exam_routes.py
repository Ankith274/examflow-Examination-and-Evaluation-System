"""
flask_app/routes/exam_routes.py
Exam CRUD, publish, start, submit, leaderboard
"""

from datetime import datetime, timezone
from flask import Blueprint, request
from flask_app.app import db
from flask_app.models.models import Exam, Question, Result, Answer
from flask_app.utils.helpers import (
    success_response, error_response,
    login_required, admin_required, student_required
)
from flask_app.services.evaluation_service import evaluate_submission

exam_bp = Blueprint("exams", __name__)


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── GET /api/exams ────────────────────────────────────────────────────────────
@exam_bp.get("/")
@login_required
def list_exams(current_user):
    if current_user.role == "admin":
        exams = Exam.query.filter_by(is_active=True).order_by(Exam.start_time.desc()).all()
    else:
        exams = (Exam.query
                 .filter_by(is_published=True, is_active=True)
                 .order_by(Exam.start_time.desc()).all())
    return success_response(data=[e.to_dict() for e in exams])


# ── GET /api/exams/:id ────────────────────────────────────────────────────────
@exam_bp.get("/<exam_id>")
@login_required
def get_exam(exam_id, current_user):
    exam = Exam.query.get(exam_id)
    if not exam or not exam.is_active:
        return error_response("Exam not found", 404)

    include_correct = current_user.role == "admin"
    exam_dict = exam.to_dict()
    exam_dict["questions"] = [q.to_dict(include_correct=include_correct) for q in exam.questions]
    return success_response(data=exam_dict)


# ── POST /api/exams  (admin) ──────────────────────────────────────────────────
@exam_bp.post("/")
@admin_required
def create_exam(current_user):
    data = request.get_json(silent=True) or {}

    required = ["title", "subject", "duration", "total_marks", "passing_marks", "start_time", "end_time"]
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return error_response(f"Missing fields: {', '.join(missing)}", 422)

    try:
        start = datetime.fromisoformat(data["start_time"].replace("Z", ""))
        end   = datetime.fromisoformat(data["end_time"].replace("Z", ""))
    except ValueError:
        return error_response("Invalid date format. Use ISO 8601.", 422)

    if end <= start:
        return error_response("end_time must be after start_time", 422)

    exam = Exam(
        title            = data["title"].strip(),
        subject          = data["subject"].strip(),
        description      = data.get("description", ""),
        duration         = int(data["duration"]),
        total_marks      = int(data["total_marks"]),
        passing_marks    = int(data["passing_marks"]),
        start_time       = start,
        end_time         = end,
        instructions     = data.get("instructions", ""),
        is_published     = bool(data.get("is_published", False)),
        negative_marking = bool(data.get("negative_marking", False)),
        negative_value   = float(data.get("negative_value", 0)),
        shuffle_questions= bool(data.get("shuffle_questions", False)),
        creator_id       = current_user.id,
    )
    db.session.add(exam)
    db.session.flush()  # get exam.id before questions

    # Bulk-insert questions if provided
    for i, qd in enumerate(data.get("questions", [])):
        opts = qd.get("options", [])
        q = Question(
            exam_id     = exam.id,
            text        = qd.get("text", "").strip(),
            q_type      = qd.get("q_type", "mcq"),
            option_a    = opts[0] if len(opts) > 0 else None,
            option_b    = opts[1] if len(opts) > 1 else None,
            option_c    = opts[2] if len(opts) > 2 else None,
            option_d    = opts[3] if len(opts) > 3 else None,
            correct     = int(qd.get("correct", 0)),
            marks       = int(qd.get("marks", 1)),
            order       = qd.get("order", i),
            explanation = qd.get("explanation", ""),
        )
        db.session.add(q)

    db.session.commit()
    return success_response(data=exam.to_dict(include_questions=True), status=201, message="Exam created")


# ── PUT /api/exams/:id  (admin) ───────────────────────────────────────────────
@exam_bp.put("/<exam_id>")
@admin_required
def update_exam(exam_id, current_user):
    exam = Exam.query.get(exam_id)
    if not exam:
        return error_response("Exam not found", 404)

    data = request.get_json(silent=True) or {}
    allowed = ["title", "subject", "description", "duration", "total_marks",
               "passing_marks", "instructions", "is_published",
               "negative_marking", "negative_value", "shuffle_questions"]

    for field in allowed:
        if field in data:
            setattr(exam, field, data[field])

    if "start_time" in data:
        exam.start_time = datetime.fromisoformat(data["start_time"].replace("Z", ""))
    if "end_time" in data:
        exam.end_time = datetime.fromisoformat(data["end_time"].replace("Z", ""))

    # Replace questions if provided
    if "questions" in data:
        Question.query.filter_by(exam_id=exam.id).delete()
        for i, qd in enumerate(data["questions"]):
            opts = qd.get("options", [])
            q = Question(
                exam_id     = exam.id,
                text        = qd.get("text", "").strip(),
                option_a    = opts[0] if len(opts) > 0 else None,
                option_b    = opts[1] if len(opts) > 1 else None,
                option_c    = opts[2] if len(opts) > 2 else None,
                option_d    = opts[3] if len(opts) > 3 else None,
                correct     = int(qd.get("correct", 0)),
                marks       = int(qd.get("marks", 1)),
                order       = qd.get("order", i),
                explanation = qd.get("explanation", ""),
            )
            db.session.add(q)

    db.session.commit()
    return success_response(data=exam.to_dict(), message="Exam updated")


# ── DELETE /api/exams/:id  (admin — soft delete) ──────────────────────────────
@exam_bp.delete("/<exam_id>")
@admin_required
def delete_exam(exam_id, current_user):
    exam = Exam.query.get(exam_id)
    if not exam:
        return error_response("Exam not found", 404)
    exam.is_active = False
    db.session.commit()
    return success_response(message="Exam deleted")


# ── POST /api/exams/:id/publish  (admin) ──────────────────────────────────────
@exam_bp.post("/<exam_id>/publish")
@admin_required
def publish_exam(exam_id, current_user):
    exam = Exam.query.get(exam_id)
    if not exam:
        return error_response("Exam not found", 404)
    exam.is_published = True
    db.session.commit()
    return success_response(data=exam.to_dict(), message="Exam published")


# ── POST /api/exams/:id/start  (student) ──────────────────────────────────────
@exam_bp.post("/<exam_id>/start")
@student_required
def start_exam(exam_id, current_user):
    exam = Exam.query.get(exam_id)
    if not exam or not exam.is_published or not exam.is_active:
        return error_response("Exam not available", 404)

    now = utcnow()
    if now < exam.start_time:
        return error_response("Exam has not started yet", 400)
    if now > exam.end_time:
        return error_response("Exam has ended", 400)

    # Resume existing in-progress attempt
    existing = (Result.query
                .filter_by(exam_id=exam.id, student_id=current_user.id, status="in_progress")
                .first())
    if existing:
        return success_response(data=existing.to_dict(), message="Resuming exam")

    result = Result(
        exam_id    = exam.id,
        student_id = current_user.id,
        total_marks= exam.total_marks,
        started_at = now,
    )
    db.session.add(result)
    db.session.commit()
    return success_response(data=result.to_dict(), status=201, message="Exam started")


# ── POST /api/exams/:id/submit  (student) ─────────────────────────────────────
@exam_bp.post("/<exam_id>/submit")
@student_required
def submit_exam(exam_id, current_user):
    exam = Exam.query.get(exam_id)
    if not exam:
        return error_response("Exam not found", 404)

    result = (Result.query
              .filter_by(exam_id=exam.id, student_id=current_user.id, status="in_progress")
              .first())
    if not result:
        return error_response("No active attempt found", 400)

    data       = request.get_json(silent=True) or {}
    submitted  = data.get("answers", [])
    violations = int(data.get("violations", 0))

    result.violations = violations
    questions = Question.query.filter_by(exam_id=exam.id).order_by(Question.order).all()

    evaluate_submission(result, exam, questions, submitted)
    return success_response(data=result.to_dict(), message="Exam submitted")


# ── GET /api/exams/:id/leaderboard ────────────────────────────────────────────
@exam_bp.get("/<exam_id>/leaderboard")
@login_required
def leaderboard(exam_id, current_user):
    results = (Result.query
               .filter_by(exam_id=exam_id, status="submitted")
               .order_by(Result.score.desc(), Result.time_taken.asc())
               .limit(20).all())

    board = []
    for rank, r in enumerate(results, 1):
        entry = r.to_dict()
        entry["rank"]         = rank
        entry["student_name"] = r.student.name        if r.student else "—"
        entry["roll_number"]  = r.student.roll_number if r.student else "—"
        board.append(entry)

    return success_response(data=board)
