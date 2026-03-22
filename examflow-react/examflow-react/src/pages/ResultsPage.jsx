import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { SUBJECTS } from '../data/questions';
import { getRank } from '../utils/helpers';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import styles from './ResultsPage.module.css';

const GRADE_COLORS = { 'A+':'#1db854','A':'#4f7ef8','B+':'#0fb8a4','B':'#7aa2fb','C':'#f0a500','F':'#e8404a' };

export default function ResultsPage() {
  const { user, examResult, logout } = useApp();
  const navigate = useNavigate();
  const ringRef = useRef(null);

  useEffect(() => {
    if (!examResult) { navigate('/dashboard'); return; }
    if (ringRef.current) {
      setTimeout(() => {
        const pct = examResult.percentage;
        ringRef.current.style.setProperty('--pct', pct / 100);
      }, 300);
    }
  }, []);

  if (!examResult) return null;
  const r = examResult;
  const gc = GRADE_COLORS[r.grade] || '#7aa2fb';
  const rank = getRank(r.percentage);

  const subjectData = SUBJECTS.map(s => ({
    name: s.name.split(' ')[0],
    score: r.subjectScores?.[s.name] || 0,
    total: r.subjectTotals?.[s.name] || (r.examType==='mock'?20:40),
    pct:   r.subjectTotals?.[s.name] ? Math.round((r.subjectScores?.[s.name]||0)/r.subjectTotals[s.name]*100) : 0,
    fill:  s.color,
  }));

  const diffData = [
    { name:'Easy',   score:Math.round(r.correct*0.45), total:Math.round(r.total*0.4), fill:'var(--safe)' },
    { name:'Medium', score:Math.round(r.correct*0.4),  total:Math.round(r.total*0.45),fill:'var(--warn)'  },
    { name:'Hard',   score:Math.round(r.correct*0.15), total:Math.round(r.total*0.15),fill:'var(--danger)'},
  ];

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.navLogo}><div className={styles.logoMk}>E</div><span className={styles.logoNm}>Exam<em>Flow</em></span></div>
        <div className={styles.navBadge}>Result</div>
        <div className={styles.navRight}>
          <div className={styles.userPill}>
            <div className={styles.userAv}>{user?.avatar||user?.first?.[0]}</div>
            <div><div className={styles.userName}>{user?.first} {user?.last}</div><div className={styles.userRoll}>{user?.roll}</div></div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => navigate('/dashboard')}>Dashboard</Button>
          <button className={styles.logoutBtn} onClick={logout}>Logout</button>
        </div>
      </nav>

      <div className={styles.content}>
        <div className={styles.pageTitle}>Exam Result</div>
        <div className={styles.pageSub}>{r.title}</div>

        {/* Hero Score */}
        <div className={styles.hero}>
          <div className={styles.scoreRing} ref={ringRef} style={{ '--pct':0, '--gc':gc }}>
            <svg width="150" height="150" viewBox="0 0 150 150">
              <circle cx="75" cy="75" r="64" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="8"/>
              <circle cx="75" cy="75" r="64" fill="none" strokeWidth="8" strokeLinecap="round"
                      stroke={gc} strokeDasharray="402.12"
                      strokeDashoffset={402.12 * (1 - r.percentage/100)}
                      style={{ transform:'rotate(-90deg)', transformOrigin:'75px 75px', transition:'stroke-dashoffset 1.5s ease' }} />
            </svg>
            <div className={styles.ringCenter}><div className={styles.ringPct} style={{ color:gc }}>{r.percentage}%</div><div className={styles.ringLbl}>Score</div></div>
          </div>
          <div className={styles.heroInfo}>
            <div className={styles.heroScore}>{r.correct}<span>/{r.total}</span></div>
            <div className={styles.heroGrade} style={{ color:gc }}>Grade {r.grade} — {rank}</div>
            <div className={styles.heroBadge} style={{ borderColor:gc, color:gc }}>{r.passed ? '✓ PASS' : '✗ FAIL'}</div>
            <div className={styles.heroMeta}>
              <span>Correct: <strong style={{color:'var(--safe)'}}>{r.correct}</strong></span>
              <span>Wrong: <strong style={{color:'var(--danger)'}}>{r.wrong}</strong></span>
              <span>Skipped: <strong style={{color:'var(--warn)'}}>{r.skipped}</strong></span>
              <span>Time: <strong>{r.timeUsedStr}</strong></span>
              {r.violationCount > 0 && <span>Violations: <strong style={{color:'var(--warn)'}}>{r.violationCount}</strong></span>}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className={styles.statsRow}>
          {[['correct','Correct',r.correct,'var(--safe)'],['wrong','Wrong',r.wrong,'var(--danger)'],['skipped','Skipped',r.skipped,'var(--warn)'],['time','Time Used',r.timeUsedStr,'var(--a2)']].map(([k,l,v,c]) => (
            <div key={k} className={styles.statCard}><div className={styles.statVal} style={{color:c}}>{v}</div><div className={styles.statKey}>{l}</div></div>
          ))}
        </div>

        {/* Subject breakdown */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Subject Performance</div>
          <div className={styles.subjectCards}>
            {SUBJECTS.map((s,i) => {
              const d = subjectData[i];
              return (
                <div key={s.key} className={styles.subCard}>
                  <div className={styles.subCardVal} style={{color:s.color}}>{d.score}/{d.total}</div>
                  <div className={styles.subCardName}>{s.icon}</div>
                  <div className={styles.subCardLabel}>{s.name.split(' ')[0]}</div>
                  <div className={styles.subCardBar}><div className={styles.subCardFill} style={{width:d.pct+'%',background:s.color}}/></div>
                  <div className={styles.subCardPct} style={{color:s.color}}>{d.pct}%</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Subject Score Comparison</div>
          <div className={styles.chart}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={subjectData} margin={{ top:10, right:10, left:-20, bottom:10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                <XAxis dataKey="name" tick={{ fill:'#6b7f9a', fontSize:11 }} />
                <YAxis domain={[0,100]} tick={{ fill:'#6b7f9a', fontSize:10 }} />
                <Tooltip contentStyle={{ background:'#0b1221', border:'1px solid rgba(255,255,255,.08)', borderRadius:8, color:'#d8e4f8' }}
                         formatter={(v) => [v+'%','Score']} />
                <Bar dataKey="pct" radius={[4,4,0,0]}>
                  {subjectData.map((d,i) => <rect key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Exam details */}
        <div className={styles.detailCard}>
          <div className={styles.detailTitle}>Exam Summary</div>
          {[
            ['Student', `${user?.first} ${user?.last}`],
            ['Roll No.', user?.roll],
            ['Programme', user?.branch || 'BCA'],
            ['Batch', user?.batch || '2023-2026'],
            ['Exam', r.title],
            ['Total Score', `${r.correct} / ${r.total}`],
            ['Percentage', `${r.percentage}%`],
            ['Grade', r.grade],
            ['Rank', rank],
            ['Correct', r.correct],
            ['Wrong', r.wrong],
            ['Skipped', r.skipped],
            ['Time Used', r.timeUsedStr],
            ['Violations', r.violationCount + ' recorded'],
            ['Result', r.passed ? 'PASSED ✓' : 'FAILED ✗'],
          ].map(([k,v]) => (
            <div key={k} className={styles.detailRow}>
              <span className={styles.detailKey}>{k}</span>
              <span className={styles.detailVal} style={k==='Result'?{color:r.passed?'var(--safe)':'var(--danger)'}:{}}>{v}</span>
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <Button variant="primary" size="lg" onClick={() => navigate('/dashboard')}>← Back to Dashboard</Button>
        </div>
      </div>
    </div>
  );
}
