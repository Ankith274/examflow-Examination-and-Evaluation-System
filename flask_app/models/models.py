"""
flask_app/models/models.py
All SQLAlchemy ORM models for ExamFlow Flask.
"""

import uuid
from datetime import datetime, timezone
from flask_app.app import db, bcrypt


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def new_uuid():
    return str(uuid.uuid4())


# ══════════════════════════════════════════════════════════════════════════════
#  USER
# ══════════════════════════════════════════════════════════════════════════════
class User(db.Model):
    __tablename__ = "users"

    id          = db.Column(db.String(36), primary_key=True, default=new_uuid)
    name        = db.Column(db.String(100), nullable=False)
    email       = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role        = db.Column(db.String(20), nullable=False, default="student")  # student | admin
    roll_number = db.Column(db.String(50), nullable=True, index=True)
    section     = db.Column(db.String(20), nullable=True)
    year        = db.Column(db.Integer, nullable=True, default=1)
    is_active   = db.Column(db.Boolean, default=True)
    last_login  = db.Column(db.DateTime, nullable=True)
    created_at  = db.Column(db.DateTime, default=utcnow)
    updated_at  = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    # Relationships
    exams_created = db.relationship("Exam",   back_populates="creator",  lazy="dynamic")
    results       = db.relationship("Result", back_populates="student",  lazy="dynamic")

    # ── Password helpers ──────────────────────────────────────────────────────
    def set_password(self, plain: str):
        self.password_hash = bcrypt.generate_password_hash(plain).decode("utf-8")

    def check_password(self, plain: str) -> bool:
        return bcrypt.check_password_hash(self.password_hash, plain)

    def to_dict(self, include_private=False):
        d = {
            "id":          self.id,
            "name":        self.name,
            "email":       self.email,
            "role":        self.role,
            "roll_number": self.roll_number,
            "section":     self.section,
            "year":        self.year,
            "is_active":   self.is_active,
            "last_login":  self.last_login.isoformat() if self.last_login else None,
            "created_at":  self.created_at.isoformat() if self.created_at else None,
        }
        return d

    def __repr__(self):
        return f"<User {self.email} [{self.role}]>"


# ══════════════════════════════════════════════════════════════════════════════
#  EXAM
# ══════════════════════════════════════════════════════════════════════════════
class Exam(db.Model):
    __tablename__ = "exams"

    id            = db.Column(db.String(36), primary_key=True, default=new_uuid)
    title         = db.Column(db.String(200), nullable=False)
    subject       = db.Column(db.String(100), nullable=False)
    description   = db.Column(db.Text, default="")
    duration      = db.Column(db.Integer, nullable=False)    # minutes
    total_marks   = db.Column(db.Integer, nullable=False)
    passing_marks = db.Column(db.Integer, nullable=False)
    start_time    = db.Column(db.DateTime, nullable=False)
    end_time      = db.Column(db.DateTime, nullable=False)
    instructions  = db.Column(db.Text, default="")
    is_published  = db.Column(db.Boolean, default=False)
    is_active     = db.Column(db.Boolean, default=True)
    negative_marking = db.Column(db.Boolean, default=False)
    negative_value   = db.Column(db.Float,   default=0.0)
    shuffle_questions = db.Column(db.Boolean, default=False)
    creator_id    = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    created_at    = db.Column(db.DateTime, default=utcnow)
    updated_at    = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    # Relationships
    creator   = db.relationship("User",     back_populates="exams_created")
    questions = db.relationship("Question", back_populates="exam",
                                 cascade="all, delete-orphan", order_by="Question.order")
    results   = db.relationship("Result",   back_populates="exam",
                                 cascade="all, delete-orphan")

    @property
    def status(self) -> str:
        now = utcnow()
        if not self.is_published: return "draft"
        if now < self.start_time: return "upcoming"
        if now > self.end_time:   return "ended"
        return "active"

    def to_dict(self, include_questions=False):
        d = {
            "id":              self.id,
            "title":           self.title,
            "subject":         self.subject,
            "description":     self.description,
            "duration":        self.duration,
            "total_marks":     self.total_marks,
            "passing_marks":   self.passing_marks,
            "start_time":      self.start_time.isoformat(),
            "end_time":        self.end_time.isoformat(),
            "instructions":    self.instructions,
            "is_published":    self.is_published,
            "is_active":       self.is_active,
            "negative_marking":self.negative_marking,
            "negative_value":  self.negative_value,
            "shuffle_questions":self.shuffle_questions,
            "status":          self.status,
            "creator_id":      self.creator_id,
            "created_at":      self.created_at.isoformat(),
        }
        if include_questions:
            d["questions"] = [q.to_dict() for q in self.questions]
        return d

    def __repr__(self):
        return f"<Exam '{self.title}' [{self.status}]>"


# ══════════════════════════════════════════════════════════════════════════════
#  QUESTION
# ══════════════════════════════════════════════════════════════════════════════
class Question(db.Model):
    __tablename__ = "questions"

    id          = db.Column(db.String(36), primary_key=True, default=new_uuid)
    exam_id     = db.Column(db.String(36), db.ForeignKey("exams.id"), nullable=False)
    text        = db.Column(db.Text, nullable=False)
    q_type      = db.Column(db.String(20), default="mcq")       # mcq | true_false | short
    option_a    = db.Column(db.String(500), nullable=True)
    option_b    = db.Column(db.String(500), nullable=True)
    option_c    = db.Column(db.String(500), nullable=True)
    option_d    = db.Column(db.String(500), nullable=True)
    correct     = db.Column(db.Integer, nullable=False, default=0)  # 0=A, 1=B, 2=C, 3=D
    marks       = db.Column(db.Integer, default=1)
    order       = db.Column(db.Integer, default=0)
    explanation = db.Column(db.Text, default="")
    created_at  = db.Column(db.DateTime, default=utcnow)

    # Relationships
    exam    = db.relationship("Exam",   back_populates="questions")
    answers = db.relationship("Answer", back_populates="question",
                               cascade="all, delete-orphan")

    @property
    def options(self):
        return [o for o in [self.option_a, self.option_b, self.option_c, self.option_d] if o]

    def to_dict(self, include_correct=True):
        d = {
            "id":          self.id,
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

    def __repr__(self):
        return f"<Question {self.id[:8]} exam={self.exam_id[:8]}>"


# ══════════════════════════════════════════════════════════════════════════════
#  RESULT
# ══════════════════════════════════════════════════════════════════════════════
class Result(db.Model):
    __tablename__ = "results"

    id           = db.Column(db.String(36), primary_key=True, default=new_uuid)
    exam_id      = db.Column(db.String(36), db.ForeignKey("exams.id"),  nullable=False)
    student_id   = db.Column(db.String(36), db.ForeignKey("users.id"),  nullable=False)
    score        = db.Column(db.Float,   default=0)
    total_marks  = db.Column(db.Integer, default=0)
    percentage   = db.Column(db.Float,   default=0)
    is_passed    = db.Column(db.Boolean, default=False)
    grade        = db.Column(db.String(5), default="F")
    started_at   = db.Column(db.DateTime, default=utcnow)
    submitted_at = db.Column(db.DateTime, nullable=True)
    time_taken   = db.Column(db.Integer, default=0)     # seconds
    violations   = db.Column(db.Integer, default=0)
    status       = db.Column(db.String(20), default="in_progress")
    # in_progress | submitted | cancelled

    # Relationships
    exam    = db.relationship("Exam",   back_populates="results")
    student = db.relationship("User",   back_populates="results")
    answers = db.relationship("Answer", back_populates="result",
                               cascade="all, delete-orphan")

    @staticmethod
    def compute_grade(percentage: float) -> str:
        if percentage >= 90: return "O"
        if percentage >= 80: return "A+"
        if percentage >= 70: return "A"
        if percentage >= 60: return "B+"
        if percentage >= 50: return "B"
        if percentage >= 40: return "C"
        return "F"

    def to_dict(self, include_answers=False):
        d = {
            "id":           self.id,
            "exam_id":      self.exam_id,
            "student_id":   self.student_id,
            "score":        self.score,
            "total_marks":  self.total_marks,
            "percentage":   round(self.percentage, 2),
            "is_passed":    self.is_passed,
            "grade":        self.grade,
            "started_at":   self.started_at.isoformat() if self.started_at else None,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "time_taken":   self.time_taken,
            "violations":   self.violations,
            "status":       self.status,
        }
        if include_answers:
            d["answers"] = [a.to_dict() for a in self.answers]
        return d

    def __repr__(self):
        return f"<Result student={self.student_id[:8]} exam={self.exam_id[:8]} score={self.score}>"


# ══════════════════════════════════════════════════════════════════════════════
#  ANSWER  (per-question response inside a Result)
# ══════════════════════════════════════════════════════════════════════════════
class Answer(db.Model):
    __tablename__ = "answers"

    id          = db.Column(db.String(36), primary_key=True, default=new_uuid)
    result_id   = db.Column(db.String(36), db.ForeignKey("results.id"),   nullable=False)
    question_id = db.Column(db.String(36), db.ForeignKey("questions.id"), nullable=False)
    selected    = db.Column(db.Integer, default=-1)    # -1 = skipped
    is_correct  = db.Column(db.Boolean, default=False)
    marks_gained= db.Column(db.Float,   default=0)
    time_taken  = db.Column(db.Integer, default=0)     # seconds on this question

    # Relationships
    result   = db.relationship("Result",   back_populates="answers")
    question = db.relationship("Question", back_populates="answers")

    def to_dict(self, include_question=False):
        d = {
            "id":           self.id,
            "question_id":  self.question_id,
            "selected":     self.selected,
            "is_correct":   self.is_correct,
            "marks_gained": self.marks_gained,
            "time_taken":   self.time_taken,
        }
        if include_question and self.question:
            d["question"] = self.question.to_dict(include_correct=True)
        return d

    def __repr__(self):
        return f"<Answer q={self.question_id[:8]} sel={self.selected} ok={self.is_correct}>"
