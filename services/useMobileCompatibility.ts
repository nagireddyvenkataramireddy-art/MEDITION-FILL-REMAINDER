import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface DeviceDiagnostics {
  os: 'Android' | 'iOS' | 'iPadOS' | 'Desktop';
  browser: string;
  formFactor: 'Phone' | 'Tablet / Foldable' | 'Desktop';
  screenResolution: string;
  isStandalone: boolean;
  isOnline: boolean;
  isInstallable: boolean;
  swActive: boolean;
  pushSupported: boolean;
  pushSubscribed: boolean;
  notificationSupported: boolean;
  notificationPermission: NotificationPermission;
  offlineStorageReady: boolean;
  geolocationSupported: boolean;
  vibrationSupported: boolean;
  iosRequiresHomeScreenForPush: boolean;
}

export function useMobileCompatibility(externalNotificationPermission: NotificationPermission) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [swActive, setSwActive] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [screenSize, setScreenSize] = useState<{ w: number; h: number }>({
    w: typeof window !== 'undefined' ? window.innerWidth : 390,
    h: typeof window !== 'undefined' ? window.innerHeight : 844,
  });
  const [installBannerDismissed, setInstallBannerDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('medimind_install_banner_dismissed') === 'true';
    } catch {
      return false;
    }
  });
  const [compactMode, setCompactMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('medimind_compact_mode');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const detectDeviceInfo = useCallback(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return {
        os: 'Desktop' as const,
        browser: 'Browser',
        formFactor: 'Phone' as const,
      };
    }

    const ua = navigator.userAgent || '';
    const isIPad =
      /iPad/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isIPhone = /iPhone|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);

    let os: 'Android' | 'iOS' | 'iPadOS' | 'Desktop' = 'Desktop';
    if (isAndroid) os = 'Android';
    else if (isIPad) os = 'iPadOS';
    else if (isIPhone) os = 'iOS';

    let browser = 'Mobile Browser';
    if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
    else if (/EdgA|EdgiOS|Edg/i.test(ua)) browser = 'Microsoft Edge';
    else if (/FxiOS|Firefox/i.test(ua)) browser = 'Firefox';
    else if (/CriOS/i.test(ua)) browser = 'Chrome (iOS)';
    else if (/Chrome/i.test(ua)) browser = 'Google Chrome';
    else if (/Safari/i.test(ua)) browser = 'Apple Safari';

    const w = window.innerWidth;
    let formFactor: 'Phone' | 'Tablet / Foldable' | 'Desktop' = 'Phone';
    if (w >= 1100 && os === 'Desktop') {
      formFactor = 'Desktop';
    } else if (w >= 640 || isIPad) {
      formFactor = 'Tablet / Foldable';
    } else {
      formFactor = 'Phone';
    }

    return { os, browser, formFactor };
  }, []);

  const refreshDiagnostics = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
    setIsOnline(navigator.onLine);
    setScreenSize({ w: window.innerWidth, h: window.innerHeight });

    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const isReady = !!(reg && (reg.active || reg.installing || reg.waiting));
        setSwActive(isReady);

        if (reg && 'pushManager' in reg) {
          const sub = await reg.pushManager.getSubscription();
          setPushSubscribed(!!sub);
        }
      } catch {
        setSwActive(false);
      }
    }
  }, []);

  useEffect(() => {
    refreshDiagnostics();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleResize = () => {
      setScreenSize({ w: window.innerWidth, h: window.innerHeight });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('resize', handleResize);

    const interval = setInterval(refreshDiagnostics, 10000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
    };
  }, [refreshDiagnostics]);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstallable(false);
        setDeferredPrompt(null);
      }
      return outcome;
    } catch {
      return 'unavailable';
    }
  }, [deferredPrompt]);

  const dismissInstallBanner = useCallback(() => {
    setInstallBannerDismissed(true);
    try {
      localStorage.setItem('medimind_install_banner_dismissed', 'true');
    } catch {}
  }, []);

  const toggleCompactMode = useCallback((enabled: boolean) => {
    setCompactMode(enabled);
    try {
      localStorage.setItem('medimind_compact_mode', String(enabled));
    } catch {}
  }, []);

  const { os, browser, formFactor } = detectDeviceInfo();
  const notificationSupported = typeof window !== 'undefined' && 'Notification' in window;
  const pushSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window;
  const iosRequiresHomeScreenForPush =
    (os === 'iOS' || os === 'iPadOS') && !isStandalone;

  let offlineStorageReady = false;
  try {
    offlineStorageReady = typeof localStorage !== 'undefined' && typeof indexedDB !== 'undefined';
  } catch {
    offlineStorageReady = false;
  }

  const diagnostics: DeviceDiagnostics = {
    os,
    browser,
    formFactor,
    screenResolution: `${screenSize.w}×${screenSize.h}px`,
    isStandalone,
    isOnline,
    isInstallable,
    swActive,
    pushSupported,
    pushSubscribed,
    notificationSupported,
    notificationPermission: externalNotificationPermission,
    offlineStorageReady,
    geolocationSupported: typeof navigator !== 'undefined' && 'geolocation' in navigator,
    vibrationSupported: typeof navigator !== 'undefined' && 'vibrate' in navigator,
    iosRequiresHomeScreenForPush,
  };

  return {
    diagnostics,
    promptInstall,
    refreshDiagnostics,
    installBannerDismissed,
    dismissInstallBanner,
    compactMode,
    toggleCompactMode,
  };
}
