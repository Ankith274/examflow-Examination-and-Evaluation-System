"""
django_app/examflow/apps/exams/serializers.py
"""

from rest_framework import serializers
from .models import Exam, Question


class QuestionSerializer(serializers.ModelSerializer):
    options = serializers.SerializerMethodField()

    class Meta:
        model  = Question
        fields = ["id", "text", "q_type", "options", "option_a", "option_b",
                  "option_c", "option_d", "correct", "marks", "order", "explanation"]

    def get_options(self, obj):
        return obj.options

    def to_representation(self, instance):
        data    = super().to_representation(instance)
        request = self.context.get("request")
        # Hide correct answer from students
        if request and hasattr(request, "user") and request.user.role != "admin":
            data.pop("correct", None)
            data.pop("explanation", None)
        # Remove raw option fields — use the 'options' list instead
        for f in ["option_a", "option_b", "option_c", "option_d"]:
            data.pop(f, None)
        return data


class ExamSerializer(serializers.ModelSerializer):
    status    = serializers.ReadOnlyField()
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model  = Exam
        fields = [
            "id", "title", "subject", "description", "duration",
            "total_marks", "passing_marks", "start_time", "end_time",
            "instructions", "is_published", "is_active", "negative_marking",
            "negative_value", "shuffle_questions", "status",
            "creator_id", "created_at", "questions",
        ]
        read_only_fields = ["id", "creator_id", "created_at", "status"]


class ExamWriteSerializer(serializers.ModelSerializer):
    questions = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)

    class Meta:
        model  = Exam
        fields = [
            "title", "subject", "description", "duration",
            "total_marks", "passing_marks", "start_time", "end_time",
            "instructions", "is_published", "negative_marking",
            "negative_value", "shuffle_questions", "questions",
        ]

    def validate(self, data):
        if data.get("end_time") and data.get("start_time"):
            if data["end_time"] <= data["start_time"]:
                raise serializers.ValidationError("end_time must be after start_time")
        return data

    def _save_questions(self, exam, questions_data):
        exam.questions.all().delete()
        for i, qd in enumerate(questions_data):
            opts = qd.get("options", [])
            Question.objects.create(
                exam        = exam,
                text        = qd.get("text", "").strip(),
                q_type      = qd.get("q_type", "mcq"),
                option_a    = opts[0] if len(opts) > 0 else "",
                option_b    = opts[1] if len(opts) > 1 else "",
                option_c    = opts[2] if len(opts) > 2 else "",
                option_d    = opts[3] if len(opts) > 3 else "",
                correct     = int(qd.get("correct", 0)),
                marks       = int(qd.get("marks", 1)),
                order       = qd.get("order", i),
                explanation = qd.get("explanation", ""),
            )

    def create(self, validated_data):
        questions_data = validated_data.pop("questions", [])
        exam = Exam.objects.create(**validated_data)
        self._save_questions(exam, questions_data)
        return exam

    def update(self, instance, validated_data):
        questions_data = validated_data.pop("questions", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if questions_data is not None:
            self._save_questions(instance, questions_data)
        return instance
