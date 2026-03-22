"""
django_app/examflow/apps/results/serializers.py
DRF serializers for Result and Answer.
"""

from rest_framework import serializers
from .models import Result, Answer
from examflow.apps.exams.serializers import QuestionSerializer


class AnswerSerializer(serializers.ModelSerializer):
    question = QuestionSerializer(read_only=True)

    class Meta:
        model  = Answer
        fields = ["id", "question", "selected", "is_correct", "marks_gained", "time_taken"]


class AnswerSubmitSerializer(serializers.Serializer):
    """Used when accepting submitted answers from the client."""
    question_id = serializers.UUIDField()
    selected    = serializers.IntegerField(default=-1)
    time_taken  = serializers.IntegerField(default=0)


class ResultSerializer(serializers.ModelSerializer):
    exam_title    = serializers.CharField(source="exam.title",          read_only=True, default="")
    exam_subject  = serializers.CharField(source="exam.subject",        read_only=True, default="")
    student_name  = serializers.CharField(source="student.name",        read_only=True, default="")
    roll_number   = serializers.CharField(source="student.roll_number", read_only=True, default="")

    class Meta:
        model  = Result
        fields = [
            "id", "exam_id", "student_id", "exam_title", "exam_subject",
            "student_name", "roll_number",
            "score", "total_marks", "percentage", "is_passed", "grade",
            "started_at", "submitted_at", "time_taken", "violations", "status",
        ]


class ResultDetailSerializer(ResultSerializer):
    answers = AnswerSerializer(many=True, read_only=True)

    class Meta(ResultSerializer.Meta):
        fields = ResultSerializer.Meta.fields + ["answers"]
