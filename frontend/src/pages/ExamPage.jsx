import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Webcam from '../components/Webcam.jsx';
import Timer from '../components/Timer.jsx';
import WarningPopup from '../components/WarningPopup.jsx';
import useWebcam from '../hooks/useWebcam.js';
import useTimer from '../hooks/useTimer.js';
import proctorService from '../services/proctorService.js';
import api from '../services/api.js';

export default function ExamPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentQ, setCurrentQ] = useState(0);
  const [warnings, setWarnings] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const webcamRef = useRef(null);

  const { timeLeft, isExpired } = useTimer(exam?.duration_minutes * 60 || 0);
  const { stream } = useWebcam();

  // Load exam data & start session
  useEffect(() => {
    const init = async () => {
      try {
        const { data: examData } = await api.get(`/exams/${examId}`);
        setExam(examData);
        const { data: session } = await api.post(`/sessions/start`, { examId });
        setSessionId(session.id);
        proctorService.connect(session.id, handleViolation);
      } catch (err) {
        console.error('Failed to start exam', err);
        navigate('/dashboard');
      }
    };
    init();
    return () => proctorService.disconnect();
  }, [examId]);

  // Frame capture loop — sends frame every 2 seconds
  useEffect(() => {
    if (!sessionId || !stream) return;
    const interval = setInterval(() => {
      if (webcamRef.current) {
        const frame = webcamRef.current.getScreenshot();
        if (frame) proctorService.sendFrame(frame);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [sessionId, stream]);

  // Browser focus/tab monitoring
  useEffect(() => {
    const handleBlur = () => proctorService.reportBrowserEvent('tab_switch');
    const handleCopy = () => proctorService.reportBrowserEvent('copy_attempt');
    const handleContextMenu = (e) => {
      e.preventDefault();
      proctorService.reportBrowserEvent('right_click');
    };
    window.addEventListener('blur', handleBlur);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [sessionId]);

  // Auto-submit on timer expire
  useEffect(() => {
    if (isExpired && !submitted) handleSubmit();
  }, [isExpired]);

  const handleViolation = useCallback((violation) => {
    setWarnings(prev => [violation, ...prev].slice(0, 5));
  }, []);

  const handleAnswer = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    if (submitted) return;
    setSubmitted(true);
    try {
      await api.post(`/sessions/${sessionId}/submit`, { answers });
      proctorService.disconnect();
      navigate('/dashboard', { state: { submitted: true } });
    } catch (err) {
      console.error('Submit failed', err);
    }
  };

  if (!exam) return <div className="loading">Loading exam...</div>;

  const question = exam.questions[currentQ];

  return (
    <div className="exam-page">
      {/* Top bar */}
      <header className="exam-header">
        <div className="exam-title">{exam.title}</div>
        <Timer timeLeft={timeLeft} />
        <div className="exam-progress">
          Q {currentQ + 1} / {exam.questions.length}
        </div>
      </header>

      {/* Main layout */}
      <div className="exam-layout">
        {/* Questions panel */}
        <main className="exam-content">
          <div className="question-card">
            <div className="question-num">Question {currentQ + 1}</div>
            <div className="question-text">{question.text}</div>
            <div className="options-list">
              {question.options.map((opt, i) => (
                <label key={i} className={`option ${answers[question.id] === opt ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name={`q-${question.id}`}
                    value={opt}
                    checked={answers[question.id] === opt}
                    onChange={() => handleAnswer(question.id, opt)}
                  />
                  <span className="option-label">{String.fromCharCode(65 + i)}.</span>
                  {opt}
                </label>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="question-nav">
            <button
              className="btn-ghost"
              onClick={() => setCurrentQ(q => Math.max(0, q - 1))}
              disabled={currentQ === 0}
            >← Previous</button>
            {currentQ < exam.questions.length - 1
              ? <button className="btn-primary" onClick={() => setCurrentQ(q => q + 1)}>Next →</button>
              : <button className="btn-submit" onClick={handleSubmit} disabled={submitted}>
                  {submitted ? 'Submitted!' : 'Submit Exam'}
                </button>
            }
          </div>
        </main>

        {/* Proctor sidebar */}
        <aside className="proctor-sidebar">
          <Webcam ref={webcamRef} stream={stream} />
          <div className="proctor-status">
            <div className="status-dot active"></div>
            <span>Proctoring active</span>
          </div>
          {warnings.length > 0 && (
            <div className="warnings-list">
              <div className="warnings-title">⚠ Flags</div>
              {warnings.map((w, i) => (
                <div key={i} className={`warning-item sev-${w.severity}`}>
                  {w.message}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* Warning popups for high-severity violations */}
      {warnings[0]?.severity === 'high' && (
        <WarningPopup
          message={warnings[0].message}
          onDismiss={() => setWarnings(prev => prev.slice(1))}
        />
      )}
    </div>
  );
}
