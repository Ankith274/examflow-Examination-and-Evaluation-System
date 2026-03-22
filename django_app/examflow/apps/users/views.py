"""
django_app/examflow/apps/users/views.py
Auth views (register, login, me) and user management views.
"""

from django.utils import timezone
from rest_framework import status, generics, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User
from .serializers import (
    RegisterSerializer, LoginSerializer,
    TokenResponseSerializer, UserSerializer, ProfileUpdateSerializer,
)
from examflow.apps.results.models import Result


# ── POST /api/auth/register ───────────────────────────────────────────────────
class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "message": "Validation failed", "errors": serializer.errors},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        user   = serializer.save()
        tokens = TokenResponseSerializer.get_tokens(user)
        return Response(
            {"success": True, "message": "Registration successful", "data": tokens},
            status=status.HTTP_201_CREATED,
        )


# ── POST /api/auth/login ──────────────────────────────────────────────────────
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "message": serializer.errors.get("non_field_errors", ["Login failed"])[0]},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        user = serializer.validated_data["user"]
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        tokens = TokenResponseSerializer.get_tokens(user)
        return Response({"success": True, "message": "Login successful", "data": tokens})


# ── GET /api/auth/me ──────────────────────────────────────────────────────────
class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"success": True, "data": UserSerializer(request.user).data})


# ── GET /api/users/dashboard ──────────────────────────────────────────────────
class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        results    = Result.objects.filter(student=request.user, status="submitted")
        total      = results.count()
        passed     = results.filter(is_passed=True).count()
        avg_score  = 0
        if total:
            avg_score = round(sum(r.percentage for r in results) / total, 2)

        recent = results.order_by("-submitted_at")[:5]
        from examflow.apps.results.serializers import ResultSerializer
        return Response({
            "success": True,
            "data": {
                "stats":          {"total_exams": total, "total_passed": passed, "avg_score": avg_score},
                "recent_results": ResultSerializer(recent, many=True).data,
            },
        })


# ── GET /api/users/profile, PUT /api/users/profile ────────────────────────────
class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"success": True, "data": UserSerializer(request.user).data})

    def put(self, request):
        serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({"success": True, "message": "Profile updated",
                             "data": UserSerializer(request.user).data})
        return Response({"success": False, "errors": serializer.errors}, status=400)


# ── GET /api/users  (admin) ───────────────────────────────────────────────────
class UserListView(generics.ListAPIView):
    serializer_class = UserSerializer
    filter_backends  = [filters.SearchFilter, filters.OrderingFilter]
    search_fields    = ["name", "email", "roll_number"]
    ordering_fields  = ["created_at", "name"]

    def get_queryset(self):
        if self.request.user.role != "admin":
            return User.objects.none()
        qs   = User.objects.all()
        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(role=role)
        return qs

    def list(self, request, *args, **kwargs):
        resp = super().list(request, *args, **kwargs)
        return Response({"success": True, "data": resp.data})


# ── GET, DELETE /api/users/:id  (admin) ───────────────────────────────────────
class UserDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_user(self, user_id):
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None

    def get(self, request, user_id):
        if request.user.role != "admin":
            return Response({"success": False, "message": "Admin only"}, status=403)
        user = self._get_user(user_id)
        if not user:
            return Response({"success": False, "message": "User not found"}, status=404)
        return Response({"success": True, "data": UserSerializer(user).data})

    def delete(self, request, user_id):
        if request.user.role != "admin":
            return Response({"success": False, "message": "Admin only"}, status=403)
        user = self._get_user(user_id)
        if not user:
            return Response({"success": False, "message": "User not found"}, status=404)
        user.is_active = False
        user.save(update_fields=["is_active"])
        return Response({"success": True, "message": f"User '{user.name}' deactivated"})
