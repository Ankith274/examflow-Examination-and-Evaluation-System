import { useApp } from '../../context/AppContext';
import styles from './Toast.module.css';

const ICONS = { success:'✓', error:'✕', warning:'⚠', info:'ℹ' };

export default function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <div className={`${styles.toast} ${styles[toast.type]}`}>
      <span className={styles.icon}>{ICONS[toast.type] || ICONS.info}</span>
      <span>{toast.message}</span>
    </div>
  );
}
