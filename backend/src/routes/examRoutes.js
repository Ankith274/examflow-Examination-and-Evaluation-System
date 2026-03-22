const router = require('express').Router();
const exam = require('../controllers/examController');
const protect = require('../middlewares/authMiddleware');

router.get('/available', protect(), exam.getAvailable);
router.get('/', protect(['admin']), exam.getAll);
router.get('/:id', protect(), exam.getById);
router.post('/', protect(['admin']), exam.create);

module.exports = router;
