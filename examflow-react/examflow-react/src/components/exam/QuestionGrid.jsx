import { SUBJECTS } from '../../data/questions';
import styles from './QuestionGrid.module.css';

export default function QuestionGrid({ total, current, answers, flags, isMock, onJump }) {
  const perSub = isMock ? 20 : 40;
  return (
    <div className={styles.grid}>
      {Array.from({ length: total }, (_, i) => {
        const si    = Math.floor(i / perSub);
        const ans   = answers[i];
        const isAns = ans !== undefined && ans !== -1;
        const isFlg = flags[i];
        const isCur = i === current;
        const cls   = [styles.qb, isCur && styles.cur, isFlg && styles.flagged, isAns && !isFlg && styles[`ans${si}`]].filter(Boolean).join(' ');
        return <button key={i} className={cls} onClick={() => onJump(i)}>{i+1}</button>;
      })}
    </div>
  );
}
