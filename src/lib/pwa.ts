/**
 * PWA Service Worker Registration & Install Prompt Manager
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[Money Flow PWA] Service Worker registered:', reg.scope);

          // Listen for updates
          reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (installing) {
              installing.addEventListener('statechange', () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[Money Flow PWA] New update available.');
                }
              });
            }
          });
        })
        .catch((err) => {
          console.error('[Money Flow PWA] Service Worker registration failed:', err);
        });
    });

    // Capture install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e as BeforeInstallPromptEvent;
      window.dispatchEvent(new CustomEvent('pwa-installable', { detail: true }));
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      window.dispatchEvent(new CustomEvent('pwa-installed'));
      console.log('[Money Flow PWA] App successfully installed on device.');
    });
  }
}

export async function promptPWAInstall(): Promise<boolean> {
  if (!deferredInstallPrompt) {
    return false;
  }
  await deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  return choice.outcome === 'accepted';
}

export function isPWAInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true
  );
}
