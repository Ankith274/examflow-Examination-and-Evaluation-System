const db = require('../utils/db');

const SEVERITY_WEIGHTS = { high: 3, medium: 2, low: 1 };

exports.log = async ({ sessionId, type, message, severity, confidence, metadata }) => {
  const { rows } = await db.query(
    `INSERT INTO violations (session_id, type, message, severity, confidence, metadata, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,
    [sessionId, type, message, severity, confidence, JSON.stringify(metadata || {})]
  );
  return rows[0];
};

exports.getRecent = async (limit = 20) => {
  const { rows } = await db.query(
    `SELECT v.*, u.name AS student_name
     FROM violations v
     JOIN sessions s ON v.session_id = s.id
     JOIN users u ON s.user_id = u.id
     ORDER BY v.created_at DESC
     LIMIT $1`, [limit]
  );
  return rows;
};

exports.getBySession = async (sessionId) => {
  const { rows } = await db.query(
    'SELECT * FROM violations WHERE session_id=$1 ORDER BY created_at DESC',
    [sessionId]
  );
  return rows;
};

exports.getIntegrityScore = async (sessionId) => {
  const { rows } = await db.query(
    'SELECT severity, COUNT(*) AS count FROM violations WHERE session_id=$1 GROUP BY severity',
    [sessionId]
  );
  const totalPenalty = rows.reduce((sum, r) => sum + (SEVERITY_WEIGHTS[r.severity] || 0) * r.count, 0);
  return Math.max(0, 100 - totalPenalty * 2);
};
