import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { MAIN_QUESTIONS, MOCK_QUESTIONS, SUBJECTS } from '../data/questions';
import { useExamTimer, useExamNavigation, useAnswerSheet, useProctoringMonitor } from '../hooks/useExam';
import QuestionCard from '../components/exam/QuestionCard';
import QuestionGrid from '../components/exam/QuestionGrid';
import SubjectTabs from '../components/exam/SubjectTabs';
import CameraFeed from '../components/proctoring/CameraFeed';
import Button from '../components/ui/Button';
import styles from './ExamPage.module.css';

export default function ExamPage() {
  const { user, examSession, submitExam, showToast } = useApp();
  const navigate = useNavigate();
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const isMock     = examSession?.examType === 'mock';
  const questions  = isMock ? MOCK_QUESTIONS : MAIN_QUESTIONS;
  const totalQ     = questions.length;
  const perSub     = isMock ? 20 : 40;

  const { current, visited, go, next, prev, goSubject } = useExamNavigation(totalQ, isMock);
  const { answers, flags, setAnswer, clearAnswer, toggleFlag, answeredCount, flaggedCount, skippedCount } = useAnswerSheet(totalQ);
  const currentSubject = Math.floor(current / perSub);

  const handleExpire = useCallback(() => {
    showToast('warning', 'Time is up! Submitting exam...');
    doSubmit();
  }, []);

  const handleWarn = useCallback((rem) => {
    const mins = Math.floor(rem / 60);
    showToast('warning', `⏱ ${mins > 0 ? mins + ' minutes' : rem + ' seconds'} remaining!`);
  }, []);

  const timer = useExamTimer(examSession?.duration || 7200, handleExpire, handleWarn);
  const { logViolation, violations } = useProctoringMonitor(examSession?.id, (v) => {
    showToast('warning', `Proctoring: ${v.message}`);
  });

  useEffect(() => {
    if (!examSession) { navigate('/dashboard'); return; }
    timer.start();
  }, []);

  const doSubmit = useCallback(() => {
    timer.stop();
    const result = submitExam({ ...examSession, answers, flags, violations }, questions);
    navigate('/results');
  }, [examSession, answers, flags, violations, questions, timer, submitExam, navigate]);

  if (!examSession) return null;

  const q = questions[current];
  const progressPct = (answeredCount / totalQ) * 100;
  const subjectAnswered = (si) => Object.entries(answers).filter(([idx,v]) => parseInt(idx)>=si*perSub && parseInt(idx)<(si+1)*perSub && v!==undefined && v!==-1).length;

  return (
    <div className={styles.page}>
      {/* Top Navbar */}
      <nav className={styles.nb} style={{ '--pg': progressPct + '%' }}>
        <div className={styles.nbL}>
          <div className={styles.logo}><div className={styles.logoMk}>E</div><span className={styles.logoNm}>Exam<em>Flow</em></span></div>
        </div>
        <div className={styles.nbC}>
          <div className={styles.nbTitle}>{examSession.title}</div>
          <div className={styles.nbMeta}>
            <span>Q {current+1}<span className={styles.sep}>/</span>{totalQ}</span>
            <span className={styles.sep}>·</span>
            <span>{answeredCount} answered</span>
            <span className={styles.sep}>·</span>
            <span>{user?.first} {user?.last} — {user?.roll}</span>
          </div>
        </div>
        <div className={styles.nbR}>
          <div className={styles.progress}>
            <div className={styles.progressBar}><div className={styles.progressFill} style={{ width:progressPct+'%' }}/></div>
            <span className={styles.progressLbl}>{answeredCount}/{totalQ}</span>
          </div>
          <div className={`${styles.timerChip} ${styles[timer.urgency]}`}>
            {timer.timeStr}
          </div>
          <Button size="sm" onClick={() => setShowSubmitModal(true)}>Submit</Button>
          <div className={styles.userChip}>
            <div className={styles.userAv}>{user?.avatar || user?.first?.[0]}</div>
            <div><div className={styles.userName}>{user?.first}</div><div className={styles.userRoll}>{user?.roll}</div></div>
          </div>
        </div>
      </nav>

      {/* Subject Tabs */}
      <SubjectTabs currentSubject={currentSubject} answers={answers} isMock={isMock} perSub={perSub} onSwitch={goSubject} />

      {/* Three-column layout */}
      <div className={styles.layout}>
        {/* Left Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.studentCard}>
            <div className={styles.scAv}>{user?.avatar || user?.first?.[0]}</div>
            <div><div className={styles.scName}>{user?.first} {user?.last}</div><div className={styles.scRoll}>{user?.roll}</div></div>
          </div>

          <div className={styles.sectionLabel}>Subject Progress</div>
          {SUBJECTS.map((s,i) => {
            const cnt = subjectAnswered(i);
            const pct = cnt / perSub * 100;
            return (
              <div key={s.key} className={styles.subProg}>
                <div className={styles.subProgRow}>
                  <span className={styles.subProgName} style={{ color:s.color }}>{s.name}</span>
                  <span className={styles.subProgCnt}>{cnt}/{perSub}</span>
                </div>
                <div className={styles.subProgBar}><div className={styles.subProgFill} style={{ width:pct+'%', background:s.color }}/></div>
              </div>
            );
          })}

          <div className={styles.sectionLabel}>Legend</div>
          <div className={styles.legend}>
            {[['ans0','Answered'],['cur','Current'],['flagged','Flagged'],['qb','Unanswered']].map(([c,l]) => (
              <div key={c} className={styles.legItem}><span className={`${styles.legDot} ${styles[c]}`}/>{l}</div>
            ))}
          </div>

          <div className={styles.sectionLabel}>Navigator</div>
          <QuestionGrid total={totalQ} current={current} answers={answers} flags={flags} isMock={isMock} onJump={go} />

          <div className={styles.summary}>
            <div className={styles.summaryRow}><span className={styles.sk}>Answered</span><span className={`${styles.sv} ${styles.svGreen}`}>{answeredCount}</span></div>
            <div className={styles.summaryRow}><span className={styles.sk}>Flagged</span><span className={`${styles.sv} ${styles.svYellow}`}>{flaggedCount}</span></div>
            <div className={styles.summaryRow}><span className={styles.sk}>Remaining</span><span className={`${styles.sv} ${styles.svRed}`}>{skippedCount}</span></div>
          </div>
        </aside>

        {/* Main Content */}
        <main className={styles.main}>
          <div className={styles.subHeader} style={{ borderLeft: `3px solid ${SUBJECTS[currentSubject]?.color}` }}>
            <div className={styles.subIcon} style={{ color:SUBJECTS[currentSubject]?.color }}>{SUBJECTS[currentSubject]?.icon}</div>
            <div>
              <div className={styles.subName} style={{ color:SUBJECTS[currentSubject]?.color }}>{SUBJECTS[currentSubject]?.name}</div>
              <div className={styles.subDesc}>{SUBJECTS[currentSubject]?.desc}</div>
            </div>
            <span className={styles.subRange}>{SUBJECTS[currentSubject]?.range}</span>
          </div>

          <QuestionCard question={q} index={current} selected={answers[current]} isFlagged={flags[current]}
                        onSelect={(_, val) => setAnswer(current, val)} onFlag={toggleFlag} />

          <div className={styles.qFooter}>
            <div className={styles.navBtns}>
              <Button variant="ghost" size="sm" onClick={prev} disabled={current === 0}>← Prev</Button>
              <Button variant="primary" size="sm" onClick={next}>
                {current === totalQ-1 ? 'Finish' : 'Next →'}
              </Button>
            </div>
            <div className={styles.goNav}>
              <input className={styles.goInput} type="number" min={1} max={totalQ} placeholder={`Go#`}
                     onKeyDown={e => { if(e.key==='Enter') { const v=parseInt(e.target.value); if(v>=1&&v<=totalQ){go(v-1);e.target.value='';} } }} />
            </div>
            <button className={styles.clearBtn} onClick={() => clearAnswer(current)}>Clear</button>
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className={styles.rightSidebar}>
          {/* Timer widget */}
          <div className={`${styles.timerWidget} ${styles[timer.urgency+'Widget']}`}>
            <div className={styles.timerLabel}>Time Remaining</div>
            <div className={styles.timerDisplay}>
              <svg width="88" height="88" viewBox="0 0 88 88" style={{ transform:'rotate(-90deg)', position:'absolute', top:0, left:0 }}>
                <circle cx="44" cy="44" r="37" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="5"/>
                <circle cx="44" cy="44" r="37" fill="none" strokeWidth="5" strokeLinecap="round"
                        stroke={timer.urgency==='critical'?'var(--danger)':timer.urgency==='warning'?'var(--warn)':'var(--safe)'}
                        strokeDasharray="232.48"
                        strokeDashoffset={232.48 * (1 - (timer.remaining / (examSession?.duration||7200)))} />
              </svg>
              <div className={styles.timerInner} style={{ color:timer.urgency==='critical'?'var(--danger)':timer.urgency==='warning'?'var(--warn)':'var(--safe)' }}>
                <span className={styles.timerMins}>{timer.timeStr.split(':')[0]}<small>min</small></span>
                <span className={styles.timerSep}>:</span>
                <span className={styles.timerSecs}>{timer.timeStr.split(':')[1]}<small>sec</small></span>
              </div>
            </div>
            <span className={`${styles.timerBadge} ${styles[timer.urgency+'Badge']}`}>
              {timer.urgency==='critical'?'Critical!':timer.urgency==='warning'?'Hurry!':'In Progress'}
            </span>
          </div>

          {/* Camera */}
          <CameraFeed onViolation={logViolation} autoConnect={true} />

          {/* Live score */}
          <div className={styles.scoreCard}>
            <div className={styles.scoreLabel}>Live Progress</div>
            <div className={styles.scoreBig}><span className={styles.scoreN}>{answeredCount}</span><span className={styles.scoreD}>/{totalQ}</span></div>
            <div className={styles.scorePct}>{Math.round(answeredCount/totalQ*100)}% Complete</div>
            {SUBJECTS.map((s,i) => (
              <div key={s.key} className={styles.ssRow}>
                <div className={styles.ssDot} style={{ background:s.color }}/>
                <span className={styles.ssName}>{s.name}</span>
                <span className={styles.ssVal}>{subjectAnswered(i)}/{perSub}</span>
              </div>
            ))}
          </div>

          {/* Violations */}
          {violations.length > 0 && (
            <div className={styles.violCard}>
              <div className={styles.violTitle}>⚠ Violations: {violations.length}</div>
              {violations.slice(-3).map(v => <div key={v.id} className={styles.violItem}>{v.message}</div>)}
            </div>
          )}
        </aside>
      </div>

      {/* Submit Modal */}
      {showSubmitModal && (
        <div className={styles.modalOverlay} onClick={() => setShowSubmitModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}>📋</div>
            <div className={styles.modalTitle}>Submit Examination?</div>
            <div className={styles.modalSub}>You are about to submit. This cannot be undone.</div>
            <div className={styles.modalStats}>
              {[['Answered',answeredCount,'var(--tx)'],['Flagged',flaggedCount,'var(--warn)'],['Unanswered',skippedCount,'var(--danger)'],['Time Left',timer.timeStr,'var(--tl)']].map(([k,v,c]) => (
                <div key={k} className={styles.modalStat}><div className={styles.msv} style={{ color:c }}>{v}</div><div className={styles.msk}>{k}</div></div>
              ))}
            </div>
            <div className={styles.modalBtns}>
              <Button variant="ghost" onClick={() => setShowSubmitModal(false)}>Go Back</Button>
              <Button variant="primary" onClick={doSubmit}>Submit All {totalQ}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
