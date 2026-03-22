import { SUBJECTS } from '../data/questions';

export function evaluateExam(questions, answers, session) {
  let correct = 0;
  const subjectScores = {};
  const subjectTotals = {};
  const questionResults = [];

  SUBJECTS.forEach(s => {
    subjectScores[s.name] = 0;
    subjectTotals[s.name] = 0;
  });

  questions.forEach((q, idx) => {
    const subj   = SUBJECTS[q.s].name;
    const sel    = answers[idx];
    const isAns  = sel !== undefined && sel !== -1;
    const isCorr = isAns && sel === q.a;
    const status = !isAns ? 'skipped' : isCorr ? 'correct' : 'wrong';

    subjectTotals[subj]++;
    if (isCorr) { correct++; subjectScores[subj]++; }

    questionResults.push({
      idx, question: q, selected: sel ?? -1,
      status, isCorrect: isCorr, isSkipped: !isAns,
      correctText: q.o[q.a],
      yourText:    isAns ? q.o[sel] : 'Not answered',
    });
  });

  const total    = questions.length;
  const wrong    = questionResults.filter(r => r.status === 'wrong').length;
  const skipped  = questionResults.filter(r => r.status === 'skipped').length;
  const pct      = Math.round(correct / total * 100);
  const timeUsed = Math.floor((Date.now() - session.startedAt) / 1000);

  return {
    total, correct, wrong, skipped, pct,
    grade:    pct >= 90?'A+':pct >= 80?'A':pct >= 70?'B+':pct >= 60?'B':pct >= 50?'C':'F',
    passed:   pct >= 50,
    timeUsed, timeUsedStr: `${String(Math.floor(timeUsed/60)).padStart(2,'0')}:${String(timeUsed%60).padStart(2,'0')}`,
    subjectScores, subjectTotals,
    questionResults,
    violationCount: session.violations?.length || 0,
  };
}

export function subjectPercent(scores, totals, name) {
  return totals[name] ? Math.round(scores[name] / totals[name] * 100) : 0;
}
