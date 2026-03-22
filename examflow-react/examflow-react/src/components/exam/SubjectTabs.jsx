import { SUBJECTS } from '../../data/questions';
import styles from './SubjectTabs.module.css';

export default function SubjectTabs({ currentSubject, answers, isMock, onSwitch, perSub }) {
  return (
    <div className={styles.tabs}>
      {SUBJECTS.map((s, i) => {
        const start = i * perSub;
        const count = Object.entries(answers).filter(([idx, v]) => parseInt(idx) >= start && parseInt(idx) < start + perSub && v !== undefined && v !== -1).length;
        const isActive = i === currentSubject;
        return (
          <button key={s.key} className={`${styles.tab} ${isActive ? styles.active : ''}`}
                  style={{ '--sc': s.color }} onClick={() => onSwitch(i)}>
            <span className={styles.dot} style={{ background: s.color }} />
            <span className={styles.name}>{s.name}</span>
            <span className={`${styles.cnt} ${isActive ? styles.cntActive : ''}`}>{count}/{perSub}</span>
          </button>
        );
      })}
    </div>
  );
}
