import { useCallback, useState } from 'react';
import { useUIStore, Toast as ToastType } from '../stores/uiStore';
import { Info, CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';
import styles from './Toast.module.css';

const ToastItem = ({ toast }: { toast: ToastType }) => {
  const removeToast = useUIStore((s) => s.removeToast);
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => removeToast(toast.id), 200);
  }, [removeToast, toast.id]);

  const Icon = {
    info: Info,
    success: CheckCircle,
    warn: AlertTriangle,
    error: XCircle,
  }[toast.type];

  return (
    <div className={`${styles.toast} ${styles[toast.type]} ${isExiting ? styles.exit : ''}`}>
      <div className={styles.icon}>
        <Icon size={18} />
      </div>
      <div className={styles.message}>{toast.message}</div>
      <button className={styles.close} onClick={handleClose}>
        <X size={14} />
      </button>
    </div>
  );
};

export const ToastContainer = () => {
  const toasts = useUIStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
};
