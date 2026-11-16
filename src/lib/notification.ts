import { formatINR } from './formatters';

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  return await Notification.requestPermission();
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function triggerCategorizationNotification(params: {
  amount: number;
  merchant: string;
  transactionId?: string;
}) {
  const { amount, merchant, transactionId } = params;
  const formattedAmt = formatINR(amount);
  const title = `${formattedAmt} spent at ${merchant}`;
  const body = 'Tap to categorize where you spent this money.';
  const url = transactionId ? `/?categorize=${transactionId}` : '/';

  // Haptic feedback if supported
  if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
    try {
      navigator.vibrate([100, 50, 100]);
    } catch {
      // Ignore vibration error
    }
  }

  // Check if Service Worker is active for rich notification
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg && Notification.permission === 'granted') {
        const options: any = {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [100, 50, 100],
          data: { url },
          tag: `categorize-${transactionId || Date.now()}`,
          renotify: true,
        };
        await reg.showNotification(title, options);
        return;
      }
    } catch (e) {
      console.warn('SW notification failed, falling back to standard notification:', e);
    }
  }

  // Fallback to standard window Notification
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    const notif = new Notification(title, {
      body,
      icon: '/icon-192.png',
    });
    notif.onclick = () => {
      window.focus();
      notif.close();
      if (transactionId) {
        window.dispatchEvent(new CustomEvent('open-categorize-prompt', { detail: { transactionId } }));
      }
    };
  }
}
