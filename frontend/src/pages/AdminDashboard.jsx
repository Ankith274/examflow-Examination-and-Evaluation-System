import React, { useEffect, useState, useRef } from 'react';
import api from '../services/api.js';

export default function AdminDashboard() {
  const [sessions, setSessions] = useState([]);
  const [violations, setViolations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState({ active: 0, flagged: 0, completed: 0 });
  const wsRef = useRef(null);

  useEffect(() => {
    // Load live sessions
    const fetchData = async () => {
      const [sessRes, violRes] = await Promise.all([
        api.get('/sessions/live'),
        api.get('/violations/recent?limit=20')
      ]);
      setSessions(sessRes.data);
      setViolations(violRes.data);
      setStats({
        active: sessRes.data.filter(s => s.status === 'active').length,
        flagged: sessRes.data.filter(s => s.violation_count > 2).length,
        completed: sessRes.data.filter(s => s.status === 'completed').length,
      });
    };
    fetchData();

    // Subscribe to admin WebSocket feed
    const ws = new WebSocket(
      `${import.meta.env.REACT_APP_WS_URL || 'ws://localhost:5001'}/admin`
    );
    ws.onmessage = ({ data }) => {
      const event = JSON.parse(data);
      if (event.type === 'violation') {
        setViolations(prev => [event.payload, ...prev].slice(0, 50));
        setSessions(prev => prev.map(s =>
          s.id === event.payload.session_id
            ? { ...s, violation_count: (s.violation_count || 0) + 1 }
            : s
        ));
      }
    };
    wsRef.current = ws;
    return () => ws.close();
  }, []);

  const getSeverityColor = (sev) => ({ high: '#FF5B5B', medium: '#F5A623', low: '#4DA8F0' }[sev] || '#888');

  return (
    <div className="admin-page">
      {/* Header */}
      <header className="admin-header">
        <div className="admin-logo">ExamFlow <span className="admin-badge">Admin</span></div>
        <div className="admin-live">
          <span className="live-dot"></span> LIVE
        </div>
      </header>

      {/* Stats bar */}
      <div className="stats-bar">
        <div className="stat-card"><span className="stat-val accent">{stats.active}</span><span className="stat-label">Active sessions</span></div>
        <div className="stat-card"><span className="stat-val warn">{stats.flagged}</span><span className="stat-label">Flagged students</span></div>
        <div className="stat-card"><span className="stat-val">{stats.completed}</span><span className="stat-label">Completed</span></div>
        <div className="stat-card"><span className="stat-val">{violations.length}</span><span className="stat-label">Total violations</span></div>
      </div>

      {/* Main layout */}
      <div className="admin-layout">
        {/* Student list */}
        <aside className="student-panel">
          <div className="panel-title">Students ({sessions.length})</div>
          <div className="student-list">
            {sessions.map(session => (
              <div
                key={session.id}
                className={`student-row ${selected?.id === session.id ? 'active' : ''} ${session.violation_count > 2 ? 'flagged' : ''}`}
                onClick={() => setSelected(session)}
              >
                <div className="student-avatar">{session.student_name?.slice(0, 2).toUpperCase()}</div>
                <div className="student-info">
                  <div className="student-name">{session.student_name}</div>
                  <div className="student-meta">{session.violation_count || 0} flags</div>
                </div>
                <div className={`status-pill ${session.status}`}>{session.status}</div>
              </div>
            ))}
          </div>
        </aside>

        {/* Violation feed */}
        <main className="violation-feed">
          <div className="panel-title">
            Live Violation Feed
            {selected && <span className="filter-tag">Filtering: {selected.student_name}</span>}
          </div>
          <div className="violations-scroll">
            {violations
              .filter(v => !selected || v.session_id === selected.id)
              .map((v, i) => (
                <div key={i} className="violation-row">
                  <div className="v-sev" style={{ background: getSeverityColor(v.severity) }}>{v.severity?.toUpperCase()}</div>
                  <div className="v-body">
                    <div className="v-student">{v.student_name}</div>
                    <div className="v-msg">{v.message}</div>
                  </div>
                  <div className="v-meta">
                    <div className="v-time">{new Date(v.created_at).toLocaleTimeString()}</div>
                    <div className="v-conf">{v.confidence ? `${Math.round(v.confidence * 100)}%` : '—'}</div>
                  </div>
                </div>
              ))
            }
          </div>
        </main>
      </div>
    </div>
  );
}
