"""
flask_app/services/evaluation_service.py
Core grading and evaluation logic.
"""

from datetime import datetime, timezone
from flask_app.models.models import db, Answer, Result
from flask_app.utils.helpers import compute_grade


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def evaluate_submission(result: Result, exam, questions: list, submitted_answers: list) -> Result:
    """
    Grade a submitted exam.

    Args:
        result:             The in-progress Result row.
        exam:               The Exam row.
        questions:          List of Question rows (ordered).
        submitted_answers:  List of dicts: [{question_id, selected, time_taken}, ...]

    Returns:
        Updated Result with score, grade, answers persisted.
    """
    q_map = {q.id: q for q in questions}
    score = 0.0

    # Delete any prior answers (re-submission guard)
    Answer.query.filter_by(result_id=result.id).delete()

    for sa in submitted_answers:
        q = q_map.get(sa.get("question_id"))
        if not q:
            continue

        selected   = sa.get("selected", -1)
        is_skipped = selected == -1

        if is_skipped:
            is_correct   = False
            marks_gained = 0.0
        else:
            is_correct   = int(selected) == int(q.correct)
            if is_correct:
                marks_gained = float(q.marks)
            elif exam.negative_marking:
                marks_gained = -float(exam.negative_value)
            else:
                marks_gained = 0.0

        score += marks_gained

        answer = Answer(
            result_id   = result.id,
            question_id = q.id,
            selected    = selected,
            is_correct  = is_correct,
            marks_gained= marks_gained,
            time_taken  = sa.get("time_taken", 0),
        )
        db.session.add(answer)

    score      = max(0.0, score)
    percentage = round((score / exam.total_marks) * 100, 2) if exam.total_marks else 0
    is_passed  = score >= exam.passing_marks

    result.score        = score
    result.total_marks  = exam.total_marks
    result.percentage   = percentage
    result.is_passed    = is_passed
    result.grade        = compute_grade(percentage)
    result.submitted_at = utcnow()
    result.time_taken   = int((result.submitted_at - result.started_at).total_seconds())
    result.status       = "submitted"
    result.violations   = result.violations or 0

    db.session.commit()
    return result


def get_result_stats(results: list) -> dict:
    """Aggregate statistics from a list of Result objects."""
    if not results:
        return {"total": 0, "passed": 0, "failed": 0, "avg_score": 0,
                "avg_percentage": 0, "pass_rate": 0, "highest": 0, "lowest": 0}

    scores = [r.percentage for r in results]
    passed = sum(1 for r in results if r.is_passed)
    return {
        "total":          len(results),
        "passed":         passed,
        "failed":         len(results) - passed,
        "avg_score":      round(sum(r.score for r in results) / len(results), 2),
        "avg_percentage": round(sum(scores) / len(scores), 2),
        "pass_rate":      round((passed / len(results)) * 100, 2),
        "highest":        max(scores),
        "lowest":         min(scores),
    }
