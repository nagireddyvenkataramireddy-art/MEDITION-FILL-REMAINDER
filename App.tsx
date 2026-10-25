
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Medication, LogEntry, VitalEntry, MoodEntry, Profile, SnoozeEntry, Appointment, FrequencyType, SoundType } from './types';
import Dashboard from './components/Dashboard';
import AddMedicationModal from './components/AddMedicationModal';
import HistoryView from './components/HistoryView';
import VitalsView from './components/VitalsView';
import AssistantView from './components/AssistantView';
import CareView from './components/CareView';
import SettingsModal from './components/SettingsModal';
import OnboardingModal from './components/OnboardingModal';
import NotificationModal from './components/NotificationModal';
import DuePillAlertModal from './components/DuePillAlertModal';
import DeviceCompatibilityModal from './components/DeviceCompatibilityModal';
import { playNotificationSound, initAudio, startStandbyAudioGuard, stopStandbyAudioGuard } from './services/audioService';
import { useMobileCompatibility } from './services/useMobileCompatibility';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Plus, Bell, Home, Calendar, Activity, ChevronDown, User, HeartPulse, MessageSquareText, Smartphone, Download, WifiOff } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format, addMinutes } from 'date-fns';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'care' | 'vitals' | 'chat'>('home');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  
  const safeParse = (key: string, fallback: any) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch (e) {
      return fallback;
    }
  };

  const [profiles] = useState<Profile[]>(() => 
    safeParse('medimind_profiles', [{ id: 'default', name: 'Myself', avatar: '👤', themeColor: 'blue' }])
  );
  
  const [activeProfileId] = useState<string>(() => 
    localStorage.getItem('medimind_active_profile') || 'default'
  );

  const [medications, setMedications] = useState<Medication[]>(() => safeParse('medimind_meds', []));
  const [logs, setLogs] = useState<LogEntry[]>(() => safeParse('medimind_logs', []));
  const [vitals, setVitals] = useState<VitalEntry[]>(() => safeParse('medimind_vitals', []));
  const [moods, setMoods] = useState<MoodEntry[]>(() => safeParse('medimind_moods', []));
  const [snoozedItems, setSnoozedItems] = useState<SnoozeEntry[]>(() => safeParse('medimind_snoozes', []));
  const [appointments, setAppointments] = useState<Appointment[]>(() => safeParse('medimind_appts', []));
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isCompatibilityModalOpen, setIsCompatibilityModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  
  // Real-time in-app pill due alert modal
  const [duePillAlert, setDuePillAlert] = useState<{ med: Medication; scheduledTime: string } | null>(null);

  // Phone Notification States
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const {
    diagnostics,
    promptInstall,
    refreshDiagnostics,
    installBannerDismissed,
    dismissInstallBanner,
    compactMode,
    toggleCompactMode,
  } = useMobileCompatibility(notificationPermission);

  const [reminderSound, setReminderSound] = useState<SoundType>(() => 
    (localStorage.getItem('medimind_reminder_sound') as SoundType) || 'alert'
  );

  const [notifiedDoses, setNotifiedDoses] = useState<Record<string, number>>(() => 
    safeParse('medimind_notified_doses', {})
  );

  useEffect(() => {
    localStorage.setItem('medimind_reminder_sound', reminderSound);
  }, [reminderSound]);

  useEffect(() => {
    localStorage.setItem('medimind_notified_doses', JSON.stringify(notifiedDoses));
  }, [notifiedDoses]);

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];
  const currentMedications = useMemo(() => medications.filter(m => m.profileId === activeProfileId || !m.profileId), [medications, activeProfileId]);
  const currentLogs = useMemo(() => logs.filter(l => l.profileId === activeProfileId || !l.profileId), [logs, activeProfileId]);
  const currentAppointments = useMemo(() => appointments.filter(a => a.profileId === activeProfileId || !a.profileId), [appointments, activeProfileId]);
  const currentVitals = useMemo(() => vitals.filter(v => v.profileId === activeProfileId), [vitals, activeProfileId]);
  const currentMoods = useMemo(() => moods.filter(m => m.profileId === activeProfileId), [moods, activeProfileId]);

  const handleLogMedication = useCallback((medId: string, status: 'TAKEN' | 'SKIPPED', time?: string) => {
    const newLog: LogEntry = {
      id: uuidv4(),
      profileId: activeProfileId,
      medicationId: medId,
      timestamp: Date.now(),
      status,
      scheduledTime: time,
      dateStr: format(new Date(), 'yyyy-MM-dd')
    };
    setLogs(prev => [...prev, newLog]);
    
    setSnoozedItems(prev => prev.filter(s => !(s.medicationId === medId && s.scheduledTime === time)));
    
    if (status === 'TAKEN') {
      setMedications(prev => prev.map(m => m.id === medId ? { ...m, currentStock: Math.max(0, m.currentStock - 1) } : m));
    }

    // Dismiss in-app alert if currently showing for this medication
    setDuePillAlert(prev => (prev && prev.med.id === medId ? null : prev));
  }, [activeProfileId]);

  const handleSnoozeMedication = useCallback((medId: string, time: string, minutes: number = 15) => {
    const wakeUpTime = addMinutes(new Date(), minutes).getTime();
    setSnoozedItems(prev => [
      ...prev.filter(s => !(s.medicationId === medId && s.scheduledTime === time)),
      { medicationId: medId, scheduledTime: time, wakeUpTime }
    ]);
    setDuePillAlert(prev => (prev && prev.med.id === medId ? null : prev));
  }, []);

  // Helper to convert VAPID base64 key to Uint8Array for PushManager
  const urlBase64ToUint8Array = useCallback((base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }, []);

  // Ensure Service Worker & Web Push subscription for closed-app / lock-screen alarms
  const getOrSubscribePush = useCallback(async (): Promise<PushSubscription | null> => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return null;
    }
    if (Notification.permission !== 'granted') return null;

    try {
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      }
      await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const res = await fetch('/api/push/vapid-public-key');
        if (res.ok) {
          const { publicKey } = await res.json();
          if (publicKey) {
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicKey)
            });
          }
        }
      }
      return sub;
    } catch (err) {
      console.warn('Web Push subscription warning:', err);
      return null;
    }
  }, [urlBase64ToUint8Array]);

  // Reliable Phone Notification Sender (Multi-stage fallback for Android Chrome, WebView, and Desktop)
  const sendPhoneNotification = useCallback(async (
    title: string, 
    body: string, 
    medicationId?: string, 
    scheduledTime?: string, 
    sound?: SoundType
  ) => {
    // 1. Play audible sound chime
    try {
      playNotificationSound(sound || reminderSound);
    } catch (e) {
      console.warn('Audio play error:', e);
    }

    // 2. Vibrate phone if device supports vibration
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([500, 250, 500, 250, 500]);
      } catch (e) {}
    }

    const APP_ICON = 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png';
    const tag = medicationId ? `med-${medicationId}-${scheduledTime || 'due'}` : `med-alert-${Date.now()}`;

    // 3. ServiceWorkerRegistration.showNotification() with multi-stage fallback
    if ('serviceWorker' in navigator) {
      try {
        let reg: ServiceWorkerRegistration | undefined | null = null;
        if (navigator.serviceWorker.controller) {
          reg = await navigator.serviceWorker.getRegistration();
        }
        if (!reg) {
          reg = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000))
          ]);
        }
        if (!reg) {
          reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        }

        if (reg) {
          try {
            await reg.showNotification(title, {
              body,
              icon: APP_ICON,
              badge: APP_ICON,
              vibrate: [500, 250, 500, 250, 500],
              tag,
              renotify: true,
              requireInteraction: true,
              silent: false,
              data: { medicationId, scheduledTime, sound: sound || reminderSound },
              actions: medicationId && medicationId !== 'test' && medicationId !== 'welcome' ? [
                { action: 'take', title: '✅ Taken' },
                { action: 'snooze', title: '⏰ Snooze 15m' }
              ] : [
                { action: 'dismiss', title: 'Dismiss' }
              ]
            } as any);
            return;
          } catch (richErr) {
            // Fallback without actions/renotify for WebViews that reject NotificationAction
            await reg.showNotification(title, {
              body,
              tag,
              vibrate: [500, 250, 500],
              requireInteraction: true,
              data: { medicationId, scheduledTime, sound: sound || reminderSound }
            } as any);
            return;
          }
        }
      } catch (swErr) {
        console.warn('SW notification show failed, trying fallback:', swErr);
      }
    }

    // 4. Fallback for WebViews / Desktop browsers
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { 
          body, 
          tag
        });
      } catch (desktopErr) {
        console.warn('Fallback Notification constructor failed:', desktopErr);
      }
    }
  }, [reminderSound]);

  // Explicit user gesture request permission handler
  const requestPhoneNotificationPermission = useCallback(async (): Promise<NotificationPermission> => {
    initAudio();
    if (!('Notification' in window)) {
      return 'denied';
    }
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        await sendPhoneNotification(
          'Phone Reminders Active! 🔔',
          'MediMind will notify you when it is time to take your pills.',
          'welcome'
        );
        getOrSubscribePush();
      }
      return perm;
    } catch (e) {
      console.error('Failed to request notification permission:', e);
      return 'denied';
    }
  }, [sendPhoneNotification, getOrSubscribePush]);

  // Test notification helper with support for immediate or delayed background/lock-screen testing
  const handleTestNotification = useCallback(async (delaySeconds: number = 0) => {
    initAudio();
    playNotificationSound(reminderSound);
    if ('vibrate' in navigator) {
      navigator.vibrate([400, 200, 400]);
    }

    // 1. Trigger real Server-Side Web Push (wakes up device even when app is closed and screen is locked)
    getOrSubscribePush().then(sub => {
      if (sub) {
        fetch('/api/push/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: sub,
            delaySeconds,
            sound: reminderSound
          })
        }).catch(() => {});
      }
    });

    if (delaySeconds > 0) {
      // 2. Also schedule inside Service Worker + local fallback timer
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.active?.postMessage({
            type: 'SCHEDULE_DELAYED_NOTIFICATION',
            delayMs: delaySeconds * 1000,
            title: '⏰ Pill Reminder Test Alert',
            body: 'Great! You will receive reminders on your phone even when locked.',
            medicationId: 'test',
            sound: reminderSound
          });
        }).catch(() => {});
      }

      setTimeout(() => {
        sendPhoneNotification(
          '⏰ Pill Reminder Test Alert',
          'Great! You will receive reminders on your phone even when locked.',
          'test'
        );
      }, delaySeconds * 1000);
      return;
    }

    await sendPhoneNotification(
      '⏰ Pill Reminder Test Alert',
      'Phone reminders are working! You will get alerts with sound and vibration.',
      'test'
    );
  }, [reminderSound, sendPhoneNotification, getOrSubscribePush]);

  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem('medimind_meds', JSON.stringify(medications));
    localStorage.setItem('medimind_logs', JSON.stringify(logs));
    localStorage.setItem('medimind_vitals', JSON.stringify(vitals));
    localStorage.setItem('medimind_moods', JSON.stringify(moods));
    localStorage.setItem('medimind_snoozes', JSON.stringify(snoozedItems));
    localStorage.setItem('medimind_appts', JSON.stringify(appointments));
  }, [medications, logs, vitals, moods, snoozedItems, appointments]);

  // Handle messages from Service Worker (e.g. user tapped "Taken" or "Snooze" in notification tray, or background alarm fired)
  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (!event.data) return;
      if (event.data.type === 'LOG_MEDICATION') {
        handleLogMedication(event.data.medicationId, event.data.status, event.data.scheduledTime);
      } else if (event.data.type === 'SNOOZE_MEDICATION') {
        handleSnoozeMedication(event.data.medicationId, event.data.scheduledTime, event.data.minutes || 15);
      } else if (event.data.type === 'MEDICATION_ALARM_FIRED') {
        const dose = event.data.dose;
        if (dose) {
          playNotificationSound(dose.sound || reminderSound);
          const med = currentMedications.find(m => m.id === dose.medicationId);
          if (med) {
            setDuePillAlert({ med, scheduledTime: dose.time });
          }
        }
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
    }
  }, [handleLogMedication, handleSnoozeMedication, currentMedications, reminderSound]);

  // Handle actions from URL parameters (when app is opened directly from a notification tap)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const medId = params.get('medId');
    const time = params.get('time');

    if (action === 'take' && medId) {
      handleLogMedication(medId, 'TAKEN', time || undefined);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [handleLogMedication]);

  // Calculate Next Upcoming Dose for display and alarm scheduling
  const nextScheduledDose = useMemo(() => {
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    const todayStr = format(now, 'yyyy-MM-dd');
    const dayOfWeek = now.getDay();
    let next: { name: string; time: string; dosage?: string } | null = null;

    currentMedications.forEach(med => {
      let isScheduledToday = false;
      if (med.frequency === FrequencyType.DAILY || med.frequency === FrequencyType.INTERVAL) {
        isScheduledToday = true;
      } else if (med.frequency === FrequencyType.WEEKLY) {
        isScheduledToday = !!med.daysOfWeek?.includes(dayOfWeek);
      }
      if (!isScheduledToday) return;

      (med.times || []).forEach(time => {
        const alreadyLogged = currentLogs.some(log => 
          log.medicationId === med.id && 
          log.dateStr === todayStr &&
          log.scheduledTime === time
        );
        if (!alreadyLogged && time >= currentTime) {
          if (!next || time < next.time) {
            next = { name: med.name, time, dosage: med.dosage };
          }
        }
      });
    });
    return next;
  }, [currentMedications, currentLogs]);

  // Synchronize All Upcoming Doses to Service Worker AND Web Push Backend for True Lock-Screen / Closed-App Alarms
  const syncScheduleToServiceWorker = useCallback(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const now = new Date();
    const nowMs = Date.now();

    const dosesToSync: Array<{
      id: string;
      medicationId: string;
      name: string;
      dosage: string;
      instruction?: string;
      time: string;
      targetTimestamp: number;
      sound?: SoundType;
    }> = [];

    // Schedule for both today (dayOffset = 0) and tomorrow (dayOffset = 1)
    [0, 1].forEach(dayOffset => {
      const targetDay = new Date(now);
      targetDay.setDate(now.getDate() + dayOffset);
      const dayStr = format(targetDay, 'yyyy-MM-dd');
      const dayOfWeek = targetDay.getDay();

      currentMedications.forEach(med => {
        let isScheduled = false;
        if (med.frequency === FrequencyType.DAILY || med.frequency === FrequencyType.INTERVAL) {
          isScheduled = true;
        } else if (med.frequency === FrequencyType.WEEKLY) {
          isScheduled = !!med.daysOfWeek?.includes(dayOfWeek);
        }
        if (!isScheduled) return;

        (med.times || []).forEach(time => {
          const [hourStr, minStr] = time.split(':');
          const doseDate = new Date(targetDay);
          doseDate.setHours(parseInt(hourStr, 10), parseInt(minStr, 10), 0, 0);
          const targetMs = doseDate.getTime();

          if (dayOffset === 0) {
            const alreadyLogged = currentLogs.some(log => 
              log.medicationId === med.id && 
              log.dateStr === dayStr &&
              log.scheduledTime === time
            );
            if (alreadyLogged) return;
          }

          const snooze = dayOffset === 0 ? snoozedItems.find(s => 
            s.medicationId === med.id && 
            s.scheduledTime === time && 
            s.wakeUpTime > nowMs
          ) : undefined;

          const effectiveTargetMs = snooze ? snooze.wakeUpTime : targetMs;

          if (effectiveTargetMs > nowMs - 10 * 60 * 1000 && effectiveTargetMs < nowMs + 36 * 60 * 60 * 1000) {
            dosesToSync.push({
              id: `${med.id}_${time}_${dayStr}`,
              medicationId: med.id,
              name: med.name,
              dosage: med.dosage || '1 dose',
              instruction: med.notes || '',
              time,
              targetTimestamp: effectiveTargetMs,
              sound: med.reminderSound || reminderSound
            });
          }
        });
      });
    });

    const payload = {
      type: 'SYNC_SCHEDULE',
      doses: dosesToSync
    };

    const dispatch = (sw: ServiceWorker | null) => {
      if (sw) {
        sw.postMessage(payload);
      }
    };

    if (navigator.serviceWorker.controller) {
      dispatch(navigator.serviceWorker.controller);
    } else {
      navigator.serviceWorker.ready.then(reg => {
        dispatch(reg.active);
      }).catch(() => {});
    }

    // Also sync to Server-Side Web Push Scheduler so alarms fire even when app is closed!
    if (Notification.permission === 'granted') {
      getOrSubscribePush().then(sub => {
        if (sub) {
          fetch('/api/push/sync-schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscription: sub,
              doses: dosesToSync
            })
          }).catch(() => {});
        }
      });
    }

    // Maintain Standby Audio Guardian if enabled in user preferences
    const isGuardOn = localStorage.getItem('medimind_standby_guard') !== 'false';
    if (isGuardOn && dosesToSync.length > 0) {
      const nearest = [...dosesToSync].sort((a, b) => a.targetTimestamp - b.targetTimestamp)[0];
      startStandbyAudioGuard(`Next: ${nearest.name} at ${nearest.time}`);
    }
  }, [currentMedications, currentLogs, snoozedItems, reminderSound, getOrSubscribePush]);

  // Keep Service Worker & Web Push schedule synced
  useEffect(() => {
    syncScheduleToServiceWorker();
  }, [syncScheduleToServiceWorker]);

  // Robust Medication Due Checker (Foreground check + instant alert)
  const checkDueMedications = useCallback(() => {
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    const todayStr = format(now, 'yyyy-MM-dd');
    const dayOfWeek = now.getDay();
    const nowMs = Date.now();

    currentMedications.forEach(med => {
      let isScheduledToday = false;
      if (med.frequency === FrequencyType.DAILY || med.frequency === FrequencyType.INTERVAL) {
        isScheduledToday = true;
      } else if (med.frequency === FrequencyType.WEEKLY) {
        isScheduledToday = !!med.daysOfWeek?.includes(dayOfWeek);
      }
      if (!isScheduledToday) return;

      (med.times || []).forEach(time => {
        if (time <= currentTime) {
          const alreadyLogged = currentLogs.some(log => 
            log.medicationId === med.id && 
            log.dateStr === todayStr &&
            log.scheduledTime === time
          );
          if (alreadyLogged) return;

          const isSnoozed = snoozedItems.some(s => 
            s.medicationId === med.id && 
            s.scheduledTime === time && 
            s.wakeUpTime > nowMs
          );
          if (isSnoozed) return;

          const doseKey = `${med.id}_${time}_${todayStr}`;
          if (notifiedDoses[doseKey]) return;

          setNotifiedDoses(prev => {
            const updated = { ...prev, [doseKey]: nowMs };
            try {
              localStorage.setItem('medimind_notified_doses', JSON.stringify(updated));
            } catch (e) {}
            return updated;
          });

          sendPhoneNotification(
            `⏰ Time for ${med.name}!`,
            `Scheduled for ${time}. ${med.dosage || '1 dose'}. Tap to log.`,
            med.id,
            time,
            med.reminderSound || reminderSound
          );

          setDuePillAlert({ med, scheduledTime: time });
        }
      });
    });
  }, [currentMedications, currentLogs, snoozedItems, notifiedDoses, reminderSound, sendPhoneNotification]);

  // Main Reminder Loop + Focus / Wakeup / Background listeners
  useEffect(() => {
    checkDueMedications();
    syncScheduleToServiceWorker();

    const interval = setInterval(() => {
      const now = Date.now();
      setSnoozedItems(prev => prev.filter(s => s.wakeUpTime > now));
      checkDueMedications();
    }, 25000);

    const handleWakeup = () => {
      checkDueMedications();
      syncScheduleToServiceWorker();
    };

    window.addEventListener('focus', handleWakeup);
    window.addEventListener('pagehide', handleWakeup);
    document.addEventListener('visibilitychange', handleWakeup);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleWakeup);
      window.removeEventListener('pagehide', handleWakeup);
      document.removeEventListener('visibilitychange', handleWakeup);
    };
  }, [checkDueMedications, syncScheduleToServiceWorker]);

  useEffect(() => {
    const hasOnboarded = localStorage.getItem('medimind_onboarding_complete');
    if (!hasOnboarded) setIsOnboardingOpen(true);
  }, []);

  const handleUpdateMedicationStockSettings = (medId: string, currentStock: number, lowStockThreshold: number) => {
    setMedications(prev => prev.map(m => 
      m.id === medId ? { 
        ...m, 
        currentStock, 
        lowStockThreshold,
        lastRefillDate: format(new Date(), 'MMM do, yyyy') 
      } : m
    ));
  };

  const handleAddAppointment = (appt: Appointment) => {
    setAppointments(prev => [...prev, { ...appt, profileId: activeProfileId }]);
  };

  const handleDeleteAppointment = (id: string) => {
    setAppointments(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans pb-24">
      {/* Offline Schedule Access Indicator Banner */}
      {!diagnostics.isOnline && (
        <div className="bg-amber-500 text-white px-4 py-1.5 text-center text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm">
          <WifiOff size={13} />
          <span>Offline Mode • Saved pill schedules & reminders remain active</span>
        </div>
      )}

      {/* Compact Sticky Mobile Top App Bar */}
      <header className="sticky top-0 z-30 bg-[#f8fafc]/90 backdrop-blur-md border-b border-slate-200/60 px-3 sm:px-5 pt-safe pb-2">
        <div className="max-w-xl md:max-w-5xl mx-auto flex items-center justify-between gap-2">
          <div className="relative">
            <button 
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="min-h-[44px] flex items-center gap-2.5 bg-white border border-slate-200/80 rounded-full pl-1.5 pr-3.5 py-1 shadow-sm hover:shadow transition-all active:scale-95"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs shadow-inner">
                <User size={16} />
              </div>
              <div className="text-left">
                <p className="text-[8px] text-slate-400 font-black uppercase leading-none mb-0.5 tracking-widest">Profile</p>
                <p className="text-xs font-black text-[#1a2b4d] leading-none truncate max-w-[110px]">{activeProfile.name}</p>
              </div>
              <ChevronDown size={15} className="text-slate-400" />
            </button>
            
            {isProfileMenuOpen && (
              <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2.5 z-50 animate-slideDown">
                <p className="text-[10px] font-black text-slate-400 uppercase px-3 py-2 tracking-widest">Select Account</p>
                <button className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-xs font-black text-blue-600">
                  <div className="flex items-center gap-2.5">
                    <User size={16} /> {activeProfile.name}
                  </div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                </button>
                <div className="h-px bg-slate-100 my-1.5 mx-2"></div>
                <button onClick={() => { setIsSettingsModalOpen(true); setIsProfileMenuOpen(false); }} className="w-full flex items-center gap-2.5 p-3 rounded-xl hover:bg-slate-50 text-xs font-black text-slate-600">
                  <Plus size={16} /> Manage Profiles
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* One-Tap Install Button when installable on Android/Mobile */}
            {!diagnostics.isStandalone && diagnostics.isInstallable && (
              <button
                onClick={promptInstall}
                className="min-h-[44px] px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider shadow-sm active:scale-95 transition-all"
                title="Install MediMind to Home Screen"
              >
                <Download size={14} />
                <span className="hidden xs:inline">Install</span>
              </button>
            )}

            {/* Device Compatibility & Health Check Button */}
            <button
              onClick={() => { initAudio(); setIsCompatibilityModalOpen(true); }}
              className="relative w-11 h-11 bg-white rounded-full flex items-center justify-center text-slate-600 shadow-sm border border-slate-200/80 hover:text-blue-600 transition-colors active:scale-95"
              title="Mobile Compatibility & Health Check"
            >
              <Smartphone size={19} className="text-blue-600" />
              <span
                className={`absolute top-2 right-2 w-2 h-2 rounded-full ring-2 ring-white ${
                  diagnostics.notificationPermission === 'granted' && diagnostics.swActive
                    ? 'bg-emerald-500'
                    : 'bg-blue-500'
                }`}
              />
            </button>

            {/* Phone Reminders & Sound Bell */}
            <button 
              onClick={() => { initAudio(); setIsNotificationModalOpen(true); }}
              className="relative w-11 h-11 bg-white rounded-full flex items-center justify-center text-slate-500 shadow-sm border border-slate-200/80 hover:text-blue-600 transition-colors active:scale-95"
              title="Phone Reminders & Alarms"
            >
              <Bell size={19} className={notificationPermission === 'granted' ? 'text-blue-600' : 'text-slate-500'} />
              {notificationPermission !== 'granted' && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white animate-pulse" />
              )}
            </button>

            {/* Profile & Settings */}
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="w-11 h-11 bg-white rounded-full flex items-center justify-center text-slate-500 shadow-sm border border-slate-200/80 hover:text-blue-600 transition-colors active:scale-95"
              title="Settings & Medical ID"
            >
              <User size={19} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-xl md:max-w-5xl mx-auto px-3 sm:px-5 pt-3 pb-4">
        <ErrorBoundary>
          {activeTab === 'home' && (
            <Dashboard 
              medications={currentMedications} 
              logs={currentLogs} 
              moods={currentMoods}
              vitals={currentVitals}
              snoozedItems={snoozedItems} 
              onDeleteMedication={(id) => setMedications(m => m.filter(x => x.id !== id))}
              onLogMedication={handleLogMedication} 
              onRefillMedication={(id, stock) => setMedications(prev => prev.map(m => m.id === id ? { ...m, currentStock: stock, lastRefillDate: format(new Date(), 'MMM do, yyyy') } : m))}
              onUpdateMedicationStockSettings={handleUpdateMedicationStockSettings}
              onEditMedication={(med) => { setEditingMedication(med); setIsAddModalOpen(true); }}
              onUpdateMedication={(med) => setMedications(m => m.map(x => x.id === med.id ? med : x))}
              onLogMood={(type) => setMoods(prev => [...prev, { id: uuidv4(), profileId: activeProfileId, type, timestamp: Date.now(), dateStr: format(new Date(), 'yyyy-MM-dd') }])}
              onSnoozeMedication={handleSnoozeMedication}
              onAddMedication={() => { setEditingMedication(null); setIsAddModalOpen(true); }}
              userName={activeProfile.name}
              notificationPermission={notificationPermission}
              onOpenNotificationCenter={() => { initAudio(); setIsNotificationModalOpen(true); }}
              diagnostics={diagnostics}
              onOpenCompatibilityModal={() => { initAudio(); setIsCompatibilityModalOpen(true); }}
              onPromptInstall={promptInstall}
              installBannerDismissed={installBannerDismissed}
              onDismissInstallBanner={dismissInstallBanner}
              compactMode={compactMode}
            />
          )}
          {activeTab === 'history' && <HistoryView medications={currentMedications} logs={currentLogs} moods={currentMoods} userName={activeProfile.name} />}
          {activeTab === 'care' && (
            <CareView 
              medications={currentMedications} 
              appointments={currentAppointments}
              onAddAppointment={handleAddAppointment}
              onDeleteAppointment={handleDeleteAppointment}
            />
          )}
          {activeTab === 'vitals' && (
            <VitalsView 
              vitals={currentVitals} 
              onAddVital={(v) => setVitals(prev => [...prev, {...v, profileId: activeProfileId}])}
              watchConnected={false}
              onSyncWatch={async () => {
                return null;
              }}
            />
          )}
          {activeTab === 'chat' && <AssistantView medications={currentMedications} />}
        </ErrorBoundary>
      </main>

      {/* Compact Fixed Bottom Tab Bar with 44x44px minimum touch hitboxes and safe-area padding */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 pt-1.5 pb-safe z-30 shadow-[0_-4px_20px_rgb(0,0,0,0.05)]">
        <div className="max-w-xl md:max-w-3xl mx-auto flex justify-between items-center">
          <button
            onClick={() => setActiveTab('home')}
            className={`min-w-[56px] min-h-[48px] flex flex-col items-center justify-center gap-1 px-2 rounded-xl transition-all ${
              activeTab === 'home' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Home size={20} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
            <span className="text-[9px] font-black uppercase tracking-wider leading-none">Home</span>
          </button>
          
          <button
            onClick={() => setActiveTab('history')}
            className={`min-w-[56px] min-h-[48px] flex flex-col items-center justify-center gap-1 px-2 rounded-xl transition-all ${
              activeTab === 'history' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Calendar size={20} strokeWidth={activeTab === 'history' ? 2.5 : 2} />
            <span className="text-[9px] font-black uppercase tracking-wider leading-none">History</span>
          </button>
          
          <div className="relative px-1">
            <button 
              onClick={() => { setEditingMedication(null); setIsAddModalOpen(true); }} 
              className="w-12 h-12 bg-blue-600 hover:bg-blue-700 rounded-2xl text-white shadow-lg shadow-blue-600/30 flex items-center justify-center active:scale-90 transition-all"
              title="Add Medication"
            >
              <Plus size={24} strokeWidth={3.5} />
            </button>
          </div>

          <button
            onClick={() => setActiveTab('vitals')}
            className={`min-w-[56px] min-h-[48px] flex flex-col items-center justify-center gap-1 px-2 rounded-xl transition-all ${
              activeTab === 'vitals' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Activity size={20} strokeWidth={activeTab === 'vitals' ? 2.5 : 2} />
            <span className="text-[9px] font-black uppercase tracking-wider leading-none">Vitals</span>
          </button>

          <button
            onClick={() => setActiveTab('care')}
            className={`min-w-[56px] min-h-[48px] flex flex-col items-center justify-center gap-1 px-2 rounded-xl transition-all ${
              activeTab === 'care' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <HeartPulse size={20} strokeWidth={activeTab === 'care' ? 2.5 : 2} />
            <span className="text-[9px] font-black uppercase tracking-wider leading-none">Care</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`min-w-[56px] min-h-[48px] flex flex-col items-center justify-center gap-1 px-2 rounded-xl transition-all ${
              activeTab === 'chat' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <MessageSquareText size={20} strokeWidth={activeTab === 'chat' ? 2.5 : 2} />
            <span className="text-[9px] font-black uppercase tracking-wider leading-none">Assistant</span>
          </button>
        </div>
      </nav>

      <AddMedicationModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onAdd={(m) => setMedications(prev => [...prev, {...m, profileId: activeProfileId}])} 
        onUpdate={(m) => setMedications(prev => prev.map(x => x.id === m.id ? m : x))} 
        initialData={editingMedication} 
        activeProfile={activeProfile} 
      />
      <SettingsModal 
        isOpen={isSettingsModalOpen} 
        onClose={() => setIsSettingsModalOpen(false)} 
        profiles={profiles} 
        activeProfileId={activeProfileId} 
        onTestNotification={handleTestNotification}
        onOpenCompatibilityModal={() => {
          setIsSettingsModalOpen(false);
          setIsCompatibilityModalOpen(true);
        }}
      />
      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        permission={notificationPermission}
        onRequestPermission={requestPhoneNotificationPermission}
        onSendTestNotification={handleTestNotification}
        selectedSound={reminderSound}
        onSelectSound={(s) => setReminderSound(s)}
        nextScheduledDose={nextScheduledDose}
      />
      <DeviceCompatibilityModal
        isOpen={isCompatibilityModalOpen}
        onClose={() => setIsCompatibilityModalOpen(false)}
        diagnostics={diagnostics}
        onPromptInstall={promptInstall}
        onRequestNotificationPermission={requestPhoneNotificationPermission}
        onTestNotification={handleTestNotification}
        onRefreshDiagnostics={refreshDiagnostics}
        savedMedicationCount={currentMedications.length}
        selectedSound={reminderSound}
        compactMode={compactMode}
        onToggleCompactMode={toggleCompactMode}
      />
      <DuePillAlertModal
        isOpen={!!duePillAlert}
        medication={duePillAlert ? duePillAlert.med : null}
        scheduledTime={duePillAlert ? duePillAlert.scheduledTime : ''}
        onTake={() => {
          if (duePillAlert) {
            handleLogMedication(duePillAlert.med.id, 'TAKEN', duePillAlert.scheduledTime);
          }
        }}
        onSnooze={(mins) => {
          if (duePillAlert) {
            handleSnoozeMedication(duePillAlert.med.id, duePillAlert.scheduledTime, mins);
          }
        }}
        onDismiss={() => setDuePillAlert(null)}
      />
      <OnboardingModal isOpen={isOnboardingOpen} onClose={() => { localStorage.setItem('medimind_onboarding_complete', 'true'); setIsOnboardingOpen(false); }} userName={activeProfile.name} />
    </div>
  );
};

export default App;
