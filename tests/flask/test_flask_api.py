"""
tests/flask/test_flask_api.py
Full pytest test suite for the Flask ExamFlow API.

Run:
    cd examflow-python
    pytest tests/flask/ -v
"""

import json
import pytest
from datetime import datetime, timedelta, timezone

from flask_app.app    import create_app, db
from flask_app.models.models import User, Exam, Question, Result


# ── Fixtures ──────────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def app():
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()


@pytest.fixture(scope="session")
def client(app):
    return app.test_client()


@pytest.fixture(scope="session")
def admin_token(client):
    """Register admin and return Bearer token."""
    res = client.post("/api/auth/register", json={
        "name": "Admin User", "email": "admin@klh.edu.in",
        "password": "admin123", "role": "admin",
    })
    assert res.status_code == 201
    return res.get_json()["data"]["access_token"]


@pytest.fixture(scope="session")
def student_token(client):
    """Register student and return Bearer token."""
    res = client.post("/api/auth/register", json={
        "name": "Ankith Reddy", "email": "ankith@klh.edu.in",
        "password": "student123", "role": "student",
        "roll_number": "2320520034", "section": "BCA-A", "year": 2,
    })
    assert res.status_code == 201
    return res.get_json()["data"]["access_token"]


@pytest.fixture(scope="session")
def active_exam_id(client, admin_token):
    """Create and publish a currently-active exam, return its id."""
    now   = datetime.now(timezone.utc)
    start = (now - timedelta(hours=1)).isoformat()
    end   = (now + timedelta(hours=2)).isoformat()

    res = client.post("/api/exams/", json={
        "title":        "Flask Test Exam",
        "subject":      "Testing",
        "duration":     60,
        "total_marks":  10,
        "passing_marks": 4,
        "start_time":   start,
        "end_time":     end,
        "is_published": True,
        "questions": [
            {"text": "Q1", "options": ["A","B","C","D"], "correct": 0, "marks": 5},
            {"text": "Q2", "options": ["A","B","C","D"], "correct": 1, "marks": 5},
        ],
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 201
    return res.get_json()["data"]["id"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ══════════════════════════════════════════════════════════════════════════════
#  AUTH TESTS
# ══════════════════════════════════════════════════════════════════════════════
class TestAuth:
    def test_register_success(self, client):
        res = client.post("/api/auth/register", json={
            "name": "New Student", "email": "new@klh.edu.in",
            "password": "pass123", "role": "student",
        })
        assert res.status_code == 201
        data = res.get_json()
        assert data["success"] is True
        assert "access_token" in data["data"]
        assert "password" not in data["data"]["user"]

    def test_register_duplicate_email(self, client):
        payload = {"name": "Dup", "email": "dup@klh.edu.in", "password": "pass123"}
        client.post("/api/auth/register", json=payload)
        res = client.post("/api/auth/register", json=payload)
        assert res.status_code == 409

    def test_register_short_password(self, client):
        res = client.post("/api/auth/register", json={
            "name": "X", "email": "x@klh.edu.in", "password": "12",
        })
        assert res.status_code == 422

    def test_register_invalid_role(self, client):
        res = client.post("/api/auth/register", json={
            "name": "X", "email": "xrole@klh.edu.in",
            "password": "pass123", "role": "superuser",
        })
        assert res.status_code == 422

    def test_login_success(self, client):
        res = client.post("/api/auth/login", json={
            "email": "admin@klh.edu.in", "password": "admin123",
        })
        assert res.status_code == 200
        assert res.get_json()["data"]["access_token"]

    def test_login_wrong_password(self, client):
        res = client.post("/api/auth/login", json={
            "email": "admin@klh.edu.in", "password": "wrongpass",
        })
        assert res.status_code == 401

    def test_login_unknown_email(self, client):
        res = client.post("/api/auth/login", json={
            "email": "nobody@klh.edu.in", "password": "pass123",
        })
        assert res.status_code == 401

    def test_me_with_token(self, client, admin_token):
        res = client.get("/api/auth/me", headers=auth(admin_token))
        assert res.status_code == 200
        assert res.get_json()["data"]["email"] == "admin@klh.edu.in"

    def test_me_without_token(self, client):
        res = client.get("/api/auth/me")
        assert res.status_code == 401

    def test_logout(self, client):
        res = client.post("/api/auth/logout")
        assert res.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
#  USER TESTS
# ══════════════════════════════════════════════════════════════════════════════
class TestUsers:
    def test_list_users_as_admin(self, client, admin_token):
        res = client.get("/api/users/", headers=auth(admin_token))
        assert res.status_code == 200
        assert isinstance(res.get_json()["data"]["users"], list)

    def test_list_users_as_student_forbidden(self, client, student_token):
        res = client.get("/api/users/", headers=auth(student_token))
        assert res.status_code == 403

    def test_dashboard(self, client, student_token):
        res = client.get("/api/users/dashboard", headers=auth(student_token))
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert "stats" in data
        assert "recent_results" in data

    def test_update_profile(self, client, student_token):
        res = client.put("/api/users/profile",
                         json={"name": "Ankith R Updated", "section": "BCA-B"},
                         headers=auth(student_token))
        assert res.status_code == 200
        assert res.get_json()["data"]["section"] == "BCA-B"


# ══════════════════════════════════════════════════════════════════════════════
#  EXAM TESTS
# ══════════════════════════════════════════════════════════════════════════════
class TestExams:
    def test_create_exam_as_admin(self, client, admin_token):
        now = datetime.now(timezone.utc)
        res = client.post("/api/exams/", json={
            "title": "Unique Exam", "subject": "Math",
            "duration": 30, "total_marks": 20, "passing_marks": 8,
            "start_time": (now + timedelta(hours=1)).isoformat(),
            "end_time":   (now + timedelta(hours=3)).isoformat(),
            "questions": [
                {"text": "1+1=?", "options": ["1","2","3","4"], "correct": 1, "marks": 10},
            ],
        }, headers=auth(admin_token))
        assert res.status_code == 201
        assert res.get_json()["data"]["title"] == "Unique Exam"

    def test_create_exam_student_forbidden(self, client, student_token):
        now = datetime.now(timezone.utc)
        res = client.post("/api/exams/", json={
            "title": "X", "subject": "Y",
            "duration": 10, "total_marks": 10, "passing_marks": 5,
            "start_time": (now + timedelta(hours=1)).isoformat(),
            "end_time":   (now + timedelta(hours=2)).isoformat(),
        }, headers=auth(student_token))
        assert res.status_code == 403

    def test_create_exam_missing_fields(self, client, admin_token):
        res = client.post("/api/exams/", json={"title": "Incomplete"},
                          headers=auth(admin_token))
        assert res.status_code == 422

    def test_list_exams(self, client, student_token):
        res = client.get("/api/exams/", headers=auth(student_token))
        assert res.status_code == 200
        assert isinstance(res.get_json()["data"], list)

    def test_get_exam_no_correct_for_student(self, client, student_token, active_exam_id):
        res = client.get(f"/api/exams/{active_exam_id}", headers=auth(student_token))
        assert res.status_code == 200
        qs = res.get_json()["data"]["questions"]
        for q in qs:
            assert "correct" not in q

    def test_get_exam_correct_for_admin(self, client, admin_token, active_exam_id):
        res = client.get(f"/api/exams/{active_exam_id}", headers=auth(admin_token))
        assert res.status_code == 200
        qs = res.get_json()["data"]["questions"]
        for q in qs:
            assert "correct" in q

    def test_publish_exam(self, client, admin_token):
        now = datetime.now(timezone.utc)
        create_res = client.post("/api/exams/", json={
            "title": "To Publish", "subject": "CS",
            "duration": 45, "total_marks": 50, "passing_marks": 20,
            "start_time": (now + timedelta(hours=1)).isoformat(),
            "end_time":   (now + timedelta(hours=3)).isoformat(),
        }, headers=auth(admin_token))
        eid = create_res.get_json()["data"]["id"]
        res = client.post(f"/api/exams/{eid}/publish", headers=auth(admin_token))
        assert res.status_code == 200
        assert res.get_json()["data"]["is_published"] is True

    def test_exam_not_found(self, client, student_token):
        res = client.get("/api/exams/nonexistent-id", headers=auth(student_token))
        assert res.status_code == 404

    def test_update_exam(self, client, admin_token, active_exam_id):
        res = client.put(f"/api/exams/{active_exam_id}",
                         json={"title": "Flask Test Exam (Updated)"},
                         headers=auth(admin_token))
        assert res.status_code == 200
        assert "Updated" in res.get_json()["data"]["title"]

    def test_delete_exam(self, client, admin_token):
        now = datetime.now(timezone.utc)
        create_res = client.post("/api/exams/", json={
            "title": "To Delete", "subject": "Bio",
            "duration": 20, "total_marks": 20, "passing_marks": 8,
            "start_time": (now + timedelta(hours=1)).isoformat(),
            "end_time":   (now + timedelta(hours=2)).isoformat(),
        }, headers=auth(admin_token))
        eid = create_res.get_json()["data"]["id"]
        res = client.delete(f"/api/exams/{eid}", headers=auth(admin_token))
        assert res.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
#  EXAM FLOW TESTS (start → submit → result)
# ══════════════════════════════════════════════════════════════════════════════
class TestExamFlow:
    @pytest.fixture(autouse=True)
    def start_result(self, client, student_token, active_exam_id):
        """Start exam before each test in this class."""
        client.post(f"/api/exams/{active_exam_id}/start",
                    headers=auth(student_token))

    def test_start_exam(self, client, student_token, active_exam_id):
        res = client.post(f"/api/exams/{active_exam_id}/start",
                          headers=auth(student_token))
        assert res.status_code in (200, 201)
        assert res.get_json()["data"]["status"] in ("in_progress",)

    def test_submit_exam_and_score(self, client, student_token, active_exam_id, app):
        with app.app_context():
            qs = Question.query.filter_by(exam_id=active_exam_id).all()
            answers = [{"question_id": q.id, "selected": q.correct, "time_taken": 10}
                       for q in qs]

        res = client.post(f"/api/exams/{active_exam_id}/submit",
                          json={"answers": answers, "violations": 0},
                          headers=auth(student_token))
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert data["status"]    == "submitted"
        assert data["score"]     == 10   # all correct
        assert data["is_passed"] is True

    def test_submit_all_wrong(self, client, student_token, active_exam_id, app):
        with app.app_context():
            qs = Question.query.filter_by(exam_id=active_exam_id).all()
            # Pick wrong answer for every question
            answers = [{"question_id": q.id, "selected": (q.correct + 1) % 4}
                       for q in qs]

        res = client.post(f"/api/exams/{active_exam_id}/submit",
                          json={"answers": answers, "violations": 2},
                          headers=auth(student_token))
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert data["score"]     == 0
        assert data["is_passed"] is False
        assert data["violations"] == 2

    def test_leaderboard(self, client, student_token, active_exam_id):
        res = client.get(f"/api/exams/{active_exam_id}/leaderboard",
                         headers=auth(student_token))
        assert res.status_code == 200
        assert isinstance(res.get_json()["data"], list)


# ══════════════════════════════════════════════════════════════════════════════
#  RESULT TESTS
# ══════════════════════════════════════════════════════════════════════════════
class TestResults:
    def test_list_results_student(self, client, student_token):
        res = client.get("/api/results/", headers=auth(student_token))
        assert res.status_code == 200
        assert isinstance(res.get_json()["data"], list)

    def test_list_results_admin(self, client, admin_token):
        res = client.get("/api/results/", headers=auth(admin_token))
        assert res.status_code == 200

    def test_analytics_admin(self, client, admin_token):
        res = client.get("/api/results/analytics", headers=auth(admin_token))
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert "overall"  in data
        assert "per_exam" in data

    def test_analytics_student_forbidden(self, client, student_token):
        res = client.get("/api/results/analytics", headers=auth(student_token))
        assert res.status_code == 403

    def test_result_detail(self, client, student_token, active_exam_id, app):
        with app.app_context():
            result = Result.query.filter_by(status="submitted").first()
            if not result:
                pytest.skip("No submitted result available")
            result_id = result.id

        res = client.get(f"/api/results/{result_id}", headers=auth(student_token))
        # student can only see own results — may be 200 or 403
        assert res.status_code in (200, 403)

    def test_result_not_found(self, client, student_token):
        res = client.get("/api/results/nonexistent-id", headers=auth(student_token))
        assert res.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
#  GRADE CALCULATOR
# ══════════════════════════════════════════════════════════════════════════════
class TestGradeLogic:
    @pytest.mark.parametrize("pct,expected", [
        (95, "O"), (85, "A+"), (72, "A"), (65, "B+"),
        (55, "B"), (42, "C"), (30, "F"), (0, "F"),
    ])
    def test_compute_grade(self, pct, expected):
        from flask_app.utils.helpers import compute_grade
        assert compute_grade(pct) == expected

    def test_evaluation_service_perfect_score(self, app):
        from flask_app.services.evaluation_service import evaluate_submission
        with app.app_context():
            exam = Exam.query.first()
            if not exam:
                pytest.skip("No exam in DB")
            questions = Question.query.filter_by(exam_id=exam.id).all()
            result = Result.query.filter_by(
                exam_id=exam.id, status="in_progress").first()
            if not result:
                pytest.skip("No in-progress result")
            answers = [{"question_id": q.id, "selected": q.correct} for q in questions]
            r = evaluate_submission(result, exam, questions, answers)
            assert r.score == exam.total_marks
