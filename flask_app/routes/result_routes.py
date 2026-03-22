"""
flask_app/routes/result_routes.py
Results: list, detail, per-exam, analytics
"""

from flask import Blueprint, request
from flask_app.models.models import Result, Exam
from flask_app.utils.helpers import (
    success_response, error_response,
    login_required, admin_required
)
from flask_app.services.evaluation_service import get_result_stats

result_bp = Blueprint("results", __name__)


# ── GET /api/results ──────────────────────────────────────────────────────────
@result_bp.get("/")
@login_required
def list_results(current_user):
    if current_user.role == "admin":
        results = (Result.query
                   .filter_by(status="submitted")
                   .order_by(Result.submitted_at.desc()).all())
    else:
        results = (Result.query
                   .filter_by(student_id=current_user.id, status="submitted")
                   .order_by(Result.submitted_at.desc()).all())

    data = []
    for r in results:
        rd = r.to_dict()
        rd["exam_title"]   = r.exam.title   if r.exam else "—"
        rd["exam_subject"] = r.exam.subject if r.exam else "—"
        rd["student_name"] = r.student.name if r.student else "—"
        rd["roll_number"]  = r.student.roll_number if r.student else "—"
        data.append(rd)

    return success_response(data=data)


# ── GET /api/results/analytics  (admin) ──────────────────────────────────────
@result_bp.get("/analytics")
@admin_required
def analytics(current_user):
    all_results = Result.query.filter_by(status="submitted").all()
    overall     = get_result_stats(all_results)

    # Per-exam breakdown
    exams = Exam.query.filter_by(is_active=True).all()
    per_exam = []
    for exam in exams:
        exam_results = [r for r in all_results if r.exam_id == exam.id]
        if not exam_results:
            continue
        stats = get_result_stats(exam_results)
        per_exam.append({
            "exam_id":      exam.id,
            "exam_title":   exam.title,
            "exam_subject": exam.subject,
            **stats,
        })

    per_exam.sort(key=lambda x: x["total"], reverse=True)

    return success_response(data={
        "overall":  overall,
        "per_exam": per_exam,
    })


# ── GET /api/results/exam/:exam_id  (admin) ───────────────────────────────────
@result_bp.get("/exam/<exam_id>")
@admin_required
def exam_results(exam_id, current_user):
    results = (Result.query
               .filter_by(exam_id=exam_id, status="submitted")
               .order_by(Result.score.desc()).all())

    data = []
    for r in results:
        rd = r.to_dict()
        rd["student_name"] = r.student.name        if r.student else "—"
        rd["roll_number"]  = r.student.roll_number if r.student else "—"
        data.append(rd)

    return success_response(data={
        "results": data,
        "stats":   get_result_stats(results),
    })


# ── GET /api/results/:id ──────────────────────────────────────────────────────
@result_bp.get("/<result_id>")
@login_required
def get_result(result_id, current_user):
    result = Result.query.get(result_id)
    if not result:
        return error_response("Result not found", 404)

    # Students can only see own results
    if current_user.role == "student" and result.student_id != current_user.id:
        return error_response("Forbidden", 403)

    rd = result.to_dict(include_answers=True)
    # Enrich answers with question data
    for a in rd["answers"]:
        ans_obj = next((x for x in result.answers if x.id == a["id"]), None)
        if ans_obj and ans_obj.question:
            a["question"] = ans_obj.question.to_dict(include_correct=True)

    if result.exam:
        rd["exam_title"]   = result.exam.title
        rd["exam_subject"] = result.exam.subject
        rd["total_marks"]  = result.exam.total_marks
    if result.student:
        rd["student_name"] = result.student.name
        rd["roll_number"]  = result.student.roll_number

    return success_response(data=rd)
