import { clsx } from '../../utils/helpers';
import styles from './Button.module.css';

export default function Button({ children, variant='primary', size='md', loading=false, disabled=false, onClick, type='button', className, ...props }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(styles.btn, styles[variant], styles[size], loading && styles.loading, className)}
      {...props}
    >
      {loading ? <span className={styles.spinner} /> : children}
    </button>
  );
}
