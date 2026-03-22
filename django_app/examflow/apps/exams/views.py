"""
django_app/examflow/apps/exams/views.py
Exam CRUD, publish, start, submit, leaderboard.
"""

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response   import Response
from rest_framework.views      import APIView

from .models       import Exam, Question
from .serializers  import ExamSerializer, ExamWriteSerializer
from examflow.apps.results.models import Result, Answer


def _is_admin(user):  return user.role == "admin"
def _is_student(user): return user.role == "student"


class ExamListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    # GET /api/exams/
    def get(self, request):
        if _is_admin(request.user):
            qs = Exam.objects.filter(is_active=True).order_by("-start_time")
        else:
            qs = Exam.objects.filter(is_published=True, is_active=True).order_by("-start_time")
        return Response({"success": True, "data": [e.to_dict() for e in qs]})

    # POST /api/exams/
    def post(self, request):
        if not _is_admin(request.user):
            return Response({"success": False, "message": "Admin only"}, status=403)

        serializer = ExamWriteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=422)

        exam = serializer.save(creator=request.user)
        return Response(
            {"success": True, "message": "Exam created", "data": exam.to_dict(include_questions=True)},
            status=201,
        )


class ExamDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, exam_id):
        try:
            return Exam.objects.get(id=exam_id, is_active=True)
        except Exam.DoesNotExist:
            return None

    # GET /api/exams/<id>/
    def get(self, request, exam_id):
        exam = self._get(exam_id)
        if not exam:
            return Response({"success": False, "message": "Exam not found"}, status=404)
        include_correct = _is_admin(request.user)
        d = exam.to_dict()
        d["questions"] = [q.to_dict(include_correct=include_correct) for q in exam.questions.all().order_by("order")]
        return Response({"success": True, "data": d})

    # PUT /api/exams/<id>/
    def put(self, request, exam_id):
        if not _is_admin(request.user):
            return Response({"success": False, "message": "Admin only"}, status=403)
        exam = self._get(exam_id)
        if not exam:
            return Response({"success": False, "message": "Exam not found"}, status=404)
        serializer = ExamWriteSerializer(exam, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({"success": False, "errors": serializer.errors}, status=422)
        exam = serializer.save()
        return Response({"success": True, "message": "Exam updated", "data": exam.to_dict()})

    # DELETE /api/exams/<id>/
    def delete(self, request, exam_id):
        if not _is_admin(request.user):
            return Response({"success": False, "message": "Admin only"}, status=403)
        exam = self._get(exam_id)
        if not exam:
            return Response({"success": False, "message": "Exam not found"}, status=404)
        exam.is_active = False
        exam.save(update_fields=["is_active"])
        return Response({"success": True, "message": "Exam deleted"})


class PublishExamView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, exam_id):
        if not _is_admin(request.user):
            return Response({"success": False, "message": "Admin only"}, status=403)
        try:
            exam = Exam.objects.get(id=exam_id)
        except Exam.DoesNotExist:
            return Response({"success": False, "message": "Exam not found"}, status=404)
        exam.is_published = True
        exam.save(update_fields=["is_published"])
        return Response({"success": True, "message": "Exam published", "data": exam.to_dict()})


class StartExamView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, exam_id):
        if not _is_student(request.user):
            return Response({"success": False, "message": "Students only"}, status=403)
        try:
            exam = Exam.objects.get(id=exam_id, is_published=True, is_active=True)
        except Exam.DoesNotExist:
            return Response({"success": False, "message": "Exam not available"}, status=404)

        now = timezone.now()
        if now < exam.start_time:
            return Response({"success": False, "message": "Exam has not started yet"}, status=400)
        if now > exam.end_time:
            return Response({"success": False, "message": "Exam has ended"}, status=400)

        existing = Result.objects.filter(exam=exam, student=request.user, status="in_progress").first()
        if existing:
            return Response({"success": True, "message": "Resuming exam", "data": existing.to_dict()})

        result = Result.objects.create(
            exam=exam, student=request.user,
            total_marks=exam.total_marks, started_at=now,
        )
        return Response({"success": True, "message": "Exam started", "data": result.to_dict()}, status=201)


class SubmitExamView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, exam_id):
        if not _is_student(request.user):
            return Response({"success": False, "message": "Students only"}, status=403)
        try:
            exam = Exam.objects.get(id=exam_id)
        except Exam.DoesNotExist:
            return Response({"success": False, "message": "Exam not found"}, status=404)

        result = Result.objects.filter(exam=exam, student=request.user, status="in_progress").first()
        if not result:
            return Response({"success": False, "message": "No active attempt"}, status=400)

        submitted  = request.data.get("answers", [])
        violations = int(request.data.get("violations", 0))
        questions  = {str(q.id): q for q in exam.questions.all()}

        score = 0.0
        Answer.objects.filter(result=result).delete()

        for sa in submitted:
            q = questions.get(str(sa.get("question_id", "")))
            if not q:
                continue
            selected   = sa.get("selected", -1)
            is_correct = selected != -1 and int(selected) == int(q.correct)
            if is_correct:
                gained = float(q.marks)
            elif exam.negative_marking and selected != -1:
                gained = -float(exam.negative_value)
            else:
                gained = 0.0
            score += gained
            Answer.objects.create(
                result=result, question=q,
                selected=selected, is_correct=is_correct,
                marks_gained=gained, time_taken=sa.get("time_taken", 0),
            )

        score      = max(0.0, score)
        percentage = round((score / exam.total_marks) * 100, 2) if exam.total_marks else 0
        is_passed  = score >= exam.passing_marks

        result.score        = score
        result.percentage   = percentage
        result.is_passed    = is_passed
        result.grade        = Result.compute_grade(percentage)
        result.submitted_at = timezone.now()
        result.time_taken   = int((result.submitted_at - result.started_at).total_seconds())
        result.violations   = violations
        result.status       = "submitted"
        result.save()

        return Response({"success": True, "message": "Exam submitted", "data": result.to_dict()})


class LeaderboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, exam_id):
        results = (Result.objects
                   .filter(exam_id=exam_id, status="submitted")
                   .select_related("student")
                   .order_by("-score", "time_taken")[:20])
        board = []
        for rank, r in enumerate(results, 1):
            d = r.to_dict()
            d["rank"]         = rank
            d["student_name"] = r.student.name        if r.student else "—"
            d["roll_number"]  = r.student.roll_number if r.student else "—"
            board.append(d)
        return Response({"success": True, "data": board})
