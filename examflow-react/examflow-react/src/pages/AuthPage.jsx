import { useState } from 'react';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import { SUBJECTS } from '../data/questions';
import styles from './AuthPage.module.css';

const FEATURES = [
  { key: '200', color: 'var(--ds)', label: '200 MCQ across 5 subjects' },
  { key: 'CAM', color: 'var(--os)', label: 'Live camera proctoring required' },
  { key: '120', color: 'var(--dsa)', label: '120-minute timed examination' },
  { key: 'LIVE',color: 'var(--ml)', label: 'Live score tracking per subject' },
];

export default function AuthPage() {
  const [mode, setMode] = useState('login');

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        {/* Left Panel */}
        <div className={styles.left}>
          <div className={styles.brand}>
            <div className={styles.brandRow}>
              <div className={styles.brandMk}>E</div>
              <span className={styles.brandNm}>Exam<em>Flow</em></span>
            </div>
            <div className={styles.bcaBadge}>BCA Programme 2023-2026</div>
            <div className={styles.tagline}>Your gateway to academic excellence.</div>
            <div className={styles.sub}>Secure, proctored online examinations for BCA students. Complete 200-question assessment with real-time camera monitoring.</div>
            <div className={styles.features}>
              {FEATURES.map(f => (
                <div key={f.key} className={styles.featureItem}>
                  <div className={styles.featureIcon} style={{ background:`rgba(${f.color === 'var(--ds)' ? '79,126,248' : f.color === 'var(--os)' ? '15,184,164' : f.color === 'var(--dsa)' ? '168,85,247' : '249,115,22'},.15)`, color:f.color }}>{f.key}</div>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.subjects}>
            <div className={styles.subjectsLabel}>Exam Subjects</div>
            <div className={styles.subjectPills}>
              {SUBJECTS.map(s => <span key={s.key} className={styles.pill} style={{ color:s.color, borderColor:s.color+'55' }}>{s.name}</span>)}
            </div>
          </div>
        </div>
        {/* Right Panel */}
        <div className={styles.right}>
          {mode === 'login'
            ? <LoginForm onSwitch={() => setMode('register')} />
            : <RegisterForm onSwitch={() => setMode('login')} />
          }
        </div>
      </div>
    </div>
  );
}
