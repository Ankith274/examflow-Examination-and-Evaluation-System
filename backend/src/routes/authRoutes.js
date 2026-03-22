// authRoutes.js
const router = require('express').Router();
const auth = require('../controllers/authController');
const protect = require('../middlewares/authMiddleware');

router.post('/register', auth.register);
router.post('/login', auth.login);
router.get('/me', protect(), auth.me);

module.exports = router;
