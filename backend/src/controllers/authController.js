const bcrypt = require('bcryptjs');
const db = require('../utils/db');
const { sign } = require('../utils/jwt');

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role = 'student' } = req.body;
    const exists = await db.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length) return res.status(409).json({ message: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role',
      [name, email, hash, role]
    );
    const user = rows[0];
    const token = sign({ id: user.id, email: user.email, role: user.role });
    res.status(201).json({ token, user });
  } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { rows } = await db.query('SELECT * FROM users WHERE email=$1', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = sign({ id: user.id, email: user.email, role: user.role });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
};

exports.me = async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT id, name, email, role FROM users WHERE id=$1', [req.user.id]);
    res.json(rows[0]);
  } catch (err) { next(err); }
};
