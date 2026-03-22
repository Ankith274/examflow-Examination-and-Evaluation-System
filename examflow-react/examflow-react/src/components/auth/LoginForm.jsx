import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { DEMO_ACCOUNTS } from '../../data/questions';
import Button from '../ui/Button';
import Input from '../ui/Input';
import styles from './Auth.module.css';

const DEMO_COLORS = ['#4f7ef8','#0fb8a4','#a855f7','#f97316'];

export default function LoginForm({ onSwitch }) {
  const [id, setId]     = useState('');
  const [pw, setPw]     = useState('');
  const [err, setErr]   = useState('');
  const { login, isLoading } = useApp();
  const navigate = useNavigate();

  const doLogin = async (rid = id, rpw = pw) => {
    setErr('');
    if (!rid) { setErr('Please enter your roll number or email'); return; }
    if (!rpw) { setErr('Please enter your password'); return; }
    const { success, error } = await login(rid, rpw);
    if (success) navigate('/dashboard');
    else setErr(error || 'Invalid credentials');
  };

  const fillDemo = (roll, password) => {
    setId(roll); setPw(password);
    setTimeout(() => doLogin(roll, password), 100);
  };

  return (
    <div className={styles.form}>
      <div className={styles.formTitle}>Welcome back</div>
      <div className={styles.formSub}>Sign in to your BCA 2023-2026 examination portal.</div>

      <div className={styles.demoSection}>
        <div className={styles.demoLabel}>Demo Accounts — Click to login instantly</div>
        <div className={styles.demoGrid}>
          {DEMO_ACCOUNTS.slice(0,4).map((acc, i) => (
            <button key={acc.roll} className={styles.demoTile} onClick={() => fillDemo(acc.roll, acc.password)}
                    style={{ '--tile-color': DEMO_COLORS[i] }}>
              <div className={styles.demoAv} style={{ background: DEMO_COLORS[i] }}>
                {acc.avatar || (acc.first[0] + (acc.last?.[0]||''))}
              </div>
              <div>
                <div className={styles.demoName}>{acc.first} {acc.last}</div>
                <div className={styles.demoCreds} style={{ color: DEMO_COLORS[i] }}>{acc.roll} / {acc.password}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Input label="Roll Number / Email" value={id} onChange={e => setId(e.target.value)}
             placeholder="e.g. 2320520034" type="text" />
      <div style={{ height: 12 }} />
      <Input label="Password" value={pw} onChange={e => setPw(e.target.value)}
             placeholder="Enter your password" type="password"
             onKeyDown={e => e.key === 'Enter' && doLogin()} />
      {err && <div className={styles.errorMsg}>{err}</div>}

      <div style={{ height: 14 }} />
      <Button variant="primary" size="xl" onClick={() => doLogin()} loading={isLoading}>Sign In →</Button>
      <div className={styles.divider}><span className={styles.divLine}/><span className={styles.divTxt}>OR</span><span className={styles.divLine}/></div>
      <Button variant="secondary" size="xl" onClick={() => fillDemo('2320520034','ankith123')} loading={isLoading}>
        ⚡ One-Click Demo Login (Ankith Reddy)
      </Button>

      <div className={styles.switchRow}>
        New student? <button className={styles.switchLink} onClick={onSwitch}>Create account →</button>
      </div>
    </div>
  );
}
