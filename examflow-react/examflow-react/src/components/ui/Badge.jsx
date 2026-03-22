import styles from './Badge.module.css';
import { clsx } from '../../utils/helpers';

export default function Badge({ children, variant='default', size='sm', className }) {
  return <span className={clsx(styles.badge, styles[variant], styles[size], className)}>{children}</span>;
}
