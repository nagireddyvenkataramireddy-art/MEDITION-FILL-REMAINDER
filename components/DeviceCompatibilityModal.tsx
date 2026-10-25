import React, { useState } from 'react';
import {
  X,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Download,
  Share,
  PlusSquare,
  Bell,
  Volume2,
  Wifi,
  WifiOff,
  ShieldCheck,
  RefreshCw,
  Minimize2,
  Maximize2,
  Sparkles,
  Lock,
  Tablet,
} from 'lucide-react';
import { DeviceDiagnostics } from '../services/useMobileCompatibility';
import { SoundType } from '../types';
import { initAudio, playNotificationSound } from '../services/audioService';

interface DeviceCompatibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostics: DeviceDiagnostics;
  onPromptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  onRequestNotificationPermission: () => Promise<NotificationPermission>;
  onTestNotification: (delaySeconds?: number) => void;
  onRefreshDiagnostics: () => Promise<void>;
  savedMedicationCount: number;
  selectedSound: SoundType;
  compactMode: boolean;
  onToggleCompactMode: (enabled: boolean) => void;
}

const DeviceCompatibilityModal: React.FC<DeviceCompatibilityModalProps> = ({
  isOpen,
  onClose,
  diagnostics,
  onPromptInstall,
  onRequestNotificationPermission,
  onTestNotification,
  onRefreshDiagnostics,
  savedMedicationCount,
  selectedSound,
  compactMode,
  onToggleCompactMode,
}) => {
  const [audioTested, setAudioTested] = useState(false);
  const [lockTestCountdown, setLockTestCountdown] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showIosSteps, setShowIosSteps] = useState(
    diagnostics.os === 'iOS' || diagnostics.os === 'iPadOS'
  );

  if (!isOpen) return null;

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefreshDiagnostics();
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleTestAudio = () => {
    initAudio();
    playNotificationSound(selectedSound);
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
    setAudioTested(true);
  };

  const handleLockScreenTest = () => {
    initAudio();
    onTestNotification(10);
    setLockTestCountdown(10);
    const timer = setInterval(() => {
      setLockTestCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Calculate overall readiness score
  const checks = [
    diagnostics.offlineStorageReady && diagnostics.swActive,
    diagnostics.notificationPermission === 'granted',
    diagnostics.pushSubscribed || diagnostics.notificationPermission === 'granted',
    diagnostics.isStandalone || !diagnostics.iosRequiresHomeScreenForPush,
  ];
  const passedCount = checks.filter(Boolean).length;
  const readinessPercent = Math.round((passedCount / checks.length) * 100);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col border border-slate-100">
        {/* Mobile Sheet Drag Handle */}
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mt-2.5 sm:hidden" />

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              {diagnostics.formFactor === 'Tablet / Foldable' ? (
                <Tablet size={19} />
              ) : (
                <Smartphone size={19} />
              )}
            </div>
            <div>
              <h2 className="text-base font-black text-[#1a2b4d] leading-tight">
                Mobile Compatibility & Health Check
              </h2>
              <p className="text-[11px] font-bold text-slate-400">
                {diagnostics.os} • {diagnostics.browser} • {diagnostics.formFactor}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleRefresh}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
              title="Refresh Status"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin text-blue-600' : ''} />
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 bg-[#f8fafc] flex-1">
          {/* Device Profile & Readiness Summary Card */}
          <div className="bg-gradient-to-br from-[#1a2b4d] to-blue-900 rounded-2xl p-4 text-white shadow-md">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/15 text-blue-100 mb-1">
                  <ShieldCheck size={12} /> Universal Mobile Ready
                </span>
                <h3 className="text-lg font-black leading-tight">
                  {readinessPercent === 100
                    ? 'All Mobile Systems Optimal'
                    : `${passedCount} of ${checks.length} Mobile Checks Ready`}
                </h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex flex-col items-center justify-center">
                <span className="text-sm font-black text-emerald-300">{readinessPercent}%</span>
                <span className="text-[8px] uppercase font-bold text-white/70">Score</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-[11px]">
              <div className="bg-white/10 rounded-xl px-2.5 py-1.5">
                <p className="text-[9px] uppercase font-bold text-blue-200">Device</p>
                <p className="font-black truncate">{diagnostics.os}</p>
              </div>
              <div className="bg-white/10 rounded-xl px-2.5 py-1.5">
                <p className="text-[9px] uppercase font-bold text-blue-200">Viewport</p>
                <p className="font-black truncate">{diagnostics.screenResolution}</p>
              </div>
              <div className="bg-white/10 rounded-xl px-2.5 py-1.5">
                <p className="text-[9px] uppercase font-bold text-blue-200">App Mode</p>
                <p className="font-black truncate">
                  {diagnostics.isStandalone ? 'Home Screen' : 'Browser Tab'}
                </p>
              </div>
            </div>
          </div>

          {/* 1. One-Tap Home Screen Install / iOS Guide */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    diagnostics.isStandalone
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  <Download size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Home Screen App Installation
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                    {diagnostics.isStandalone
                      ? 'MediMind is installed on your Home Screen for full-screen access and reliable lock-screen alerts.'
                      : 'Install MediMind on your phone Home Screen for 1-tap launch, offline access, and reliable background alarms.'}
                  </p>
                </div>
              </div>
              {diagnostics.isStandalone ? (
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase flex-shrink-0">
                  Installed
                </span>
              ) : diagnostics.isInstallable ? (
                <button
                  onClick={onPromptInstall}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm active:scale-95 transition-all flex-shrink-0"
                >
                  Install App
                </button>
              ) : (
                <button
                  onClick={() => setShowIosSteps(!showIosSteps)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-black uppercase tracking-wider flex-shrink-0"
                >
                  {showIosSteps ? 'Hide Guide' : 'How to Install'}
                </button>
              )}
            </div>

            {/* Step-by-step iOS / Mobile Browser Home Screen Guide */}
            {!diagnostics.isStandalone && showIosSteps && (
              <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3.5 space-y-2.5 text-xs">
                <p className="font-black text-blue-900 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <Sparkles size={13} className="text-blue-600" />
                  {diagnostics.os === 'iOS' || diagnostics.os === 'iPadOS'
                    ? 'iPhone & iPad Safari Home Screen Setup (Required for Lock-Screen Alerts)'
                    : 'Add MediMind to Your Phone Home Screen'}
                </p>
                <div className="space-y-2 text-slate-700">
                  <div className="flex items-center gap-2.5 bg-white p-2 rounded-lg border border-blue-100/80">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">
                      1
                    </span>
                    <span className="text-[11px] font-bold flex-1">
                      {diagnostics.os === 'iOS' || diagnostics.os === 'iPadOS'
                        ? 'Tap the Safari Share button at the bottom of your screen'
                        : 'Tap the browser menu icon (⋮) in the top-right corner'}
                    </span>
                    <Share size={15} className="text-blue-600 flex-shrink-0" />
                  </div>
                  <div className="flex items-center gap-2.5 bg-white p-2 rounded-lg border border-blue-100/80">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">
                      2
                    </span>
                    <span className="text-[11px] font-bold flex-1">
                      Scroll down and tap{' '}
                      <strong className="text-blue-700">"Add to Home Screen"</strong> or{' '}
                      <strong className="text-blue-700">"Install App"</strong>
                    </span>
                    <PlusSquare size={15} className="text-blue-600 flex-shrink-0" />
                  </div>
                  <div className="flex items-center gap-2.5 bg-white p-2 rounded-lg border border-blue-100/80">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">
                      3
                    </span>
                    <span className="text-[11px] font-bold flex-1">
                      Open <strong>MediMind</strong> from your Home Screen and tap{' '}
                      <strong>Enable Alerts</strong>
                    </span>
                    <CheckCircle2 size={15} className="text-emerald-600 flex-shrink-0" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Permission & Background Alarm Health Check List */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm divide-y divide-slate-100">
            {/* Notification Permission */}
            <div className="p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    diagnostics.notificationPermission === 'granted'
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  <Bell size={18} />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800">Phone Notification Permission</p>
                  <p className="text-[11px] text-slate-500">
                    {diagnostics.notificationPermission === 'granted'
                      ? 'Allowed — visual pill banners enabled'
                      : diagnostics.notificationPermission === 'denied'
                      ? 'Blocked in browser settings — tap lock icon in address bar to allow'
                      : 'Tap Enable to allow pill reminder notifications'}
                  </p>
                </div>
              </div>
              {diagnostics.notificationPermission === 'granted' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase">
                  <CheckCircle2 size={12} /> Active
                </span>
              ) : (
                <button
                  onClick={onRequestNotificationPermission}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wider shadow-sm active:scale-95"
                >
                  Enable
                </button>
              )}
            </div>

            {/* Lock-Screen Web Push */}
            <div className="p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    diagnostics.pushSubscribed
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-indigo-50 text-indigo-600'
                  }`}
                >
                  <Lock size={18} />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800">
                    Lock-Screen & Closed-App Push
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {lockTestCountdown !== null
                      ? `Lock your phone now! Alert firing in ${lockTestCountdown}s...`
                      : diagnostics.pushSubscribed
                      ? 'Background Web Push connected for locked-screen wakeup'
                      : 'Tap Test 10s Lock Alert to arm background push wakeup'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLockScreenTest}
                disabled={lockTestCountdown !== null}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors flex-shrink-0 disabled:opacity-60"
              >
                {lockTestCountdown !== null ? `${lockTestCountdown}s...` : 'Test 10s Lock'}
              </button>
            </div>

            {/* Reminder Sound & Haptics */}
            <div className="p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    audioTested ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  <Volume2 size={18} />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800">Reminder Sound & Vibration</p>
                  <p className="text-[11px] text-slate-500">
                    {audioTested
                      ? `Audio unlocked (${selectedSound} chime + vibration)`
                      : 'Tap Test Sound to unlock mobile speaker playback'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleTestAudio}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors flex-shrink-0"
              >
                {audioTested ? 'Play Again' : 'Test Sound'}
              </button>
            </div>

            {/* Offline Schedule Access */}
            <div className="p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    diagnostics.offlineStorageReady
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  {diagnostics.isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800">
                    Offline Pill Schedule Storage
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {savedMedicationCount} medication{savedMedicationCount === 1 ? '' : 's'} saved
                    for instant offline access ({diagnostics.isOnline ? 'Online' : 'Offline Mode'})
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase flex-shrink-0">
                <CheckCircle2 size={12} /> Cached
              </span>
            </div>
          </div>

          {/* 3. Mobile Display Density Toggle (Compact Single-Screen vs Standard) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
                {compactMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </div>
              <div>
                <p className="text-xs font-black text-slate-800">
                  Compact Single-Screen Mobile Layout
                </p>
                <p className="text-[11px] text-slate-500">
                  Fits daily progress, next pill, and schedules on one screen with smaller cards
                </p>
              </div>
            </div>
            <button
              onClick={() => onToggleCompactMode(!compactMode)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex-shrink-0 ${
                compactMode
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {compactMode ? 'Compact ON' : 'Standard'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full py-3 bg-[#1a2b4d] hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-md active:scale-[0.99] transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeviceCompatibilityModal;
