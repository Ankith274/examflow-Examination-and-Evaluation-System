import { useState } from "react";

// ─── Mock Data ────────────────────────────────────────────────────────────────
const STUDENT = {
  name: "Arjun Sharma",
  rollNo: "22CS1A0501",
  department: "Computer Science & Engineering",
  semester: "4th Semester",
  avatar: "AS",
  cgpa: 8.7,
  rank: 12,
  totalStudents: 180,
};

const STATS = [
  { label: "Exams Taken", value: 24, icon: "📋", color: "#4f8aff", bg: "rgba(79,138,255,0.1)" },
  { label: "Avg Score", value: "82%", icon: "📊", color: "#34d399", bg: "rgba(52,211,153,0.1)" },
  { label: "Pending Exams", value: 3, icon: "⏳", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  { label: "Certificates", value: 7, icon: "🏅", color: "#c084fc", bg: "rgba(192,132,252,0.1)" },
];

const UPCOMING_EXAMS = [
  { id: 1, subject: "Data Structures & Algorithms", code: "CS401", date: "Mar 22, 2026", time: "10:00 AM", duration: "3 hrs", type: "Midterm", status: "scheduled", difficulty: "Hard" },
  { id: 2, subject: "Database Management Systems", code: "CS402", date: "Mar 25, 2026", time: "2:00 PM", duration: "2 hrs", type: "Unit Test", status: "scheduled", difficulty: "Medium" },
  { id: 3, subject: "Computer Networks", code: "CS403", date: "Mar 28, 2026", time: "9:00 AM", duration: "3 hrs", type: "Midterm", status: "scheduled", difficulty: "Medium" },
  { id: 4, subject: "Operating Systems", code: "CS404", date: "Apr 01, 2026", time: "11:00 AM", duration: "2.5 hrs", type: "Quiz", status: "scheduled", difficulty: "Easy" },
];

const RECENT_RESULTS = [
  { id: 1, subject: "Software Engineering", code: "CS301", score: 88, total: 100, grade: "A", date: "Mar 10, 2026", type: "Midterm", rank: 8, trend: "up" },
  { id: 2, subject: "Theory of Computation", code: "CS302", score: 74, total: 100, grade: "B+", date: "Mar 5, 2026", type: "Unit Test", rank: 22, trend: "down" },
  { id: 3, subject: "Compiler Design", code: "CS303", score: 91, total: 100, grade: "A+", date: "Feb 28, 2026", type: "Midterm", rank: 3, trend: "up" },
  { id: 4, subject: "Web Technologies", code: "CS304", score: 79, total: 100, grade: "B+", date: "Feb 20, 2026", type: "Quiz", rank: 15, trend: "up" },
  { id: 5, subject: "Machine Learning", code: "CS305", score: 85, total: 100, grade: "A", date: "Feb 12, 2026", type: "Midterm", rank: 10, trend: "up" },
];

const PERFORMANCE_DATA = [
  { month: "Oct", score: 74 },
  { month: "Nov", score: 78 },
  { month: "Dec", score: 72 },
  { month: "Jan", score: 82 },
  { month: "Feb", score: 85 },
  { month: "Mar", score: 88 },
];

const SUBJECTS_PROGRESS = [
  { name: "Data Structures", progress: 78, color: "#4f8aff" },
  { name: "DBMS", progress: 85, color: "#34d399" },
  { name: "Networks", progress: 62, color: "#f59e0b" },
  { name: "OS", progress: 91, color: "#c084fc" },
  { name: "Compiler Design", progress: 88, color: "#f472b6" },
];

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "⊞" },
  { id: "exams", label: "My Exams", icon: "📋" },
  { id: "results", label: "Results", icon: "📊" },
  { id: "schedule", label: "Schedule", icon: "📅" },
  { id: "profile", label: "Profile", icon: "👤" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function MiniChart({ data }) {
  const max = Math.max(...data.map(d => d.score));
  const min = Math.min(...data.map(d => d.score));
  const range = max - min || 1;
  const W = 260, H = 80, PAD = 12;
  const pts = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((d.score - min) / range) * (H - PAD * 2);
    return `${x},${y}`;
  });
  const polyline = pts.join(" ");
  const fillPts = `${PAD},${H} ${polyline} ${W - PAD},${H}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4f8aff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#4f8aff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill="url(#chartFill)" />
      <polyline points={polyline} fill="none" stroke="#4f8aff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => {
        const [x, y] = pts[i].split(",").map(Number);
        return <circle key={i} cx={x} cy={y} r="3.5" fill="#4f8aff" stroke="#0f1729" strokeWidth="2" />;
      })}
    </svg>
  );
}

function GradeChip({ grade }) {
  const colors = {
    "A+": { bg: "rgba(52,211,153,0.15)", color: "#34d399" },
    "A":  { bg: "rgba(79,138,255,0.15)", color: "#4f8aff" },
    "B+": { bg: "rgba(245,158,11,0.15)", color: "#f59e0b" },
    "B":  { bg: "rgba(192,132,252,0.15)", color: "#c084fc" },
  };
  const style = colors[grade] || { bg: "rgba(255,255,255,0.08)", color: "#aaa" };
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: "99px",
      fontSize: "12px", fontWeight: 700, background: style.bg, color: style.color,
      fontFamily: "'Syne', sans-serif", letterSpacing: "0.04em",
    }}>
      {grade}
    </span>
  );
}

function DiffBadge({ level }) {
  const map = { Hard: "#ff6b8a", Medium: "#f59e0b", Easy: "#34d399" };
  return (
    <span style={{
      fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
      color: map[level] || "#aaa", background: `${map[level]}18`, borderRadius: "99px",
      padding: "2px 8px", fontFamily: "'DM Sans', sans-serif",
    }}>
      {level}
    </span>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function StudentDashboard() {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [examTab, setExamTab] = useState("upcoming");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=Syne:wght@600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080e1c; }

        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes progressFill {
          from { width: 0%; }
          to   { width: var(--target); }
        }

        .sd-root {
          display: flex; min-height: 100vh;
          background: #080e1c;
          font-family: 'DM Sans', sans-serif;
          color: #e2e8f8;
        }

        /* ── Sidebar ── */
        .sd-sidebar {
          width: 240px; min-height: 100vh;
          background: #0c1428;
          border-right: 1px solid rgba(255,255,255,0.06);
          display: flex; flex-direction: column;
          position: sticky; top: 0;
          padding: 28px 0;
          flex-shrink: 0;
          z-index: 20;
          transition: transform 0.3s cubic-bezier(.22,.68,0,1.2);
        }
        @media (max-width: 768px) {
          .sd-sidebar {
            position: fixed; left: 0; top: 0; bottom: 0;
            transform: translateX(-100%);
            box-shadow: 8px 0 32px rgba(0,0,0,0.5);
          }
          .sd-sidebar.open { transform: translateX(0); }
          .sd-overlay {
            display: block !important;
            position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 19;
          }
        }
        .sd-overlay { display: none; }

        .sd-logo {
          display: flex; align-items: center; gap: 10px;
          padding: 0 20px 28px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          margin-bottom: 16px;
        }
        .sd-logo-icon {
          width: 38px; height: 38px; border-radius: 10px;
          background: linear-gradient(135deg, #3b6bff, #7c9dff);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; flex-shrink: 0;
          box-shadow: 0 4px 16px rgba(59,107,255,0.35);
        }
        .sd-logo-text { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 800; color: #f0f4ff; }
        .sd-logo-sub { font-size: 10px; color: #4a5a7a; letter-spacing: 0.04em; }

        .sd-nav { flex: 1; padding: 0 12px; }
        .sd-nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 10px;
          cursor: pointer; margin-bottom: 2px;
          transition: background 0.15s, color 0.15s;
          font-size: 14px; font-weight: 500; color: #5a6f96;
          user-select: none;
        }
        .sd-nav-item:hover { background: rgba(255,255,255,0.04); color: #c2d0f0; }
        .sd-nav-item.active {
          background: rgba(79,138,255,0.14);
          color: #7fb3ff;
          font-weight: 600;
        }
        .sd-nav-icon { font-size: 16px; width: 22px; text-align: center; }
        .sd-nav-dot {
          margin-left: auto; width: 7px; height: 7px;
          background: #f59e0b; border-radius: 50%;
          animation: pulse 2s infinite;
        }

        .sd-user-card {
          margin: 16px 12px 0;
          padding: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
        }
        .sd-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: linear-gradient(135deg, #3b6bff, #9b6bff);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; color: #fff;
          font-family: 'Syne', sans-serif; flex-shrink: 0;
        }
        .sd-user-name { font-size: 13px; font-weight: 600; color: #d4e0ff; }
        .sd-user-roll { font-size: 11px; color: #4a5a7a; }

        /* ── Main ── */
        .sd-main {
          flex: 1; min-width: 0;
          padding: 28px 32px;
          overflow-x: hidden;
        }
        @media (max-width: 640px) { .sd-main { padding: 20px 16px; } }

        .sd-topbar {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 28px; gap: 12px;
        }
        .sd-hamburger {
          display: none; background: none; border: none;
          color: #e2e8f8; font-size: 22px; cursor: pointer;
          padding: 4px; flex-shrink: 0;
        }
        @media (max-width: 768px) { .sd-hamburger { display: block; } }

        .sd-greeting { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: #f0f4ff; }
        .sd-date { font-size: 13px; color: #4a5a7a; margin-top: 2px; }

        .sd-notify-btn {
          position: relative; width: 38px; height: 38px;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; font-size: 17px; color: #8a9bc7; transition: background 0.15s;
          flex-shrink: 0;
        }
        .sd-notify-btn:hover { background: rgba(255,255,255,0.09); }
        .sd-notify-dot {
          position: absolute; top: 6px; right: 6px;
          width: 8px; height: 8px; background: #f59e0b;
          border-radius: 50%; border: 2px solid #080e1c;
        }

        /* ── Cards & Grids ── */
        .sd-stats-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
          margin-bottom: 24px;
        }
        @media (max-width: 1100px) { .sd-stats-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px)  { .sd-stats-grid { grid-template-columns: 1fr 1fr; } }

        .sd-stat-card {
          background: #0c1428; border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px; padding: 18px 20px;
          display: flex; align-items: center; gap: 14px;
          animation: fadeUp 0.5s ease both;
          transition: border-color 0.2s, transform 0.2s;
          cursor: default;
        }
        .sd-stat-card:hover { border-color: rgba(79,138,255,0.25); transform: translateY(-2px); }
        .sd-stat-icon {
          width: 44px; height: 44px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; flex-shrink: 0;
        }
        .sd-stat-val { font-family: 'Syne', sans-serif; font-size: 24px; font-weight: 800; color: #f0f4ff; line-height: 1; }
        .sd-stat-label { font-size: 12px; color: #4a5a7a; margin-top: 3px; font-weight: 500; }

        .sd-mid-grid {
          display: grid; grid-template-columns: 1fr 320px; gap: 20px;
          margin-bottom: 24px;
        }
        @media (max-width: 1024px) { .sd-mid-grid { grid-template-columns: 1fr; } }

        .sd-card {
          background: #0c1428; border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px; padding: 22px 24px;
          animation: fadeUp 0.55s ease both;
        }

        .sd-card-title {
          font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700;
          color: #d4e0ff; margin-bottom: 18px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .sd-card-title-action {
          font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500;
          color: #4f8aff; cursor: pointer; letter-spacing: 0;
        }
        .sd-card-title-action:hover { text-decoration: underline; }

        /* Tabs */
        .sd-tabs {
          display: flex; gap: 4px; margin-bottom: 18px;
          background: rgba(255,255,255,0.04); border-radius: 10px; padding: 4px;
        }
        .sd-tab {
          flex: 1; padding: 8px; text-align: center; border-radius: 7px;
          font-size: 13px; font-weight: 600; cursor: pointer;
          color: #4a5a7a; transition: background 0.15s, color 0.15s;
          font-family: 'DM Sans', sans-serif;
        }
        .sd-tab.active { background: #1a2540; color: #7fb3ff; }

        /* Exam row */
        .sd-exam-row {
          padding: 14px 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 12px; cursor: default;
          transition: background 0.1s;
        }
        .sd-exam-row:last-child { border-bottom: none; }
        .sd-exam-row:hover { background: rgba(255,255,255,0.02); margin: 0 -4px; padding: 14px 4px; border-radius: 8px; }

        .sd-exam-subject { font-size: 14px; font-weight: 600; color: #d4e0ff; margin-bottom: 4px; }
        .sd-exam-meta { font-size: 12px; color: #4a5a7a; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .sd-exam-meta-dot { width: 3px; height: 3px; background: #2a3555; border-radius: 50%; }

        .sd-exam-right { text-align: right; flex-shrink: 0; }
        .sd-exam-date { font-size: 13px; font-weight: 600; color: #c2d0f0; white-space: nowrap; }
        .sd-exam-time { font-size: 11px; color: #4a5a7a; margin-top: 3px; }

        .sd-start-btn {
          margin-top: 6px; padding: 6px 14px;
          background: linear-gradient(135deg, #3b6bff, #6b9fff);
          border: none; border-radius: 8px;
          color: #fff; font-size: 12px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: opacity 0.15s, transform 0.15s;
        }
        .sd-start-btn:hover { opacity: 0.88; transform: scale(1.03); }

        /* Result row */
        .sd-result-row {
          padding: 13px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
          display: flex; align-items: center; gap: 14px;
        }
        .sd-result-row:last-child { border-bottom: none; }
        .sd-score-ring {
          position: relative; width: 46px; height: 46px; flex-shrink: 0;
        }
        .sd-score-ring svg { transform: rotate(-90deg); }
        .sd-score-val {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 800; color: #f0f4ff;
        }
        .sd-result-subject { font-size: 13px; font-weight: 600; color: #c2d0f0; }
        .sd-result-meta { font-size: 11px; color: #4a5a7a; margin-top: 2px; }
        .sd-result-right { margin-left: auto; text-align: right; flex-shrink: 0; }
        .sd-result-rank { font-size: 11px; color: #4a5a7a; margin-top: 4px; }

        /* Progress bars */
        .sd-prog-row { margin-bottom: 14px; }
        .sd-prog-top { display: flex; justify-content: space-between; margin-bottom: 7px; }
        .sd-prog-name { font-size: 13px; color: #a0b3d8; font-weight: 500; }
        .sd-prog-pct { font-size: 12px; font-weight: 700; font-family: 'Syne', sans-serif; }
        .sd-prog-track { height: 6px; background: rgba(255,255,255,0.06); border-radius: 99px; overflow: hidden; }
        .sd-prog-fill {
          height: 100%; border-radius: 99px;
          animation: progressFill 1s cubic-bezier(.22,.68,0,1.2) both;
          animation-delay: 0.2s;
        }

        /* Bottom grid */
        .sd-bot-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
          margin-bottom: 24px;
        }
        @media (max-width: 768px) { .sd-bot-grid { grid-template-columns: 1fr; } }

        /* CGPA card */
        .sd-cgpa-circle {
          width: 110px; height: 110px; margin: 0 auto 16px;
          position: relative;
        }
        .sd-cgpa-circle svg { transform: rotate(-90deg); }
        .sd-cgpa-val {
          position: absolute; inset: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
        }
        .sd-cgpa-num { font-family: 'Syne', sans-serif; font-size: 26px; font-weight: 800; color: #f0f4ff; line-height: 1; }
        .sd-cgpa-label { font-size: 10px; color: #4a5a7a; letter-spacing: 0.06em; text-transform: uppercase; margin-top: 3px; }

        .sd-rank-bar {
          display: flex; align-items: center; gap: 10px; margin-top: 14px;
        }
        .sd-rank-track {
          flex: 1; height: 6px; background: rgba(255,255,255,0.06);
          border-radius: 99px; overflow: hidden;
        }
        .sd-rank-fill {
          height: 100%; background: linear-gradient(90deg, #4f8aff, #c084fc);
          border-radius: 99px;
          animation: progressFill 1.2s cubic-bezier(.22,.68,0,1.2) both 0.4s;
        }

        /* Trend arrow */
        .trend-up   { color: #34d399; font-size: 13px; }
        .trend-down { color: #ff6b8a; font-size: 13px; }

        /* Scrollable table area */
        .sd-scroll { overflow-x: auto; }
      `}</style>

      <div className="sd-root">
        {/* Sidebar overlay for mobile */}
        {sidebarOpen && (
          <div className="sd-overlay" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ── Sidebar ───────────────────────────────── */}
        <aside className={`sd-sidebar${sidebarOpen ? " open" : ""}`}>
          <div className="sd-logo">
            <div className="sd-logo-icon">📝</div>
            <div>
              <div className="sd-logo-text">ExamPortal</div>
              <div className="sd-logo-sub">Student Panel</div>
            </div>
          </div>

          <nav className="sd-nav">
            {NAV_ITEMS.map(item => (
              <div
                key={item.id}
                className={`sd-nav-item${activeNav === item.id ? " active" : ""}`}
                onClick={() => { setActiveNav(item.id); setSidebarOpen(false); }}
              >
                <span className="sd-nav-icon">{item.icon}</span>
                {item.label}
                {item.id === "exams" && <span className="sd-nav-dot" />}
              </div>
            ))}
          </nav>

          <div className="sd-user-card">
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div className="sd-avatar">{STUDENT.avatar}</div>
              <div>
                <div className="sd-user-name">{STUDENT.name}</div>
                <div className="sd-user-roll">{STUDENT.rollNo}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main Content ───────────────────────────── */}
        <main className="sd-main">

          {/* Top bar */}
          <div className="sd-topbar">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button className="sd-hamburger" onClick={() => setSidebarOpen(s => !s)}>☰</button>
              <div>
                <div className="sd-greeting">Hello, {STUDENT.name.split(" ")[0]} 👋</div>
                <div className="sd-date">Thursday, March 19, 2026 · {STUDENT.department}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div className="sd-notify-btn">
                🔔
                <div className="sd-notify-dot" />
              </div>
              <div className="sd-avatar" style={{ width: 38, height: 38, fontSize: 13, cursor: "pointer" }}>
                {STUDENT.avatar}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="sd-stats-grid">
            {STATS.map((s, i) => (
              <div className="sd-stat-card" key={i} style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="sd-stat-icon" style={{ background: s.bg }}>{s.icon}</div>
                <div>
                  <div className="sd-stat-val" style={{ color: s.color }}>{s.value}</div>
                  <div className="sd-stat-label">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Mid grid: Exams + Subject Progress */}
          <div className="sd-mid-grid">

            {/* Upcoming / Recent Exams */}
            <div className="sd-card">
              <div className="sd-card-title">
                <span>Examinations</span>
                <span className="sd-card-title-action">View All →</span>
              </div>
              <div className="sd-tabs">
                <div className={`sd-tab${examTab === "upcoming" ? " active" : ""}`} onClick={() => setExamTab("upcoming")}>
                  Upcoming ({UPCOMING_EXAMS.length})
                </div>
                <div className={`sd-tab${examTab === "results" ? " active" : ""}`} onClick={() => setExamTab("results")}>
                  Results
                </div>
              </div>

              {examTab === "upcoming" ? (
                <div>
                  {UPCOMING_EXAMS.map(exam => (
                    <div className="sd-exam-row" key={exam.id}>
                      <div>
                        <div className="sd-exam-subject">{exam.subject}</div>
                        <div className="sd-exam-meta">
                          <span>{exam.code}</span>
                          <span className="sd-exam-meta-dot" />
                          <span>{exam.type}</span>
                          <span className="sd-exam-meta-dot" />
                          <span>{exam.duration}</span>
                          <span className="sd-exam-meta-dot" />
                          <DiffBadge level={exam.difficulty} />
                        </div>
                      </div>
                      <div className="sd-exam-right">
                        <div className="sd-exam-date">{exam.date}</div>
                        <div className="sd-exam-time">{exam.time}</div>
                        <button className="sd-start-btn">Prepare →</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  {RECENT_RESULTS.map(r => {
                    const pct = (r.score / r.total) * 100;
                    const c = r.score >= 85 ? "#34d399" : r.score >= 70 ? "#4f8aff" : "#f59e0b";
                    const dash = 2 * Math.PI * 18;
                    return (
                      <div className="sd-result-row" key={r.id}>
                        <div className="sd-score-ring">
                          <svg viewBox="0 0 46 46" width="46" height="46">
                            <circle cx="23" cy="23" r="18" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
                            <circle cx="23" cy="23" r="18" fill="none" stroke={c} strokeWidth="4"
                              strokeDasharray={dash}
                              strokeDashoffset={dash - (pct / 100) * dash}
                              strokeLinecap="round" />
                          </svg>
                          <div className="sd-score-val">{r.score}</div>
                        </div>
                        <div>
                          <div className="sd-result-subject">{r.subject}</div>
                          <div className="sd-result-meta">{r.code} · {r.type} · {r.date}</div>
                        </div>
                        <div className="sd-result-right">
                          <GradeChip grade={r.grade} />
                          <div className="sd-result-rank">Rank #{r.rank}</div>
                        </div>
                        <span className={r.trend === "up" ? "trend-up" : "trend-down"}>
                          {r.trend === "up" ? "▲" : "▼"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Subject Progress */}
            <div className="sd-card">
              <div className="sd-card-title">
                <span>Subject Mastery</span>
              </div>
              {SUBJECTS_PROGRESS.map((s, i) => (
                <div className="sd-prog-row" key={i}>
                  <div className="sd-prog-top">
                    <span className="sd-prog-name">{s.name}</span>
                    <span className="sd-prog-pct" style={{ color: s.color }}>{s.progress}%</span>
                  </div>
                  <div className="sd-prog-track">
                    <div
                      className="sd-prog-fill"
                      style={{
                        "--target": `${s.progress}%`,
                        width: `${s.progress}%`,
                        background: s.color,
                        animationDelay: `${0.2 + i * 0.1}s`,
                      }}
                    />
                  </div>
                </div>
              ))}

              {/* Mini chart */}
              <div style={{ marginTop: 22 }}>
                <div style={{ fontSize: 13, fontFamily: "'Syne', sans-serif", fontWeight: 700, color: "#d4e0ff", marginBottom: 10 }}>
                  Score Trend
                </div>
                <div style={{ height: 80, marginBottom: 8 }}>
                  <MiniChart data={PERFORMANCE_DATA} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  {PERFORMANCE_DATA.map((d, i) => (
                    <span key={i} style={{ fontSize: 10, color: "#3a4a6a" }}>{d.month}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom grid */}
          <div className="sd-bot-grid">

            {/* CGPA & Rank */}
            <div className="sd-card" style={{ animationDelay: "0.2s" }}>
              <div className="sd-card-title">Academic Standing</div>
              <div className="sd-cgpa-circle">
                <svg viewBox="0 0 110 110" width="110" height="110">
                  <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                  <circle cx="55" cy="55" r="46" fill="none"
                    stroke="url(#cgpaGrad)" strokeWidth="10"
                    strokeDasharray={`${2 * Math.PI * 46}`}
                    strokeDashoffset={`${2 * Math.PI * 46 * (1 - STUDENT.cgpa / 10)}`}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="cgpaGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#4f8aff" />
                      <stop offset="100%" stopColor="#c084fc" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="sd-cgpa-val">
                  <div className="sd-cgpa-num">{STUDENT.cgpa}</div>
                  <div className="sd-cgpa-label">CGPA</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
                {[
                  { label: "Department Rank", value: `#${STUDENT.rank}`, color: "#4f8aff" },
                  { label: "Total Students", value: STUDENT.totalStudents, color: "#c084fc" },
                  { label: "Semester", value: STUDENT.semester, color: "#34d399" },
                  { label: "Exams Passed", value: "24/24", color: "#f59e0b" },
                ].map((item, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "11px 13px", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 11, color: "#4a5a7a", marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 800, color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div className="sd-rank-bar">
                <span style={{ fontSize: 11, color: "#4a5a7a", whiteSpace: "nowrap" }}>Top {Math.round((STUDENT.rank / STUDENT.totalStudents) * 100)}%</span>
                <div className="sd-rank-track">
                  <div
                    className="sd-rank-fill"
                    style={{ "--target": `${100 - Math.round((STUDENT.rank / STUDENT.totalStudents) * 100)}%`, width: `${100 - Math.round((STUDENT.rank / STUDENT.totalStudents) * 100)}%` }}
                  />
                </div>
                <span style={{ fontSize: 11, color: "#4a5a7a" }}>Rank {STUDENT.rank}</span>
              </div>
            </div>

            {/* Notifications / Announcements */}
            <div className="sd-card" style={{ animationDelay: "0.3s" }}>
              <div className="sd-card-title">
                <span>Announcements</span>
                <span className="sd-card-title-action">Mark all read</span>
              </div>
              {[
                { icon: "🔴", text: "DSA Midterm syllabus has been updated. Check the new topics.", time: "2h ago", unread: true },
                { icon: "🟡", text: "DBMS Unit Test postponed to March 26 due to holiday.", time: "5h ago", unread: true },
                { icon: "🟢", text: "Your Compiler Design result has been published. Grade: A+", time: "1d ago", unread: false },
                { icon: "🔵", text: "Semester fee payment deadline: March 30, 2026.", time: "2d ago", unread: false },
                { icon: "🟣", text: "New practice tests uploaded for Computer Networks. 50 questions.", time: "3d ago", unread: false },
              ].map((n, i) => (
                <div key={i} style={{
                  display: "flex", gap: 12, padding: "12px 0",
                  borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  opacity: n.unread ? 1 : 0.55,
                }}>
                  <span style={{ fontSize: 14, marginTop: 2, flexShrink: 0 }}>{n.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: n.unread ? "#c2d0f0" : "#8a9bc7", lineHeight: 1.5 }}>{n.text}</div>
                    <div style={{ fontSize: 11, color: "#3a4a6a", marginTop: 4 }}>{n.time}</div>
                  </div>
                  {n.unread && <div style={{ width: 7, height: 7, background: "#4f8aff", borderRadius: "50%", marginTop: 6, flexShrink: 0 }} />}
                </div>
              ))}
            </div>

          </div>

          {/* Quick Actions */}
          <div className="sd-card" style={{ animationDelay: "0.35s" }}>
            <div className="sd-card-title">Quick Actions</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                { label: "Download Hall Ticket", icon: "🎫", color: "#4f8aff" },
                { label: "View Timetable", icon: "📅", color: "#34d399" },
                { label: "Practice Tests", icon: "🧪", color: "#f59e0b" },
                { label: "Download Results", icon: "⬇️", color: "#c084fc" },
                { label: "Raise Grievance", icon: "📢", color: "#f472b6" },
                { label: "Contact Faculty", icon: "👨‍🏫", color: "#38bdf8" },
              ].map((a, i) => (
                <button key={i} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 18px", borderRadius: 10,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${a.color}22`,
                  color: a.color, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  transition: "background 0.15s, transform 0.15s",
                  whiteSpace: "nowrap",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${a.color}18`; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.transform = "none"; }}
                >
                  <span>{a.icon}</span> {a.label}
                </button>
              ))}
            </div>
          </div>

        </main>
      </div>
    </>
  );
}
