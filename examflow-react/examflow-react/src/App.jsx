import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import AuthPage      from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import ExamPage      from './pages/ExamPage';
import ResultsPage   from './pages/ResultsPage';
import Toast         from './components/ui/Toast';
import './styles/globals.css';

// ── Route guards ──────────────────────────────────────────────────────────
function RequireAuth({ children }) {
  const { user } = useApp();
  const location = useLocation();
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;
  return children;
}

function RequireExam({ children }) {
  const { examSession } = useApp();
  if (!examSession) return <Navigate to="/dashboard" replace />;
  return children;
}

function RequireResult({ children }) {
  const { examResult } = useApp();
  if (!examResult) return <Navigate to="/dashboard" replace />;
  return children;
}

function RedirectIfAuthed({ children }) {
  const { user } = useApp();
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

// ── App Routes ────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <>
      <Routes>
        <Route path="/"         element={<Navigate to="/auth" replace />} />
        <Route path="/auth"     element={<RedirectIfAuthed><AuthPage /></RedirectIfAuthed>} />
        <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
        <Route path="/exam"      element={<RequireAuth><RequireExam><ExamPage /></RequireExam></RequireAuth>} />
        <Route path="/results"   element={<RequireAuth><RequireResult><ResultsPage /></RequireResult></RequireAuth>} />
        <Route path="*"          element={<NotFound />} />
      </Routes>
      <Toast />
    </>
  );
}

// ── 404 Page ──────────────────────────────────────────────────────────────
function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12 }}>
      <div style={{ fontFamily:'var(--mn)', fontSize:64, color:'var(--a2)', lineHeight:1 }}>404</div>
      <div style={{ fontFamily:'var(--dp)', fontSize:20, fontWeight:700 }}>Page not found</div>
      <div style={{ fontSize:12, color:'var(--tx2)', marginBottom:12 }}>This route doesn't exist in ExamFlow.</div>
      <button onClick={() => navigate('/dashboard')}
              style={{ padding:'10px 22px', borderRadius:10, background:'linear-gradient(135deg,var(--a),var(--tl))', border:'none', color:'#fff', fontFamily:'var(--fn)', fontWeight:600, fontSize:13, cursor:'pointer' }}>
        ← Back to Dashboard
      </button>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}
