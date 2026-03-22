const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'examflow_secret';
const EXPIRES = process.env.JWT_EXPIRES_IN || '8h';

exports.sign = (payload) => jwt.sign(payload, SECRET, { expiresIn: EXPIRES });

exports.verify = (token) => jwt.verify(token, SECRET);
