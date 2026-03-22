const router = require('express').Router();
const session = require('../controllers/sessionController');
const protect = require('../middlewares/authMiddleware');

router.post('/start', protect(), session.start);
router.post('/:sessionId/submit', protect(), session.submit);
router.get('/live', protect(['admin']), session.getLive);
router.get('/:sessionId', protect(), session.getById);

module.exports = router;
