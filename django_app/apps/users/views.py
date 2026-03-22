"""django_app/apps/users/views.py"""
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from django_app.apps.users.models import User
from django_app.apps.users.serializers import (
    RegisterSerializer, LoginSerializer,
    UserSerializer, get_tokens_for_user
)
from django_app.utils import success_response, error_response


# ── POST /api/auth/register ───────────────────────────────────────────────────
class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = RegisterSerializer(data=request.data)
        if not ser.is_valid():
            return error_response("Validation failed", 422, ser.errors)
        user   = ser.save()
        tokens = get_tokens_for_user(user)
        return success_response(
            {**tokens, "user": UserSerializer(user).data},
            message="Registration successful", status=201
        )


# ── POST /api/auth/login ──────────────────────────────────────────────────────
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = LoginSerializer(data=request.data)
        if not ser.is_valid():
            return error_response("Validation failed", 422, ser.errors)

        email    = ser.validated_data["email"].lower()
        password = ser.validated_data["password"]

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return error_response("Invalid email or password", 401)

        if not user.check_password(password):
            return error_response("Invalid email or password", 401)
        if not user.is_active:
            return error_response("Account deactivated", 403)

        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])

        tokens = get_tokens_for_user(user)
        return success_response(
            {**tokens, "user": UserSerializer(user).data},
            message="Login successful"
        )


# ── POST /api/auth/logout ─────────────────────────────────────────────────────
class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        return success_response(message="Logged out")


# ── GET /api/auth/me ──────────────────────────────────────────────────────────
class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return success_response(UserSerializer(request.user).data)


# ── GET/PUT /api/users/profile ────────────────────────────────────────────────
class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return success_response(UserSerializer(request.user).data)

    def put(self, request):
        allowed = {k: v for k, v in request.data.items() if k in ("name","section","year")}
        ser = UserSerializer(request.user, data=allowed, partial=True)
        if not ser.is_valid():
            return error_response("Validation failed", 422, ser.errors)
        ser.save()
        return success_response(ser.data, message="Profile updated")


# ── GET /api/users/dashboard ──────────────────────────────────────────────────
class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django_app.apps.results.models import Result
        results = Result.objects.filter(student=request.user, status="submitted")
        total   = results.count()
        passed  = results.filter(is_passed=True).count()
        avg     = round(sum(r.percentage for r in results) / total, 2) if total else 0
        recent  = results.order_by("-submitted_at")[:5]
        from django_app.apps.results.serializers import ResultSerializer
        return success_response({
            "stats": {"total_exams": total, "total_passed": passed, "avg_score": avg},
            "recent_results": ResultSerializer(recent, many=True).data,
        })
