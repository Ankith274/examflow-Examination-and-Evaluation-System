"""
django_app/examflow/apps/results/models.py
Result and Answer models.
"""

import uuid
from django.db   import models
from django.conf import settings
from django.utils import timezone


class Result(models.Model):
    STATUS_CHOICES = [
        ("in_progress", "In Progress"),
        ("submitted",   "Submitted"),
        ("cancelled",   "Cancelled"),
    ]

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    exam         = models.ForeignKey(
        "exams.Exam", on_delete=models.CASCADE, related_name="results"
    )
    student      = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="results"
    )
    score        = models.FloatField(default=0)
    total_marks  = models.PositiveIntegerField(default=0)
    percentage   = models.FloatField(default=0)
    is_passed    = models.BooleanField(default=False)
    grade        = models.CharField(max_length=5, default="F")
    started_at   = models.DateTimeField(default=timezone.now)
    submitted_at = models.DateTimeField(null=True, blank=True)
    time_taken   = models.PositiveIntegerField(default=0, help_text="Seconds")
    violations   = models.PositiveIntegerField(default=0)
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default="in_progress")

    class Meta:
        db_table = "results"
        ordering = ["-submitted_at"]
        unique_together = []   # allow re-attempts if needed

    def __str__(self):
        return f"Result<{self.student.email} | {self.exam.title} | {self.grade}>"

    @staticmethod
    def compute_grade(percentage: float) -> str:
        if percentage >= 90: return "O"
        if percentage >= 80: return "A+"
        if percentage >= 70: return "A"
        if percentage >= 60: return "B+"
        if percentage >= 50: return "B"
        if percentage >= 40: return "C"
        return "F"


class Answer(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    result       = models.ForeignKey(Result,          on_delete=models.CASCADE, related_name="answers")
    question     = models.ForeignKey("exams.Question", on_delete=models.CASCADE, related_name="answers")
    selected     = models.SmallIntegerField(default=-1, help_text="-1 = skipped")
    is_correct   = models.BooleanField(default=False)
    marks_gained = models.FloatField(default=0)
    time_taken   = models.PositiveIntegerField(default=0, help_text="Seconds on this question")

    class Meta:
        db_table = "answers"

    def __str__(self):
        return f"Answer<q={self.question_id} sel={self.selected} ok={self.is_correct}>"
