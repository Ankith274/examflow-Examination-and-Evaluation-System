import { clsx } from '../../utils/helpers';
import styles from './Input.module.css';

export default function Input({ label, error, hint, className, ...props }) {
  return (
    <div className={styles.group}>
      {label && <label className={styles.label}>{label}</label>}
      <input className={clsx(styles.input, error && styles.hasError, className)} {...props} />
      {error && <span className={styles.error}>{error}</span>}
      {hint && !error && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
