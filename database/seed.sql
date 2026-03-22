-- ExamFlow Seed Data
-- Creates one admin, two students, and one sample exam with questions.

-- Admin user (password: admin123)
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Admin User', 'admin@examflow.dev',
   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewFaSTkPFM2HjJCi',
   'admin')
ON CONFLICT (email) DO NOTHING;

-- Students (password: student123)
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Arjun Kumar',  'arjun@student.dev',
   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewFaSTkPFM2HjJCi',
   'student'),
  ('Priya Reddy',  'priya@student.dev',
   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewFaSTkPFM2HjJCi',
   'student')
ON CONFLICT (email) DO NOTHING;

-- Sample active exam (starts now, runs for 90 minutes)
WITH admin AS (SELECT id FROM users WHERE role='admin' LIMIT 1)
INSERT INTO exams (title, subject, duration_minutes, scheduled_at, status, created_by)
SELECT
  'CS301 Data Structures Midterm',
  'Computer Science',
  90,
  NOW() - INTERVAL '5 minutes',
  'active',
  id
FROM admin
ON CONFLICT DO NOTHING
RETURNING id;

-- Questions for the exam
WITH exam AS (SELECT id FROM exams WHERE title='CS301 Data Structures Midterm' LIMIT 1)
INSERT INTO questions (exam_id, text, options, correct_answer, position) VALUES
  ((SELECT id FROM exam),
   'What is the time complexity of binary search?',
   '["O(n)", "O(log n)", "O(n log n)", "O(1)"]',
   'O(log n)', 1),

  ((SELECT id FROM exam),
   'Which data structure uses LIFO (Last In First Out) order?',
   '["Queue", "Stack", "Linked List", "Heap"]',
   'Stack', 2),

  ((SELECT id FROM exam),
   'What is the worst-case time complexity of QuickSort?',
   '["O(n log n)", "O(n)", "O(n²)", "O(log n)"]',
   'O(n²)', 3),

  ((SELECT id FROM exam),
   'In a Binary Search Tree, where is the smallest element located?',
   '["Root", "Rightmost node", "Leftmost node", "Any leaf node"]',
   'Leftmost node', 4),

  ((SELECT id FROM exam),
   'Which traversal visits nodes in Left-Root-Right order?',
   '["Pre-order", "Post-order", "In-order", "Level-order"]',
   'In-order', 5)
ON CONFLICT DO NOTHING;
