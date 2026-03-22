"""
django_app/examflow/apps/results/views.py
Result listing, detail, per-exam, and analytics views.
"""

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Result
from .serializers import ResultSerializer, ResultDetailSerializer


def _stats(results):
    """Compute aggregate statistics for a queryset/list of results."""
    lst = list(results)
    if not lst:
        return {"total": 0, "passed": 0, "failed": 0,
                "avg_percentage": 0, "pass_rate": 0, "highest": 0, "lowest": 0}
    total  = len(lst)
    passed = sum(1 for r in lst if r.is_passed)
    pcts   = [r.percentage for r in lst]
    return {
        "total":          total,
        "passed":         passed,
        "failed":         total - passed,
        "avg_percentage": round(sum(pcts) / total, 2),
        "pass_rate":      round((passed / total) * 100, 2),
        "highest":        max(pcts),
        "lowest":         min(pcts),
    }


# ── GET /api/results/ ─────────────────────────────────────────────────────────
class ResultListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == "admin":
            qs = Result.objects.filter(status="submitted").select_related("exam", "student")
        else:
            qs = Result.objects.filter(
                student=request.user, status="submitted"
            ).select_related("exam", "student")
        return Response({"success": True, "data": ResultSerializer(qs, many=True).data})


# ── GET /api/results/analytics/  (admin) ──────────────────────────────────────
class AnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != "admin":
            return Response({"success": False, "message": "Admin only"}, status=403)

        all_results = Result.objects.filter(status="submitted").select_related("exam", "student")
        overall     = _stats(all_results)

        from examflow.apps.exams.models import Exam
        per_exam = []
        for exam in Exam.objects.filter(is_active=True):
            exam_results = [r for r in all_results if r.exam_id == exam.id]
            if not exam_results:
                continue
            s = _stats(exam_results)
            per_exam.append({
                "exam_id":      str(exam.id),
                "exam_title":   exam.title,
                "exam_subject": exam.subject,
                **s,
            })
        per_exam.sort(key=lambda x: x["total"], reverse=True)

        return Response({"success": True, "data": {"overall": overall, "per_exam": per_exam}})


# ── GET /api/results/exam/:exam_id/  (admin) ──────────────────────────────────
class ExamResultsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, exam_id):
        if request.user.role != "admin":
            return Response({"success": False, "message": "Admin only"}, status=403)
        qs = Result.objects.filter(
            exam_id=exam_id, status="submitted"
        ).select_related("exam", "student").order_by("-score")
        return Response({
            "success": True,
            "data": {
                "results": ResultSerializer(qs, many=True).data,
                "stats":   _stats(qs),
            },
        })


# ── GET /api/results/:id/ ─────────────────────────────────────────────────────
class ResultDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, result_id):
        try:
            result = (Result.objects
                      .select_related("exam", "student")
                      .prefetch_related("answers__question")
                      .get(id=result_id))
        except Result.DoesNotExist:
            return Response({"success": False, "message": "Result not found"}, status=404)

        if request.user.role == "student" and result.student_id != request.user.id:
            return Response({"success": False, "message": "Forbidden"}, status=403)

        return Response({"success": True, "data": ResultDetailSerializer(result).data})
