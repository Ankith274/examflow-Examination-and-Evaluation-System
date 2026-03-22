const violationService = require('../../backend/src/services/violationService');

const BROWSER_EVENTS = {
  tab_switch:   { message: 'Student switched to another tab or window', severity: 'medium' },
  copy_attempt: { message: 'Copy action detected during exam', severity: 'low' },
  right_click:  { message: 'Right-click attempt detected', severity: 'low' },
  devtools:     { message: 'Developer tools opened', severity: 'high' },
  window_blur:  { message: 'Exam window lost focus', severity: 'low' },
};

exports.processBrowserEvent = async (eventType, sessionId, user) => {
  const template = BROWSER_EVENTS[eventType];
  if (!template) return null;

  try {
    const violation = await violationService.log({
      sessionId,
      type: eventType,
      message: template.message,
      severity: template.severity,
      confidence: 1.0,
      metadata: { source: 'browser', event: eventType }
    });
    return violation;
  } catch (err) {
    console.error('[AudioHandler] Log error:', err.message);
    return null;
  }
};
