const router = require('express').Router();
const protect = require('../middlewares/authMiddleware');
const violationService = require('../services/violationService');

router.get('/recent', protect(['admin']), async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    res.json(await violationService.getRecent(limit));
  } catch (err) { next(err); }
});

router.get('/session/:sessionId', protect(), async (req, res, next) => {
  try {
    res.json(await violationService.getBySession(req.params.sessionId));
  } catch (err) { next(err); }
});

router.get('/session/:sessionId/score', protect(), async (req, res, next) => {
  try {
    const score = await violationService.getIntegrityScore(req.params.sessionId);
    res.json({ score });
  } catch (err) { next(err); }
});

module.exports = router;
