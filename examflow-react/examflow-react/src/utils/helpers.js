// ── ExamFlow Utility Helpers ──────────────────────────────────────────────

export const pad = n => String(Math.floor(n)).padStart(2, '0');

export const formatDuration = secs => `${pad(secs / 60)}:${pad(secs % 60)}`;

export const formatPct = (val, dec = 1) => `${val.toFixed(dec)}%`;

export const getGrade = pct =>
  pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : 'F';

export const getRank = pct =>
  pct >= 90 ? 'Distinction' : pct >= 75 ? 'First Class' : pct >= 60 ? 'Second Class' : pct >= 50 ? 'Pass' : 'Fail';

export const validateRoll = roll => /^\d{10}$/.test(roll);

export const validateEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const validatePassword = pw => {
  if (pw.length < 8) return { valid: false, msg: 'Minimum 8 characters' };
  if (!/[A-Z]/.test(pw)) return { valid: false, msg: 'Add at least one uppercase letter' };
  if (!/[0-9]/.test(pw)) return { valid: false, msg: 'Add at least one digit' };
  return { valid: true, msg: '' };
};

export const passwordStrength = pw => {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const levels = [
    { label: '', color: '' },
    { label: 'Weak',        color: 'var(--danger)' },
    { label: 'Fair',        color: 'var(--warn)'   },
    { label: 'Good',        color: 'var(--warn)'   },
    { label: 'Strong',      color: 'var(--tl)'     },
    { label: 'Very Strong', color: 'var(--safe)'   },
  ];
  return { score: s, pct: Math.min(s, 5) * 20, ...levels[Math.min(s, 5)] };
};

export const initials = (first = '', last = '') =>
  (first[0] || '') + (last[0] || '');

export const clsx = (...classes) => classes.filter(Boolean).join(' ');

export const subjectColor = idx => ['var(--ds)','var(--os)','var(--js)','var(--dsa)','var(--ml)'][idx];
export const subjectKey   = idx => ['ds','os','js','dsa','ml'][idx];
