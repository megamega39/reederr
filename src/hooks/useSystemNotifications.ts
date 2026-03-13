import { useEffect } from 'react';
import { useUIStore } from '../stores/uiStore';
import { NotificationAPI } from '../services/api';

export function useSystemNotifications() {
  const addToast = useUIStore((s) => s.addToast);

  useEffect(() => {
    const unbind = NotificationAPI.onShowToast((message, type, duration) => {
      addToast(message, type, duration);
    });

    return () => unbind();
  }, [addToast]);
}
