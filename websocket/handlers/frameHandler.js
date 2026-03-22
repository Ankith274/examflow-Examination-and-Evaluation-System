const axios = require('axios');
const violationService = require('../../backend/src/services/violationService');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:6000';

// Violation message templates
const MESSAGES = {
  no_face:      { message: 'No face detected in frame', severity: 'high' },
  multiple_face:{ message: 'Multiple persons detected in frame', severity: 'high' },
  gaze_off:     { message: 'Gaze detected away from screen', severity: 'medium' },
  head_pose:    { message: 'Suspicious head movement detected', severity: 'medium' },
  phone:        { message: 'Mobile phone detected in frame', severity: 'high' },
  book:         { message: 'Book or notes detected in frame', severity: 'medium' },
  earphones:    { message: 'Earphones/earbuds detected', severity: 'medium' },
};

exports.process = async (base64Frame, sessionId, user) => {
  try {
    const { data } = await axios.post(`${ML_URL}/analyze/frame`, {
      frame: base64Frame,
      session_id: sessionId
    }, { timeout: 3000 });

    const violations = data.violations || [];
    if (!violations.length) return null;

    // Pick highest severity violation to report
    const priority = violations.sort((a, b) =>
      (b.severity === 'high' ? 2 : b.severity === 'medium' ? 1 : 0) -
      (a.severity === 'high' ? 2 : a.severity === 'medium' ? 1 : 0)
    )[0];

    const template = MESSAGES[priority.type] || { message: priority.type, severity: 'low' };

    const violation = await violationService.log({
      sessionId,
      type: priority.type,
      message: template.message,
      severity: template.severity,
      confidence: priority.confidence,
      metadata: priority.metadata || {}
    });

    return violation;
  } catch (err) {
    // ML service timeout or error — don't block exam
    if (err.code !== 'ECONNABORTED') {
      console.error('[FrameHandler] ML service error:', err.message);
    }
    return null;
  }
};
