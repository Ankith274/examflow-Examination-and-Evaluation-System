import { createContext, useContext, useReducer, useCallback } from 'react';
import { DEMO_ACCOUNTS } from '../data/questions';

// ── Initial state ──────────────────────────────────────────────────────────
const initialState = {
  user:         null,
  isLoading:    false,
  error:        null,
  toast:        null,
  examSession:  null,
  examResult:   null,
  results:      [],
};

// ── Action types ───────────────────────────────────────────────────────────
const Actions = {
  SET_USER:        'SET_USER',
  SET_LOADING:     'SET_LOADING',
  SET_ERROR:       'SET_ERROR',
  SHOW_TOAST:      'SHOW_TOAST',
  CLEAR_TOAST:     'CLEAR_TOAST',
  START_EXAM:      'START_EXAM',
  END_EXAM:        'END_EXAM',
  SET_RESULT:      'SET_RESULT',
  ADD_RESULT:      'ADD_RESULT',
  LOGOUT:          'LOGOUT',
};

// ── Reducer ────────────────────────────────────────────────────────────────
function appReducer(state, action) {
  switch (action.type) {
    case Actions.SET_USER:
      return { ...state, user: action.payload, error: null };
    case Actions.SET_LOADING:
      return { ...state, isLoading: action.payload };
    case Actions.SET_ERROR:
      return { ...state, error: action.payload, isLoading: false };
    case Actions.SHOW_TOAST:
      return { ...state, toast: action.payload };
    case Actions.CLEAR_TOAST:
      return { ...state, toast: null };
    case Actions.START_EXAM:
      return { ...state, examSession: action.payload, examResult: null };
    case Actions.END_EXAM:
      return { ...state, examSession: null };
    case Actions.SET_RESULT:
      return { ...state, examResult: action.payload };
    case Actions.ADD_RESULT:
      return { ...state, results: [...state.results, action.payload] };
    case Actions.LOGOUT:
      return { ...initialState };
    default:
      return state;
  }
}

// ── Context ────────────────────────────────────────────────────────────────
const AppContext = createContext(null);

// ── In-memory user database ────────────────────────────────────────────────
const userDB = new Map(DEMO_ACCOUNTS.map(u => [u.roll, { ...u }]));

// ── Provider ───────────────────────────────────────────────────────────────
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const showToast = useCallback((type, message, duration = 3200) => {
    dispatch({ type: Actions.SHOW_TOAST, payload: { type, message, id: Date.now() } });
    setTimeout(() => dispatch({ type: Actions.CLEAR_TOAST }), duration);
  }, []);

  const login = useCallback(async (identifier, password) => {
    dispatch({ type: Actions.SET_LOADING, payload: true });
    await new Promise(r => setTimeout(r, 400)); // Simulate network delay
    const user = [...userDB.values()].find(
      u => (u.roll === identifier || u.email === identifier) && u.password === password
    );
    if (user) {
      const { password: _, ...safeUser } = user;
      dispatch({ type: Actions.SET_USER, payload: safeUser });
      dispatch({ type: Actions.SET_LOADING, payload: false });
      showToast('success', `Welcome back, ${user.first}! (${user.roll})`);
      return { success: true, user: safeUser };
    } else {
      dispatch({ type: Actions.SET_ERROR, payload: 'Invalid credentials — try a demo account' });
      dispatch({ type: Actions.SET_LOADING, payload: false });
      return { success: false, error: 'Invalid credentials' };
    }
  }, [showToast]);

  const register = useCallback(async (data) => {
    dispatch({ type: Actions.SET_LOADING, payload: true });
    await new Promise(r => setTimeout(r, 500));
    if (userDB.has(data.roll)) {
      dispatch({ type: Actions.SET_LOADING, payload: false });
      return { success: false, error: 'Roll number already registered' };
    }
    const newUser = { ...data, avatar: data.first[0] + (data.last?.[0] || '') };
    userDB.set(data.roll, newUser);
    const { password: _, ...safeUser } = newUser;
    dispatch({ type: Actions.SET_USER, payload: safeUser });
    dispatch({ type: Actions.SET_LOADING, payload: false });
    showToast('success', `Account created! Welcome, ${data.first}!`);
    return { success: true, user: safeUser };
  }, [showToast]);

  const logout = useCallback(() => {
    dispatch({ type: Actions.LOGOUT });
    showToast('info', 'Logged out. See you soon!');
  }, [showToast]);

  const startExam = useCallback((examConfig) => {
    const session = {
      id:          `sess_${Date.now()}`,
      examId:      examConfig.id,
      examType:    examConfig.type,
      title:       examConfig.title,
      totalQ:      examConfig.questions,
      perSub:      examConfig.perSub,
      duration:    examConfig.duration * 60,
      startedAt:   Date.now(),
      answers:     {},
      flags:       {},
      violations:  [],
      currentQ:    0,
    };
    dispatch({ type: Actions.START_EXAM, payload: session });
    return session;
  }, []);

  const submitExam = useCallback((session, questions) => {
    const endTime   = Date.now();
    const timeUsed  = Math.floor((endTime - session.startedAt) / 1000);
    let correct = 0;
    const subjectScores = {};
    const subjectTotals = {};

    questions.forEach((q, idx) => {
      const subj = ['Data Science','Operating Systems','JavaScript','Data Structures','ML & Algorithms'][q.s];
      if (!subjectTotals[subj]) { subjectTotals[subj] = 0; subjectScores[subj] = 0; }
      subjectTotals[subj]++;
      const userAns = session.answers[idx];
      if (userAns !== undefined && userAns !== -1 && userAns === q.a) {
        correct++;
        subjectScores[subj]++;
      }
    });

    const total    = questions.length;
    const wrong    = Object.values(session.answers).filter(a => a !== undefined && a !== -1).length - correct;
    const skipped  = total - Object.values(session.answers).filter(a => a !== undefined && a !== -1).length;
    const pct      = Math.round(correct / total * 100);
    const grade    = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : 'F';

    const result = {
      id:            `res_${Date.now()}`,
      sessionId:     session.id,
      examId:        session.examId,
      examType:      session.examType,
      title:         session.title,
      submittedAt:   new Date().toISOString(),
      total, correct, wrong, skipped,
      percentage:    pct,
      grade,
      passed:        pct >= 50,
      timeUsed,
      timeUsedStr:   `${String(Math.floor(timeUsed/60)).padStart(2,'0')}:${String(timeUsed%60).padStart(2,'0')}`,
      subjectScores,
      subjectTotals,
      violationCount: session.violations?.length || 0,
      answers:       session.answers,
    };

    dispatch({ type: Actions.END_EXAM });
    dispatch({ type: Actions.SET_RESULT, payload: result });
    dispatch({ type: Actions.ADD_RESULT, payload: result });
    showToast('success', `Exam submitted! Score: ${correct}/${total} (${pct}%)`);
    return result;
  }, [showToast]);

  const value = {
    ...state,
    dispatch,
    actions: Actions,
    showToast,
    login,
    register,
    logout,
    startExam,
    submitExam,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
