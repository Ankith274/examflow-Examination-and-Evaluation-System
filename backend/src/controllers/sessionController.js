const db = require('../utils/db');

exports.start = async (req, res, next) => {
  try {
    const { examId } = req.body;
    const userId = req.user.id;

    // Check no active session already
    const existing = await db.query(
      "SELECT id FROM sessions WHERE user_id=$1 AND exam_id=$2 AND status='active'",
      [userId, examId]
    );
    if (existing.rows.length) return res.json(existing.rows[0]);

    const { rows } = await db.query(
      `INSERT INTO sessions (user_id, exam_id, status, started_at)
       VALUES ($1,$2,'active',NOW()) RETURNING *`,
      [userId, examId]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

exports.submit = async (req, res, next) => {
  try {
    const { answers } = req.body;
    const { sessionId } = req.params;

    // Score answers
    const { rows: questions } = await db.query(
      `SELECT q.* FROM questions q
       JOIN sessions s ON s.exam_id = q.exam_id
       WHERE s.id=$1`, [sessionId]
    );

    let score = 0;
    for (const q of questions) {
      if (answers[q.id] === q.correct_answer) score++;
    }
    const scorePercent = Math.round((score / questions.length) * 100);

    await db.query(
      `UPDATE sessions SET status='completed', submitted_at=NOW(), answers=$1, score=$2 WHERE id=$3`,
      [JSON.stringify(answers), scorePercent, sessionId]
    );

    res.json({ sessionId, score: scorePercent, total: questions.length, correct: score });
  } catch (err) { next(err); }
};

exports.getLive = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT s.*, u.name AS student_name, e.title AS exam_title,
              COUNT(v.id)::int AS violation_count
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       JOIN exams e ON s.exam_id = e.id
       LEFT JOIN violations v ON v.session_id = s.id
       WHERE s.status = 'active'
       GROUP BY s.id, u.name, e.title
       ORDER BY s.started_at DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT s.*, u.name AS student_name, e.title AS exam_title
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       JOIN exams e ON s.exam_id = e.id
       WHERE s.id=$1`, [req.params.sessionId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Session not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};
