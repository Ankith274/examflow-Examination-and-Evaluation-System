"""
django_app/examflow/apps/exams/models.py
Exam and Question models.
"""

import uuid
from django.db   import models
from django.conf import settings
from django.utils import timezone


class Exam(models.Model):
    STATUS_DRAFT    = "draft"
    STATUS_UPCOMING = "upcoming"
    STATUS_ACTIVE   = "active"
    STATUS_ENDED    = "ended"

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title            = models.CharField(max_length=200)
    subject          = models.CharField(max_length=100)
    description      = models.TextField(blank=True)
    duration         = models.PositiveIntegerField(help_text="Minutes")
    total_marks      = models.PositiveIntegerField()
    passing_marks    = models.PositiveIntegerField()
    start_time       = models.DateTimeField()
    end_time         = models.DateTimeField()
    instructions     = models.TextField(blank=True)
    is_published     = models.BooleanField(default=False)
    is_active        = models.BooleanField(default=True)
    negative_marking = models.BooleanField(default=False)
    negative_value   = models.FloatField(default=0.0)
    shuffle_questions= models.BooleanField(default=False)
    creator          = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="exams_created"
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "exams"
        ordering = ["-start_time"]

    @property
    def status(self):
        now = timezone.now()
        if not self.is_published:  return self.STATUS_DRAFT
        if now < self.start_time:  return self.STATUS_UPCOMING
        if now > self.end_time:    return self.STATUS_ENDED
        return self.STATUS_ACTIVE

    def to_dict(self, include_questions=False):
        d = {
            "id":               str(self.id),
            "title":            self.title,
            "subject":          self.subject,
            "description":      self.description,
            "duration":         self.duration,
            "total_marks":      self.total_marks,
            "passing_marks":    self.passing_marks,
            "start_time":       self.start_time.isoformat(),
            "end_time":         self.end_time.isoformat(),
            "instructions":     self.instructions,
            "is_published":     self.is_published,
            "is_active":        self.is_active,
            "negative_marking": self.negative_marking,
            "negative_value":   self.negative_value,
            "shuffle_questions":self.shuffle_questions,
            "status":           self.status,
            "creator_id":       str(self.creator_id),
            "created_at":       self.created_at.isoformat(),
        }
        if include_questions:
            d["questions"] = [q.to_dict() for q in self.questions.all().order_by("order")]
        return d

    def __str__(self):
        return f"{self.title} [{self.status}]"


class Question(models.Model):
    TYPE_MCQ        = "mcq"
    TYPE_TRUE_FALSE = "true_false"
    TYPE_SHORT      = "short"

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    exam        = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="questions")
    text        = models.TextField()
    q_type      = models.CharField(max_length=20, default=TYPE_MCQ)
    option_a    = models.CharField(max_length=500, blank=True)
    option_b    = models.CharField(max_length=500, blank=True)
    option_c    = models.CharField(max_length=500, blank=True)
    option_d    = models.CharField(max_length=500, blank=True)
    correct     = models.SmallIntegerField(default=0)  # 0=A, 1=B, 2=C, 3=D
    marks       = models.PositiveSmallIntegerField(default=1)
    order       = models.PositiveSmallIntegerField(default=0)
    explanation = models.TextField(blank=True)
    created_at  = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "questions"
        ordering = ["order"]

    @property
    def options(self):
        return [o for o in [self.option_a, self.option_b, self.option_c, self.option_d] if o]

    def to_dict(self, include_correct=True):
        d = {
            "id":          str(self.id),
            "text":        self.text,
            "q_type":      self.q_type,
            "options":     self.options,
            "marks":       self.marks,
            "order":       self.order,
            "explanation": self.explanation if include_correct else "",
        }
        if include_correct:
            d["correct"] = self.correct
        return d

    def __str__(self):
        return f"Q({self.id!s:.8}) exam={self.exam_id!s:.8}"
