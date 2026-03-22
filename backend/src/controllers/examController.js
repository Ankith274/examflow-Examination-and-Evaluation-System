const db = require('../utils/db');

exports.getAvailable = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT e.*, u.name AS creator_name
       FROM exams e
       JOIN users u ON e.created_by = u.id
       WHERE e.status = 'active'
         AND e.scheduled_at <= NOW()
         AND e.scheduled_at + INTERVAL '1 minute' * e.duration_minutes >= NOW()
       ORDER BY e.scheduled_at`
    );
    res.json(rows);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM exams WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Exam not found' });
    const exam = rows[0];
    // Fetch questions
    const { rows: questions } = await db.query(
      'SELECT * FROM questions WHERE exam_id=$1 ORDER BY position', [exam.id]
    );
    // Parse options from JSON
    exam.questions = questions.map(q => ({
      ...q,
      options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options
    }));
    res.json(exam);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { title, subject, duration_minutes, scheduled_at, questions } = req.body;
    const { rows } = await db.query(
      `INSERT INTO exams (title, subject, duration_minutes, scheduled_at, created_by, status)
       VALUES ($1,$2,$3,$4,$5,'active') RETURNING *`,
      [title, subject, duration_minutes, scheduled_at, req.user.id]
    );
    const exam = rows[0];
    // Insert questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await db.query(
        `INSERT INTO questions (exam_id, text, options, correct_answer, position)
         VALUES ($1,$2,$3,$4,$5)`,
        [exam.id, q.text, JSON.stringify(q.options), q.correct_answer, i + 1]
      );
    }
    res.status(201).json(exam);
  } catch (err) { next(err); }
};

exports.getAll = async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM exams ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) { next(err); }
};
