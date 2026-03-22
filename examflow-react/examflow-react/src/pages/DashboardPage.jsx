import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { EXAMS, SUBJECTS } from '../data/questions';
import { getGrade } from '../utils/helpers';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
  const { user, results, startExam, logout } = useApp();
  const navigate = useNavigate();

  const mainResults = results.filter(r => r.examType === 'main');
  const mockResults = results.filter(r => r.examType === 'mock');
  const avgScore    = results.length ? Math.round(results.reduce((s,r) => s+r.percentage,0)/results.length) : 0;
  const bestScore   = results.length ? Math.max(...results.map(r => r.percentage)) : 0;

  const handleStart = (exam) => {
    startExam(exam);
    navigate('/exam');
  };

  return (
    <div className={styles.page}>
      {/* Navbar */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}><div className={styles.logoMk}>E</div><span className={styles.logoNm}>Exam<em>Flow</em></span></div>
        <div className={styles.navBadge}>BCA 2023-2026</div>
        <div className={styles.navRight}>
          <div className={styles.userPill}>
            <div className={styles.userAv}>{user?.avatar || user?.first?.[0] || 'U'}</div>
            <div><div className={styles.userName}>{user?.first} {user?.last}</div><div className={styles.userRoll}>{user?.roll}</div></div>
          </div>
          <button className={styles.logoutBtn} onClick={logout}>Logout</button>
        </div>
      </nav>

      <div className={styles.body}>
        {/* Welcome */}
        <div className={styles.welcome}>
          <div className={styles.greeting}>BCA 2023-2026 Portal</div>
          <div className={styles.hello}>Hello, <span>{user?.first}!</span></div>
          <div className={styles.subtitle}>Your comprehensive MCQ exams are ready. Camera proctoring required — make sure your webcam is available.</div>
        </div>

        {/* Stats */}
        <div className={styles.statsGrid}>
          {[
            { icon:'2', val:'2', label:'Exams Available', sub:'Ready now' },
            { icon:'Q', val:'200', label:'Total Questions', sub:'5 subjects' },
            { icon:'T', val:'120', label:'Minutes Allowed', sub:'2 hours' },
            { icon:'★', val: results.length ? bestScore+'%' : '—', label:'Best Score', sub: results.length ? getGrade(bestScore) : 'Not taken' },
          ].map((s,i) => (
            <div key={i} className={styles.stat}>
              <div className={styles.statIcon}>{s.icon}</div>
              <div className={styles.statVal}>{s.val}</div>
              <div className={styles.statLabel}>{s.label}</div>
              <div className={styles.statSub}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Exams + Profile */}
        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.cardHdr}><div><div className={styles.cardTitle}>Available Exams</div><div className={styles.cardSub}>Camera access required to start</div></div></div>
            <div className={styles.examList}>
              {EXAMS.map(exam => (
                <div key={exam.id} className={styles.examItem}>
                  <div className={styles.examIcon} style={{ background: exam.color }}>
                    {exam.type === 'main' ? 'EX' : 'M2'}
                  </div>
                  <div className={styles.examInfo}>
                    <div className={styles.examTitle}>{exam.title}</div>
                    <div className={styles.examMeta}>
                      <span>{exam.questions} Questions</span>
                      <span>·</span><span>5 Subjects</span>
                      <span>·</span><span>{exam.duration} min</span>
                      <span>·</span>
                      <Badge variant="success">Available</Badge>
                      {exam.type === 'mock' && <Badge variant="info">Mock</Badge>}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => handleStart(exam)}>Start</Button>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHdr}><div className={styles.cardTitle}>Student Profile</div></div>
            <div className={styles.profile}>
              <div className={styles.profTop}>
                <div className={styles.profAv}>{user?.avatar || user?.first?.[0]}</div>
                <div><div className={styles.profName}>{user?.first} {user?.last}</div><div className={styles.profRoll}>{user?.roll}</div></div>
              </div>
              <div className={styles.profRows}>
                {[['Programme',user?.branch||'BCA'],['Batch',user?.batch||'2023-2026'],['Email',user?.email||'—'],['Camera','Required'],['Status','Active']].map(([k,v]) => (
                  <div key={k} className={styles.profRow}><span className={styles.profKey}>{k}</span><span className={styles.profVal}>{v}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Subject Overview */}
        <div className={styles.card}>
          <div className={styles.cardHdr}><div><div className={styles.cardTitle}>Exam Subjects Overview</div><div className={styles.cardSub}>BCA 2023-2026 — 40 questions per subject</div></div><Button size="sm" onClick={() => handleStart(EXAMS[0])}>Start Exam</Button></div>
          <div className={styles.subjectGrid}>
            {SUBJECTS.map((s,i) => {
              const subResults = results.flatMap(r => r.subjectScores?.[s.name] !== undefined ? [{ score:r.subjectScores[s.name], total:r.subjectTotals?.[s.name]||40 }] : []);
              const avg = subResults.length ? Math.round(subResults.reduce((a,r) => a + r.score/r.total*100, 0)/subResults.length) : [82,76,70,80,72][i];
              return (
                <div key={s.key} className={styles.subTile} style={{ background:`rgba(${['79,126,248','15,184,164','232,200,72','168,85,247','249,115,22'][i]},.09)`, borderColor:`rgba(${['79,126,248','15,184,164','232,200,72','168,85,247','249,115,22'][i]},.2)` }}>
                  <div className={styles.subIcon} style={{ color:s.color }}>{s.icon}</div>
                  <div className={styles.subName} style={{ color:s.color }}>{s.name}</div>
                  <div className={styles.subCount} style={{ color:s.color }}>40 MCQs</div>
                  <div className={styles.subBar}><div className={styles.subFill} style={{ width:avg+'%', background:s.color }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Results history */}
        {results.length > 0 && (
          <div className={styles.card}>
            <div className={styles.cardHdr}><div className={styles.cardTitle}>Recent Results</div></div>
            <div className={styles.examList}>
              {results.slice(-5).reverse().map(r => (
                <div key={r.id} className={styles.examItem}>
                  <div className={styles.examIcon} style={{ background:'rgba(255,255,255,.05)', fontSize:12 }}>{r.grade}</div>
                  <div className={styles.examInfo}>
                    <div className={styles.examTitle}>{r.title}</div>
                    <div className={styles.examMeta}><span>{r.correct}/{r.total}</span><span>·</span><span>{r.percentage}%</span><span>·</span><span>{r.timeUsedStr}</span></div>
                  </div>
                  <Badge variant={r.passed ? 'success' : 'danger'}>{r.passed ? 'PASS' : 'FAIL'}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
