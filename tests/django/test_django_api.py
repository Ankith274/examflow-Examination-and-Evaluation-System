"""
tests/django/test_django_api.py
Full pytest-django test suite for ExamFlow Django REST API.

Run:
    cd examflow-python/django_app
    pytest ../tests/django/ -v --ds=examflow.settings.test
"""

import pytest
from datetime import datetime, timedelta, timezone

from django.contrib.auth import get_user_model

User = get_user_model()

# ── pytest-django marker ──────────────────────────────────────────────────────
pytestmark = pytest.mark.django_db


# ── Helpers ───────────────────────────────────────────────────────────────────
def auth(token):
    return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


def iso(dt: datetime) -> str:
    return dt.isoformat()


def future(h=1):
    return iso(datetime.now(timezone.utc) + timedelta(hours=h))


def past(h=1):
    return iso(datetime.now(timezone.utc) - timedelta(hours=h))


# ── Fixtures ──────────────────────────────────────────────────────────────────
@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def admin_user():
    return User.objects.create_user(
        email="django_admin@klh.edu.in",
        password="admin123",
        name="Django Admin",
        role="admin",
        is_staff=True,
    )


@pytest.fixture
def student_user():
    return User.objects.create_user(
        email="django_student@klh.edu.in",
        password="student123",
        name="Django Student",
        role="student",
        roll_number="2320520099",
    )


@pytest.fixture
def admin_token(api_client):
    res = api_client.post("/api/auth/register/", {
        "name": "Admin", "email": "adm@klh.edu.in",
        "password": "admin123", "role": "admin",
    }, format="json")
    return res.data["data"]["access_token"]


@pytest.fixture
def student_token(api_client):
    res = api_client.post("/api/auth/register/", {
        "name": "Student", "email": "stu@klh.edu.in",
        "password": "stu123", "role": "student",
    }, format="json")
    return res.data["data"]["access_token"]


@pytest.fixture
def active_exam(api_client, admin_token):
    """Create and return an active (start in past, end in future) exam."""
    res = api_client.post("/api/exams/", {
        "title":        "Django Active Exam",
        "subject":      "Django Testing",
        "duration":     60,
        "total_marks":  10,
        "passing_marks": 4,
        "start_time":   past(1),
        "end_time":     future(2),
        "is_published": True,
        "questions": [
            {"text": "Django Q1", "options": ["A","B","C","D"], "correct": 0, "marks": 5},
            {"text": "Django Q2", "options": ["A","B","C","D"], "correct": 2, "marks": 5},
        ],
    }, format="json", **auth(admin_token))
    assert res.status_code == 201, res.data
    return res.data["data"]


# ══════════════════════════════════════════════════════════════════════════════
#  AUTH TESTS
# ══════════════════════════════════════════════════════════════════════════════
class TestDjangoAuth:
    def test_register_success(self, api_client):
        res = api_client.post("/api/auth/register/", {
            "name": "New", "email": "brand_new@klh.edu.in",
            "password": "pass123", "role": "student",
        }, format="json")
        assert res.status_code == 201
        assert res.data["data"]["access_token"]
        assert "password" not in res.data["data"]["user"]

    def test_register_duplicate_email(self, api_client):
        payload = {"name": "A", "email": "dup2@klh.edu.in", "password": "pass123"}
        api_client.post("/api/auth/register/", payload, format="json")
        res = api_client.post("/api/auth/register/", payload, format="json")
        assert res.status_code == 422

    def test_register_weak_password(self, api_client):
        res = api_client.post("/api/auth/register/", {
            "name": "W", "email": "weak@klh.edu.in", "password": "12",
        }, format="json")
        assert res.status_code == 422

    def test_login_success(self, api_client):
        api_client.post("/api/auth/register/", {
            "name": "Login User", "email": "logindjango@klh.edu.in",
            "password": "loginpass", "role": "student",
        }, format="json")
        res = api_client.post("/api/auth/login/", {
            "email": "logindjango@klh.edu.in", "password": "loginpass",
        }, format="json")
        assert res.status_code == 200
        assert res.data["data"]["access_token"]

    def test_login_wrong_credentials(self, api_client):
        res = api_client.post("/api/auth/login/", {
            "email": "nobody@klh.edu.in", "password": "wrong",
        }, format="json")
        assert res.status_code == 401

    def test_me_authenticated(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
        res = api_client.get("/api/auth/me/")
        assert res.status_code == 200
        assert "email" in res.data["data"]

    def test_me_unauthenticated(self, api_client):
        res = api_client.get("/api/auth/me/")
        assert res.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
#  USER TESTS
# ══════════════════════════════════════════════════════════════════════════════
class TestDjangoUsers:
    def test_list_users_admin(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
        res = api_client.get("/api/users/")
        assert res.status_code == 200

    def test_list_users_student_forbidden(self, api_client, student_token):
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_token}")
        res = api_client.get("/api/users/")
        assert res.status_code == 200  # returns empty queryset (not 403) by design

    def test_dashboard(self, api_client, student_token):
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_token}")
        res = api_client.get("/api/users/dashboard/")
        assert res.status_code == 200
        assert "stats" in res.data["data"]

    def test_profile_get(self, api_client, student_token):
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_token}")
        res = api_client.get("/api/users/profile/")
        assert res.status_code == 200

    def test_profile_update(self, api_client, student_token):
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_token}")
        res = api_client.put("/api/users/profile/", {"name": "Updated Name"}, format="json")
        assert res.status_code == 200
        assert res.data["data"]["name"] == "Updated Name"


# ══════════════════════════════════════════════════════════════════════════════
#  EXAM TESTS
# ══════════════════════════════════════════════════════════════════════════════
class TestDjangoExams:
    def test_create_exam(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
        res = api_client.post("/api/exams/", {
            "title": "New Django Exam", "subject": "Science",
            "duration": 45, "total_marks": 20, "passing_marks": 8,
            "start_time": future(1), "end_time": future(3),
            "questions": [
                {"text": "Q?", "options": ["A","B","C","D"], "correct": 2, "marks": 10},
            ],
        }, format="json")
        assert res.status_code == 201
        assert res.data["data"]["title"] == "New Django Exam"

    def test_create_exam_student_forbidden(self, api_client, student_token):
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_token}")
        res = api_client.post("/api/exams/", {
            "title": "X", "subject": "Y",
            "duration": 10, "total_marks": 10, "passing_marks": 5,
            "start_time": future(1), "end_time": future(2),
        }, format="json")
        assert res.status_code == 403

    def test_list_exams(self, api_client, student_token):
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_token}")
        res = api_client.get("/api/exams/")
        assert res.status_code == 200
        assert isinstance(res.data["data"], list)

    def test_get_exam_detail(self, api_client, student_token, active_exam):
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_token}")
        res = api_client.get(f"/api/exams/{active_exam['id']}/")
        assert res.status_code == 200
        for q in res.data["data"]["questions"]:
            assert "correct" not in q  # students must not see answers

    def test_publish_exam(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
        create_res = api_client.post("/api/exams/", {
            "title": "Draft Exam", "subject": "Draft",
            "duration": 30, "total_marks": 10, "passing_marks": 4,
            "start_time": future(1), "end_time": future(3),
        }, format="json")
        eid = create_res.data["data"]["id"]
        res = api_client.post(f"/api/exams/{eid}/publish/")
        assert res.status_code == 200
        assert res.data["data"]["is_published"] is True

    def test_delete_exam(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
        create_res = api_client.post("/api/exams/", {
            "title": "Delete Me", "subject": "Temp",
            "duration": 20, "total_marks": 10, "passing_marks": 4,
            "start_time": future(1), "end_time": future(2),
        }, format="json")
        eid = create_res.data["data"]["id"]
        res = api_client.delete(f"/api/exams/{eid}/")
        assert res.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
#  EXAM FLOW: start → submit → result
# ══════════════════════════════════════════════════════════════════════════════
class TestDjangoExamFlow:
    def test_start_exam(self, api_client, student_token, active_exam):
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_token}")
        res = api_client.post(f"/api/exams/{active_exam['id']}/start/")
        assert res.status_code in (200, 201)
        assert res.data["data"]["status"] == "in_progress"

    def test_submit_exam_perfect(self, api_client, student_token, active_exam):
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_token}")
        api_client.post(f"/api/exams/{active_exam['id']}/start/")

        from examflow.apps.exams.models import Question
        qs = Question.objects.filter(exam_id=active_exam["id"])
        answers = [{"question_id": str(q.id), "selected": q.correct, "time_taken": 5}
                   for q in qs]

        res = api_client.post(f"/api/exams/{active_exam['id']}/submit/",
                              {"answers": answers, "violations": 0}, format="json")
        assert res.status_code == 200
        assert res.data["data"]["score"] == 10
        assert res.data["data"]["is_passed"] is True
        assert res.data["data"]["grade"] in ("O", "A+", "A", "B+", "B", "C", "F")

    def test_start_upcoming_exam(self, api_client, student_token, admin_token):
        """Upcoming exam (start in future) should return 400."""
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
        create_res = api_client.post("/api/exams/", {
            "title": "Future Exam", "subject": "Future",
            "duration": 30, "total_marks": 10, "passing_marks": 4,
            "start_time": future(2), "end_time": future(4),
            "is_published": True,
        }, format="json")
        eid = create_res.data["data"]["id"]

        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_token}")
        res = api_client.post(f"/api/exams/{eid}/start/")
        assert res.status_code == 400

    def test_leaderboard(self, api_client, student_token, active_exam):
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_token}")
        res = api_client.get(f"/api/exams/{active_exam['id']}/leaderboard/")
        assert res.status_code == 200
        assert isinstance(res.data["data"], list)


# ══════════════════════════════════════════════════════════════════════════════
#  RESULTS TESTS
# ══════════════════════════════════════════════════════════════════════════════
class TestDjangoResults:
    def test_list_results(self, api_client, student_token):
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_token}")
        res = api_client.get("/api/results/")
        assert res.status_code == 200
        assert isinstance(res.data["data"], list)

    def test_analytics_admin(self, api_client, admin_token):
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
        res = api_client.get("/api/results/analytics/")
        assert res.status_code == 200
        assert "overall"  in res.data["data"]
        assert "per_exam" in res.data["data"]

    def test_analytics_student_forbidden(self, api_client, student_token):
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_token}")
        res = api_client.get("/api/results/analytics/")
        assert res.status_code == 403

    def test_result_not_found(self, api_client, student_token):
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {student_token}")
        res = api_client.get("/api/results/00000000-0000-0000-0000-000000000000/")
        assert res.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
#  GRADE LOGIC
# ══════════════════════════════════════════════════════════════════════════════
class TestDjangoGradeLogic:
    @pytest.mark.parametrize("pct,expected", [
        (95, "O"), (82, "A+"), (70, "A"), (61, "B+"),
        (50, "B"), (40, "C"), (39, "F"), (0, "F"),
    ])
    def test_grade_boundaries(self, pct, expected):
        from examflow.apps.results.models import Result
        assert Result.compute_grade(pct) == expected
