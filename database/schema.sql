-- ExamFlow Database Schema
-- Run: psql -U postgres -d examflow -f schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'student'
                        CHECK (role IN ('student', 'admin', 'proctor')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ─── EXAMS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exams (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title               VARCHAR(200) NOT NULL,
    subject             VARCHAR(100),
    description         TEXT,
    duration_minutes    INT NOT NULL DEFAULT 60,
    scheduled_at        TIMESTAMPTZ NOT NULL,
    status              VARCHAR(20) DEFAULT 'draft'
                            CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_exams_status ON exams(status);
CREATE INDEX idx_exams_scheduled ON exams(scheduled_at);

-- ─── QUESTIONS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id         UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    text            TEXT NOT NULL,
    options         JSONB NOT NULL,          -- ["option A", "option B", ...]
    correct_answer  TEXT NOT NULL,
    position        INT NOT NULL DEFAULT 1,
    marks           INT DEFAULT 1
);

CREATE INDEX idx_questions_exam ON questions(exam_id);

-- ─── SESSIONS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    exam_id         UUID NOT NULL REFERENCES exams(id),
    status          VARCHAR(20) DEFAULT 'active'
                        CHECK (status IN ('active', 'completed', 'terminated')),
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    submitted_at    TIMESTAMPTZ,
    answers         JSONB,                   -- { question_id: chosen_answer }
    score           NUMERIC(5,2),            -- 0–100
    integrity_score NUMERIC(5,2),            -- 0–100, computed from violations
    UNIQUE (user_id, exam_id)
);

CREATE INDEX idx_sessions_user    ON sessions(user_id);
CREATE INDEX idx_sessions_exam    ON sessions(exam_id);
CREATE INDEX idx_sessions_status  ON sessions(status);

-- ─── VIOLATIONS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS violations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    type        VARCHAR(50) NOT NULL,        -- no_face, phone, tab_switch, etc.
    message     TEXT NOT NULL,
    severity    VARCHAR(10) NOT NULL
                    CHECK (severity IN ('low', 'medium', 'high')),
    confidence  NUMERIC(4,3),               -- 0.000 – 1.000
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_violations_session  ON violations(session_id);
CREATE INDEX idx_violations_severity ON violations(severity);
CREATE INDEX idx_violations_created  ON violations(created_at DESC);

-- ─── RECORDINGS (optional) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recordings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    storage_url TEXT,                        -- S3 / cloud URL
    duration_s  INT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
