import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { validateRoll, validateEmail, validatePassword, passwordStrength } from '../../utils/helpers';
import Button from '../ui/Button';
import Input from '../ui/Input';
import styles from './Auth.module.css';

const AVATARS = ['AR','PS','RK','SP','DR','EN','GO','TG'];
const BRANCHES = ['BCA','BCA-DS','BCA-AI','BSc-CS','BSc-IT'];
const BATCHES  = ['2023-2026','2022-2025','2024-2027','2021-2024'];

export default function RegisterForm({ onSwitch }) {
  const [form, setForm]     = useState({ first:'',last:'',roll:'',email:'',branch:'BCA',batch:'2023-2026',password:'',confirm:'', avatar:'AR' });
  const [errs, setErrs]     = useState({});
  const [terms, setTerms]   = useState(false);
  const { register, isLoading } = useApp();
  const navigate = useNavigate();
  const strength = passwordStrength(form.password);

  const set = (k,v) => setForm(f => ({ ...f, [k]: v }));

  const doRegister = async () => {
    const newErrs = {};
    if (!validateRoll(form.roll))        newErrs.roll     = 'Roll number must be exactly 10 digits';
    if (!validateEmail(form.email))      newErrs.email    = 'Enter a valid email address';
    const pv = validatePassword(form.password);
    if (!pv.valid)                        newErrs.password = pv.msg;
    if (form.password !== form.confirm)  newErrs.confirm  = 'Passwords do not match';
    if (!terms)                           newErrs.terms    = 'Please accept the Terms & camera permission';
    setErrs(newErrs);
    if (Object.keys(newErrs).length) return;
    const { success, error } = await register(form);
    if (success) navigate('/dashboard');
    else setErrs({ roll: error });
  };

  return (
    <div className={styles.form}>
      <div className={styles.formTitle}>Create Account</div>
      <div className={styles.formSub}>Register as a BCA 2023-2026 student to access ExamFlow.</div>

      <div className={styles.row}>
        <Input label="First Name" value={form.first} onChange={e => set('first',e.target.value)} placeholder="Ankith" />
        <Input label="Last Name"  value={form.last}  onChange={e => set('last',e.target.value)}  placeholder="Reddy" />
      </div>

      <div style={{ height: 10 }} />
      <Input label="Roll Number" value={form.roll} onChange={e => set('roll',e.target.value)}
             placeholder="2320520034" maxLength={10} error={errs.roll} />
      <div style={{ height: 10 }} />
      <Input label="Email Address" value={form.email} onChange={e => set('email',e.target.value)}
             placeholder="ankith@college.edu" type="email" error={errs.email} />

      <div className={styles.row} style={{ marginTop: 10 }}>
        <div className={styles.selectWrap}>
          <label className={styles.selectLabel}>Programme</label>
          <select className={styles.select} value={form.branch} onChange={e => set('branch',e.target.value)}>
            {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className={styles.selectWrap}>
          <label className={styles.selectLabel}>Batch</label>
          <select className={styles.select} value={form.batch} onChange={e => set('batch',e.target.value)}>
            {BATCHES.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div className={styles.selectLabel}>Choose Avatar</div>
        <div className={styles.avatarGrid}>
          {AVATARS.map(av => (
            <button key={av} className={`${styles.avatarOpt} ${form.avatar===av?styles.avatarSel:''}`}
                    onClick={() => set('avatar',av)}>{av}</button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <Input label="Password" value={form.password} onChange={e => set('password',e.target.value)}
               placeholder="Min 8 characters" type="password" error={errs.password} />
        {form.password && (
          <div className={styles.strengthBar}>
            <div className={styles.strengthFill} style={{ width: strength.pct+'%', background: strength.color }} />
          </div>
        )}
        {form.password && <div className={styles.strengthTxt} style={{ color: strength.color }}>{strength.label}</div>}
      </div>

      <div style={{ marginTop: 10 }}>
        <Input label="Confirm Password" value={form.confirm} onChange={e => set('confirm',e.target.value)}
               placeholder="Repeat password" type="password" error={errs.confirm} />
      </div>

      <div className={styles.termsRow} onClick={() => setTerms(t => !t)}>
        <div className={`${styles.checkbox} ${terms ? styles.checked : ''}`}>{terms && '✓'}</div>
        <span>I agree to the <span className={styles.termLink}>Terms of Service</span> and permit camera access during exams</span>
      </div>
      {errs.terms && <div className={styles.errorMsg}>{errs.terms}</div>}

      <div style={{ height: 14 }} />
      <Button variant="primary" size="xl" onClick={doRegister} loading={isLoading}>Create BCA Account</Button>

      <div className={styles.switchRow}>
        Already registered? <button className={styles.switchLink} onClick={onSwitch}>Sign in</button>
      </div>
    </div>
  );
}
