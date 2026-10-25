import React, { useState, useEffect } from 'react';
import { 
  X, Bell, BellRing, Volume2, Smartphone, CheckCircle2, 
  AlertTriangle, ShieldAlert, ArrowRight, Play, RefreshCw, 
  HelpCircle, Sparkles, Clock, Check, ShieldCheck, Power, Sliders
} from 'lucide-react';
import { SoundType } from '../types';
import { playNotificationSound, initAudio, isStandbyAudioGuardActive, startStandbyAudioGuard, stopStandbyAudioGuard } from '../services/audioService';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  permission: NotificationPermission;
  onRequestPermission: () => Promise<NotificationPermission>;
  onSendTestNotification: (delaySeconds?: number) => void;
  selectedSound: SoundType;
  onSelectSound: (sound: SoundType) => void;
  nextScheduledDose?: { name: string; time: string } | null;
}

const SOUND_OPTIONS: { id: SoundType; label: string; desc: string }[] = [
  { id: 'alert', label: 'Pill Alert (Loud)', desc: 'Crisp rising chime (Recommended)' },
  { id: 'chime', label: 'Gentle Chime', desc: 'Pleasant rising chime' },
  { id: 'glass', label: 'Glass Ting', desc: 'High-pitched gentle ping' },
  { id: 'harp', label: 'Harp Arpeggio', desc: 'Calming melodic notes' },
  { id: 'soft', label: 'Soft Bell', desc: 'Warm, low ambient tone' },
  { id: 'nature', label: 'Morning Chirp', desc: 'Natural soft chirp' },
];

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  permission,
  onRequestPermission,
  onSendTestNotification,
  selectedSound,
  onSelectSound,
  nextScheduledDose
}) => {
  const [currentPermission, setCurrentPermission] = useState<NotificationPermission>(permission);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [vibrateSupported, setVibrateSupported] = useState(false);
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);
  const [standbyGuard, setStandbyGuard] = useState<boolean>(() => {
    return localStorage.getItem('medimind_standby_guard') !== 'false';
  });

  useEffect(() => {
    setCurrentPermission(permission);
    if ('vibrate' in navigator) {
      setVibrateSupported(true);
    }
  }, [permission, isOpen]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      onSendTestNotification(0);
      setLastTestedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCountdown(null);
    }
  }, [countdown, onSendTestNotification]);

  if (!isOpen) return null;

  const handleEnableClick = async () => {
    setIsRequesting(true);
    initAudio(); // Unlock audio on user tap
    try {
      const result = await onRequestPermission();
      setCurrentPermission(result);
      if (result === 'granted') {
        setLastTestedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        if (standbyGuard) {
          startStandbyAudioGuard(nextScheduledDose ? `Next: ${nextScheduledDose.name} ${nextScheduledDose.time}` : 'Active');
        }
      }
    } catch (e) {
      console.error('Permission error:', e);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleTestNow = () => {
    initAudio();
    playNotificationSound(selectedSound);
    if ('vibrate' in navigator) {
      navigator.vibrate([500, 200, 500, 200, 1000]);
    }
    onSendTestNotification(0);
    setLastTestedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  };

  const handleTestLockScreen = (seconds: number = 10) => {
    initAudio();
    setCountdown(seconds);
    onSendTestNotification(seconds); // Service Worker triggers after delay
  };

  const handleTestVibrate = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([500, 200, 500, 200, 1000, 200, 1000]);
    }
  };

  const toggleStandbyGuard = () => {
    const nextState = !standbyGuard;
    setStandbyGuard(nextState);
    localStorage.setItem('medimind_standby_guard', nextState ? 'true' : 'false');
    if (nextState) {
      initAudio();
      startStandbyAudioGuard(nextScheduledDose ? `Next: ${nextScheduledDose.name} ${nextScheduledDose.time}` : 'Active');
    } else {
      stopStandbyAudioGuard();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col border border-slate-100">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <BellRing size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 leading-tight">Phone Reminders</h2>
              <p className="text-xs text-slate-500 font-medium">Lock Screen & Alarm Center</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center shadow-sm transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Permission Status Card */}
          <div className={`p-4 rounded-2xl border transition-all ${
            currentPermission === 'granted'
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : currentPermission === 'denied'
                ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                : 'bg-amber-50/70 border-amber-200 text-amber-900'
          }`}>
            <div className="flex items-start gap-3">
              {currentPermission === 'granted' ? (
                <CheckCircle2 size={24} className="text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : currentPermission === 'denied' ? (
                <ShieldAlert size={24} className="text-rose-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={24} className="text-amber-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    {currentPermission === 'granted' 
                      ? 'Phone Notifications: Active' 
                      : currentPermission === 'denied'
                        ? 'Notifications Blocked on this Phone'
                        : 'Action Required: Enable Reminders'}
                  </h3>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    currentPermission === 'granted'
                      ? 'bg-emerald-100 text-emerald-700'
                      : currentPermission === 'denied'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}>
                    {currentPermission}
                  </span>
                </div>
                <p className="text-xs font-medium mt-1 leading-relaxed opacity-90">
                  {currentPermission === 'granted'
                    ? 'MediMind is connected to Android system notifications. Reminders ring and vibrate directly in your notification shade.'
                    : currentPermission === 'denied'
                      ? 'Notifications are blocked in your browser settings. To receive pill alerts on your phone, you need to allow notifications in Chrome settings.'
                      : 'Tap below to allow phone notifications so MediMind can alert you when it is time to take your pills.'}
                </p>

                {currentPermission !== 'granted' && currentPermission !== 'denied' && (
                  <button
                    onClick={handleEnableClick}
                    disabled={isRequesting}
                    className="mt-3 w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all"
                  >
                    {isRequesting ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Bell size={16} />
                    )}
                    Tap to Allow Notifications Now
                  </button>
                )}
              </div>
            </div>

            {/* Android Troubleshooting if blocked */}
            {currentPermission === 'denied' && (
              <div className="mt-3 pt-3 border-t border-rose-200/60 text-xs space-y-1.5 text-rose-800">
                <p className="font-bold flex items-center gap-1.5">
                  <Smartphone size={14} /> How to fix on Android / Chrome:
                </p>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] leading-relaxed">
                  <li>Tap the <strong>Lock icon (🔒)</strong> or <strong>Site Tune icon</strong> at the top of Chrome.</li>
                  <li>Tap <strong>Permissions</strong> or <strong>Site Settings</strong>.</li>
                  <li>Find <strong>Notifications</strong> and change it to <strong>Allow</strong>.</li>
                  <li>Reload this page to start receiving alerts.</li>
                </ol>
              </div>
            )}
          </div>

          {/* CRITICAL PHONE SETTINGS GUIDANCE: Direct fix for user's screenshot */}
          <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 space-y-2.5 text-xs text-amber-950 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-amber-500 text-white flex items-center justify-center">
                <Sliders size={16} />
              </span>
              <h4 className="font-black text-amber-900 uppercase tracking-wider text-xs">
                Crucial for Lock Screen & Sound on Your Phone
              </h4>
            </div>

            <p className="text-[11px] leading-relaxed text-amber-900 font-medium">
              On Android phones (OnePlus, Oppo, Realme, Vivo, Xiaomi), phone battery and AI settings silence background apps unless adjusted:
            </p>

            <div className="space-y-2 text-[11px] bg-white/80 p-3 rounded-xl border border-amber-200/60">
              <div className="flex items-start gap-2">
                <span className="font-black text-amber-700 mt-0.5">1.</span>
                <p className="leading-snug text-slate-800">
                  <strong>Turn OFF &quot;Notification organiser&quot;:</strong> In your phone settings for MediMind, turn off <em>&quot;Notification organiser (Bundle and silence lower priority notifications)&quot;</em> so Android doesn&apos;t mute your pill alarms!
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-black text-amber-700 mt-0.5">2.</span>
                <p className="leading-snug text-slate-800">
                  <strong>Set to &quot;Allow Background Activity&quot;:</strong> Go to phone <em>Settings &gt; Apps &gt; MediMind &gt; Battery</em> and select <strong>&quot;Allow background activity&quot;</strong> (or &quot;Unrestricted&quot;).
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-black text-amber-700 mt-0.5">3.</span>
                <p className="leading-snug text-slate-800">
                  <strong>Notification Categories:</strong> Under <em>Notification categories</em>, ensure sound is set to <strong>Alerting / Ringtone</strong> with &quot;Banner&quot; and &quot;Lock screen&quot; toggled ON.
                </p>
              </div>
            </div>
          </div>

          {/* Test Alert Buttons: Instant and 10s Lock-Screen Test */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Smartphone size={16} className="text-blue-500" /> Test Reminders & Lock Screen
            </h3>
            <p className="text-xs text-slate-500">
              Verify that alerts, chime sounds, and vibrations appear while your phone screen is locked:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={handleTestNow}
                className="py-3 px-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
              >
                <Bell size={15} className="text-blue-600" />
                <span>Test Now (Instant)</span>
              </button>

              <button
                onClick={() => handleTestLockScreen(10)}
                disabled={countdown !== null}
                className="py-3 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
              >
                {countdown !== null ? (
                  <>
                    <Clock size={15} className="animate-pulse" />
                    <span>Lock Phone Now! ({countdown}s)</span>
                  </>
                ) : (
                  <>
                    <Clock size={15} />
                    <span>Test Lock Screen (10s)</span>
                  </>
                )}
              </button>
            </div>

            {countdown !== null && (
              <div className="p-3.5 bg-blue-600 text-white rounded-xl text-center shadow-lg animate-pulse">
                <p className="text-xs font-bold">
                  📱 Press your phone&apos;s power button to LOCK SCREEN NOW!
                </p>
                <p className="text-[11px] text-white/90 mt-1">
                  Alarm will ring in {countdown} seconds while your phone is locked.
                </p>
              </div>
            )}

            {lastTestedAt && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center animate-fadeIn">
                <p className="text-xs font-bold text-emerald-800">
                  🔔 Test notification sent at {lastTestedAt}! Check your phone&apos;s lock screen or notification tray.
                </p>
              </div>
            )}
          </div>

          {/* Standby Audio Guardian Switch (Guarantees Lock-Screen Audio) */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">Lock-Screen Sound Guardian</p>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Maintains active media session so Android does not sleep the audio engine when the screen turns off.
                </p>
              </div>
            </div>
            <button
              onClick={toggleStandbyGuard}
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 flex-shrink-0 ${
                standbyGuard ? 'bg-teal-600' : 'bg-slate-300'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                standbyGuard ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Sound Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Volume2 size={16} className="text-teal-500" /> Reminder Alarm Sound
              </h3>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">High Volume Chime</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SOUND_OPTIONS.map((opt) => {
                const isSelected = selectedSound === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      onSelectSound(opt.id);
                      initAudio();
                      playNotificationSound(opt.id);
                    }}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm text-blue-900'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold leading-tight">{opt.label}</p>
                      <p className="text-[10px] text-slate-400">{opt.desc}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600">
                        <Play size={10} fill="currentColor" />
                      </div>
                      {isSelected && <Check size={14} className="text-blue-600 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vibration Support */}
          {vibrateSupported && (
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Smartphone size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700">Phone Vibration Pattern</p>
                  <p className="text-[10px] text-slate-400">Vigorous buzz pattern for pill reminders</p>
                </div>
              </div>
              <button
                onClick={handleTestVibrate}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 rounded-lg shadow-sm active:scale-95"
              >
                Test Buzz
              </button>
            </div>
          )}

          {/* PWA Home Screen Installation guidance */}
          <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100/70 space-y-2">
            <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={14} className="text-indigo-600" /> Keep MediMind Installed
            </h4>
            <p className="text-xs text-indigo-900/80 leading-relaxed">
              When MediMind is added to your phone&apos;s home screen (WebAPK/PWA), Android gives it higher background alarm priority.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-medium">
            {nextScheduledDose ? `Next alarm: ${nextScheduledDose.time}` : 'All doses caught up'}
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;
