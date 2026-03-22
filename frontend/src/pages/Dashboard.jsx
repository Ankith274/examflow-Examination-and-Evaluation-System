import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';

export default function Dashboard() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/exams/available')
      .then(({ data }) => setExams(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  if (loading) return <div className="loading">Loading exams...</div>;

  return (
    <div className="dashboard-page">
      <header className="dash-header">
        <div className="dash-logo">ExamFlow</div>
        <button className="btn-ghost" onClick={handleLogout}>Logout</button>
      </header>
      <main className="dash-main">
        <h2>Available Exams</h2>
        <div className="exam-grid">
          {exams.length === 0
            ? <p className="no-exams">No exams scheduled.</p>
            : exams.map(exam => (
              <div key={exam.id} className="exam-card">
                <div className="exam-card-header">
                  <span className="exam-subject">{exam.subject}</span>
                  <span className={`exam-status ${exam.status}`}>{exam.status}</span>
                </div>
                <h3>{exam.title}</h3>
                <div className="exam-meta">
                  <span>⏱ {exam.duration_minutes} min</span>
                  <span>📅 {new Date(exam.scheduled_at).toLocaleString()}</span>
                </div>
                <button
                  className="btn-primary"
                  disabled={exam.status !== 'active'}
                  onClick={() => navigate(`/exam/${exam.id}`)}
                >
                  {exam.status === 'active' ? 'Start Exam →' : 'Not Available'}
                </button>
              </div>
            ))
          }
        </div>
      </main>
    </div>
  );
}
