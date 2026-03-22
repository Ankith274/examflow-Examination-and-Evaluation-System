import { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

export function useExamTimer(durationSecs, onExpire, onWarn) {
  const [remaining, setRemaining] = useState(durationSecs);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);
  const warnedRef   = useRef(new Set());
  const WARN_AT     = [1800, 900, 300, 60, 30, 10];

  const start = useCallback(() => {
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        const next = prev - 1;
        WARN_AT.forEach(w => {
          if (next <= w && !warnedRef.current.has(w)) {
            warnedRef.current.add(w);
            onWarn && onWarn(next);
          }
        });
        if (next <= 0) {
          clearInterval(intervalRef.current);
          setIsRunning(false);
          onExpire && onExpire();
          return 0;
        }
        return next;
      });
    }, 1000);
  }, [onExpire, onWarn]);

  const stop = useCallback(() => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
  }, []);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const pad = n => String(Math.floor(n)).padStart(2, '0');
  const timeStr = `${pad(remaining / 60)}:${pad(remaining % 60)}`;
  const progress = ((durationSecs - remaining) / durationSecs) * 100;
  const urgency  = remaining <= 300 ? 'critical' : remaining <= 900 ? 'warning' : 'safe';

  return { remaining, timeStr, progress, urgency, isRunning, start, stop };
}

export function useExamNavigation(totalQ, isMock = false) {
  const [current, setCurrent] = useState(0);
  const [visited, setVisited]  = useState(new Set([0]));

  const go = useCallback(idx => {
    if (idx < 0 || idx >= totalQ) return;
    setCurrent(idx);
    setVisited(v => new Set([...v, idx]));
  }, [totalQ]);

  const next = useCallback(() => go(current + 1), [current, go]);
  const prev = useCallback(() => go(current - 1), [current, go]);
  const goSubject = useCallback(subIdx => {
    const perSub = isMock ? 20 : 40;
    go(subIdx * perSub);
  }, [go, isMock]);

  return { current, visited, go, next, prev, goSubject };
}

export function useAnswerSheet(totalQ) {
  const [answers, setAnswers] = useState({});
  const [flags, setFlags]     = useState({});

  const setAnswer = useCallback((idx, val) => {
    setAnswers(prev => ({ ...prev, [idx]: val }));
  }, []);

  const clearAnswer = useCallback(idx => {
    setAnswers(prev => { const n = { ...prev }; delete n[idx]; return n; });
  }, []);

  const toggleFlag = useCallback(idx => {
    setFlags(prev => ({ ...prev, [idx]: !prev[idx] }));
  }, []);

  const answeredCount = Object.values(answers).filter(a => a !== undefined && a !== -1).length;
  const flaggedCount  = Object.values(flags).filter(Boolean).length;
  const skippedCount  = totalQ - answeredCount;

  return { answers, flags, setAnswer, clearAnswer, toggleFlag, answeredCount, flaggedCount, skippedCount };
}

export function useProctoringMonitor(sessionId, onViolation) {
  const violationsRef = useRef([]);

  const logViolation = useCallback((type, message) => {
    const viol = { id: Date.now(), type, message, timestamp: new Date().toISOString() };
    violationsRef.current.push(viol);
    onViolation && onViolation(viol);
  }, [onViolation]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) logViolation('tab_switch', 'Tab switched during exam');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [logViolation]);

  return { violations: violationsRef.current, logViolation };
}
