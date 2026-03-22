import styles from './QuestionCard.module.css';

const LABELS = ['A','B','C','D'];
const DIFF_CLS = { easy:'diffEasy', medium:'diffMed', hard:'diffHard' };

export default function QuestionCard({ question, index, selected, onSelect, onFlag, isFlagged, showResult=false }) {
  if (!question) return null;
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.qNum}>Q{index+1}</span>
        <div className={styles.tags}>
          <span className={`${styles.tag} ${styles[DIFF_CLS[question.diff]]}`}>{question.diff.charAt(0).toUpperCase()+question.diff.slice(1)}</span>
          <span className={styles.tag}>{question.sub}</span>
          <span className={styles.tag}>1 mark</span>
        </div>
        <button className={`${styles.flagBtn} ${isFlagged ? styles.flagOn : ''}`} onClick={() => onFlag?.(index)}>
          {isFlagged ? '🏴 Flagged' : '🏳 Flag'}
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.questionText}>{question.t}</div>
        <div className={styles.options}>
          {question.o.map((opt, i) => {
            let cls = styles.option;
            if (showResult) {
              if (i === question.a) cls += ' ' + styles.optCorrect;
              else if (i === selected && selected !== question.a) cls += ' ' + styles.optWrong;
            } else if (i === selected) {
              cls += ' ' + styles.optSelected;
            }
            return (
              <div key={i} className={cls} onClick={() => !showResult && onSelect?.(index, i)}>
                <div className={styles.optLabel}>{LABELS[i]}</div>
                <div className={styles.optText}>{opt}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
