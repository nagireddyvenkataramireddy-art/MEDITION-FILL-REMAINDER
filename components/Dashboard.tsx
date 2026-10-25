import React, { useMemo, useState, useEffect } from 'react';
import {
  Medication,
  LogEntry,
  FrequencyType,
  MoodType,
  MoodEntry,
  SnoozeEntry,
  VitalEntry,
} from '../types';
import MedicationCard from './MedicationCard';
import RefillSettingsModal from './RefillSettingsModal';
import { format } from 'date-fns';
import {
  Sunrise,
  Moon,
  Clock,
  Smile,
  Meh,
  Frown,
  ThumbsUp,
  Activity,
  Plus,
  Check,
  Sparkles,
  CalendarDays,
  BellRing,
  Smartphone,
  Download,
  Share,
  X,
} from 'lucide-react';
import { getSmartInsights } from '../services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';
import { DeviceDiagnostics } from '../services/useMobileCompatibility';

interface DashboardProps {
  medications: Medication[];
  logs: LogEntry[];
  moods: MoodEntry[];
  vitals: VitalEntry[];
  snoozedItems: SnoozeEntry[];
  onDeleteMedication: (id: string) => void;
  onLogMedication: (medId: string, status: 'TAKEN' | 'SKIPPED', time?: string) => void;
  onRefillMedication: (medId: string, newStock: number) => void;
  onUpdateMedicationStockSettings?: (
    medId: string,
    currentStock: number,
    lowStockThreshold: number
  ) => void;
  onEditMedication: (med: Medication) => void;
  onUpdateMedication: (med: Medication) => void;
  onLogMood: (mood: MoodType) => void;
  onSnoozeMedication: (medId: string, time: string, minutes: number) => void;
  onAddMedication: () => void;
  userName: string;
  notificationPermission?: NotificationPermission;
  onOpenNotificationCenter?: () => void;
  diagnostics?: DeviceDiagnostics;
  onOpenCompatibilityModal?: () => void;
  onPromptInstall?: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  installBannerDismissed?: boolean;
  onDismissInstallBanner?: () => void;
  compactMode?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({
  medications,
  logs,
  moods,
  vitals,
  snoozedItems,
  onDeleteMedication,
  onLogMedication,
  onRefillMedication,
  onUpdateMedicationStockSettings,
  onEditMedication,
  onLogMood,
  onSnoozeMedication,
  onAddMedication,
  userName,
  notificationPermission = 'default',
  onOpenNotificationCenter,
  diagnostics,
  onOpenCompatibilityModal,
  onPromptInstall,
  installBannerDismissed = false,
  onDismissInstallBanner,
  compactMode = true,
}) => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayLogs = logs.filter((log) => log.dateStr === todayStr);
  const todaysMood = moods.find((m) => m.dateStr === todayStr);

  const [insights, setInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [selectedMedForRefill, setSelectedMedForRefill] = useState<Medication | null>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      if (medications.length === 0) return;
      setLoadingInsights(true);
      const result = await getSmartInsights(medications, logs, moods, vitals);
      setInsights(result);
      setLoadingInsights(false);
    };

    fetchInsights();
  }, [medications.length, moods.length, vitals.length]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning,';
    if (hour < 17) return 'Good Afternoon,';
    return 'Good Evening,';
  }, []);

  const { adherenceProgress, allDosesCompleted, takenCountTotal, expectedCountTotal } =
    useMemo(() => {
      const today = new Date();
      const dayOfWeek = today.getDay();

      const medsScheduledToday = medications.filter((med) => {
        if (med.frequency === FrequencyType.DAILY) return true;
        if (med.frequency === FrequencyType.INTERVAL) return true;
        if (med.frequency === FrequencyType.WEEKLY) {
          return med.daysOfWeek?.includes(dayOfWeek);
        }
        return false;
      });

      if (medsScheduledToday.length === 0) {
        return {
          adherenceProgress: 0,
          allDosesCompleted: false,
          takenCountTotal: 0,
          expectedCountTotal: 0,
        };
      }

      const totalExpectedDoses = medsScheduledToday.reduce(
        (acc, med) => acc + med.times.length,
        0
      );
      const takenExpectedDoses = medsScheduledToday.reduce((acc, med) => {
        const medTakenTimes = todayLogs
          .filter((l) => l.medicationId === med.id && l.status === 'TAKEN')
          .map((l) => l.scheduledTime);

        const takenCount = med.times.filter((t) => medTakenTimes.includes(t)).length;
        return acc + takenCount;
      }, 0);

      const progress = Math.min(
        100,
        Math.round((takenExpectedDoses / totalExpectedDoses) * 100)
      );

      return {
        adherenceProgress: progress,
        allDosesCompleted: takenExpectedDoses >= totalExpectedDoses && totalExpectedDoses > 0,
        takenCountTotal: takenExpectedDoses,
        expectedCountTotal: totalExpectedDoses,
      };
    }, [medications, todayLogs]);

  const nextUpMed = useMemo(() => {
    const now = format(new Date(), 'HH:mm');
    let upcoming: { med: Medication; time: string } | null = null;

    medications.forEach((med) => {
      med.times.forEach((time) => {
        const alreadyTaken = todayLogs.some(
          (l) => l.medicationId === med.id && l.scheduledTime === time
        );
        if (time >= now && !alreadyTaken) {
          if (!upcoming || time < upcoming.time) {
            upcoming = { med, time };
          }
        }
      });
    });
    return upcoming;
  }, [medications, todayLogs]);

  const groupedMeds = useMemo(() => {
    const groups = {
      morning: [] as Medication[],
      afternoon: [] as Medication[],
      evening: [] as Medication[],
    };
    medications.forEach((med) => {
      if (med.times.length > 0) {
        const hour = parseInt(med.times[0].split(':')[0], 10);
        if (hour < 12) groups.morning.push(med);
        else if (hour < 17) groups.afternoon.push(med);
        else groups.evening.push(med);
      }
    });
    return groups;
  }, [medications]);

  const getSnoozedDosesForMed = (medId: string) => {
    const doses: { [time: string]: number } = {};
    snoozedItems.forEach((s) => {
      if (s.medicationId === medId) {
        doses[s.scheduledTime] = s.wakeUpTime;
      }
    });
    return doses;
  };

  const MoodButton = ({
    type,
    icon,
    label,
  }: {
    type: MoodType;
    icon: React.ReactNode;
    label: string;
  }) => {
    const isSelected = todaysMood?.type === type;
    const isGreat = type === 'GREAT';

    return (
      <button
        onClick={() => onLogMood(type)}
        className={`flex flex-col items-center justify-center gap-1 flex-1 min-h-[54px] py-1.5 px-1 rounded-2xl transition-all ${
          isSelected && isGreat
            ? 'border-2 border-emerald-500 bg-emerald-50/70'
            : isSelected
            ? 'border-2 border-blue-500 bg-blue-50/70'
            : 'border border-transparent hover:bg-slate-50'
        }`}
      >
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            isSelected
              ? isGreat
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-50 text-slate-400 border border-slate-100'
          }`}
        >
          {icon}
        </div>
        <span
          className={`text-[9px] font-black uppercase tracking-tight ${
            isSelected ? (isGreat ? 'text-emerald-600' : 'text-blue-600') : 'text-slate-400'
          }`}
        >
          {label}
        </span>
      </button>
    );
  };

  const showInstallBanner =
    diagnostics && !diagnostics.isStandalone && !installBannerDismissed;
  const isIos = diagnostics?.os === 'iOS' || diagnostics?.os === 'iPadOS';

  return (
    <div className={compactMode ? 'space-y-3.5 pb-6' : 'space-y-6 pb-8'}>
      {/* 1. One-Tap Home Screen Install / iOS Add to Home Screen Banner */}
      {showInstallBanner && (
        <div className="bg-gradient-to-r from-slate-900 to-blue-950 rounded-2xl p-3 text-white shadow-md flex items-center justify-between gap-2.5 border border-blue-500/20">
          <div
            onClick={onOpenCompatibilityModal}
            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center flex-shrink-0 text-blue-300">
              {isIos ? <Share size={17} /> : <Download size={17} />}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-blue-200 truncate">
                {isIos ? 'iPhone / iPad Safari Setup' : 'Install MediMind App'}
              </p>
              <p className="text-xs font-bold text-white/90 truncate">
                {isIos
                  ? 'Tap Share → Add to Home Screen for lock-screen alerts'
                  : 'Add to Home Screen for 1-tap launch & offline schedule'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {diagnostics?.isInstallable && onPromptInstall ? (
              <button
                onClick={onPromptInstall}
                className="min-h-[38px] px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[11px] font-black uppercase tracking-wider shadow-sm active:scale-95 transition-all"
              >
                Install
              </button>
            ) : (
              <button
                onClick={onOpenCompatibilityModal}
                className="min-h-[38px] px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-all"
              >
                Guide
              </button>
            )}
            {onDismissInstallBanner && (
              <button
                onClick={onDismissInstallBanner}
                className="w-8 h-8 rounded-lg text-white/50 hover:text-white flex items-center justify-center"
                title="Dismiss"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Responsive Grid: Single-screen compact column on phones, 2-column layout on tablets & foldables */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 md:gap-5 items-start">
        {/* Left Column (Summary, Reminders, Mood Check-in, Smart Insights) */}
        <div className="md:col-span-5 space-y-3.5">
          {/* Compact Greeting + Daily Progress Card */}
          <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                {greeting}
              </p>
              <h1 className="text-xl font-black text-[#1a2b4d] tracking-tight truncate">
                {userName}
              </h1>
              <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                {medications.length === 0
                  ? 'No medications scheduled yet'
                  : `${takenCountTotal} of ${expectedCountTotal} doses taken today`}
              </p>
            </div>

            {medications.length > 0 ? (
              <div className="relative w-14 h-14 flex-shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    fill="transparent"
                    stroke="#e0e7ff"
                    strokeWidth="6"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    fill="transparent"
                    stroke={allDosesCompleted ? '#10b981' : '#2563eb'}
                    strokeWidth="6"
                    strokeDasharray={163}
                    strokeDashoffset={163 - (163 * adherenceProgress) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-blue-600">
                  {adherenceProgress}%
                </div>
              </div>
            ) : (
              <button
                onClick={onAddMedication}
                className="min-h-[44px] px-3.5 py-2 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <Plus size={15} strokeWidth={3} /> Add Pill
              </button>
            )}
          </div>

          {/* Phone Notification & Compatibility Status Bar */}
          <div className="flex gap-2">
            {notificationPermission !== 'granted' && onOpenNotificationCenter ? (
              <button
                onClick={onOpenNotificationCenter}
                className="flex-1 p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl text-white shadow-sm flex items-center justify-between text-left active:scale-[0.99] transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <BellRing size={16} className="animate-bounce" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wider truncate">
                      {notificationPermission === 'denied'
                        ? 'Alerts Blocked'
                        : 'Enable Phone Alerts'}
                    </p>
                    <p className="text-[10px] text-white/80 font-medium truncate">
                      Tap for lock-screen sound & reminders
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-white text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-wider flex-shrink-0 ml-2">
                  Turn On
                </span>
              </button>
            ) : (
              onOpenNotificationCenter && (
                <button
                  onClick={onOpenNotificationCenter}
                  className="flex-1 px-3.5 py-2.5 bg-white border border-slate-100 rounded-2xl flex items-center justify-between text-slate-700 shadow-sm hover:bg-slate-50 transition-all active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                    <span className="text-xs font-bold text-slate-700 truncate">
                      Lock-Screen Alerts Active
                    </span>
                  </div>
                  <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider flex-shrink-0 ml-2">
                    Test &rarr;
                  </span>
                </button>
              )
            )}

            {onOpenCompatibilityModal && (
              <button
                onClick={onOpenCompatibilityModal}
                className="min-h-[44px] px-3 bg-white border border-slate-100 rounded-2xl flex items-center gap-1.5 text-slate-600 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all active:scale-95 flex-shrink-0"
                title="Device Compatibility & Health Check"
              >
                <Smartphone size={15} className="text-blue-600" />
                <span className="text-[10px] font-black uppercase tracking-wider">
                  Device Check
                </span>
              </button>
            )}
          </div>

          {/* Next Up Urgent Dose Card */}
          <AnimatePresence mode="wait">
            {medications.length > 0 &&
              (allDosesCompleted ? (
                <motion.div
                  key="caught-up"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#10a37f] rounded-3xl p-4 text-white shadow-md flex items-center justify-between relative overflow-hidden"
                >
                  <div className="relative z-10">
                    <h2 className="text-lg font-black tracking-tight leading-none">
                      All Caught Up!
                    </h2>
                    <p className="text-xs font-bold text-white/90 mt-1">
                      Every scheduled dose for today is complete.
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center relative z-10">
                    <Check size={22} strokeWidth={3.5} className="text-white" />
                  </div>
                </motion.div>
              ) : nextUpMed ? (
                <motion.div
                  key="next-up"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-br from-[#4f67ff] to-[#3b52e6] rounded-3xl p-4 text-white shadow-md relative overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="bg-white/15 rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5">
                      <Clock size={11} /> NEXT UP • {nextUpMed.time}
                    </div>
                    <span className="text-xs font-bold text-white/85">
                      {nextUpMed.med.dosage || '1 Dose'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-black uppercase tracking-tight leading-tight truncate">
                      {nextUpMed.med.name}
                    </h2>
                    <button
                      onClick={() =>
                        onLogMedication(nextUpMed.med.id, 'TAKEN', nextUpMed.time)
                      }
                      className="min-h-[44px] px-4 bg-white text-[#3b52e6] rounded-2xl font-black flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all uppercase tracking-wider text-xs flex-shrink-0"
                    >
                      <Check size={16} strokeWidth={3.5} /> Take Now
                    </button>
                  </div>
                </motion.div>
              ) : null)}
          </AnimatePresence>

          {/* Compact Daily Mood Check-in */}
          <div className="bg-white p-3.5 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Activity size={12} className="text-blue-500" /> Daily Mood Check-In
              </h3>
              {todaysMood && (
                <span className="text-[10px] font-black text-emerald-600 uppercase">
                  Logged: {todaysMood.type}
                </span>
              )}
            </div>
            <div className="flex justify-between gap-1">
              <MoodButton type="GREAT" icon={<ThumbsUp size={16} />} label="Great" />
              <MoodButton type="GOOD" icon={<Smile size={16} />} label="Good" />
              <MoodButton type="OKAY" icon={<Meh size={16} />} label="Okay" />
              <MoodButton type="LOW" icon={<Frown size={16} />} label="Low" />
              <MoodButton type="PAIN" icon={<Activity size={16} />} label="Pain" />
            </div>
          </div>

          {/* Smart Insights (if available) */}
          {insights && !loadingInsights && medications.length > 0 && (
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-indigo-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Sparkles size={14} />
                </div>
                <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                  Smart Insights
                </h3>
              </div>
              <div className="text-xs font-medium text-slate-600 leading-relaxed">
                <div dangerouslySetInnerHTML={{ __html: insights.replace(/\n/g, '<br/>') }} />
              </div>
            </div>
          )}
        </div>

        {/* Right Column (Medication Schedule Cards) */}
        <div className="md:col-span-7">
          {medications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center shadow-sm cursor-pointer hover:border-blue-300 transition-all active:scale-[0.99] group"
              onClick={onAddMedication}
            >
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 group-hover:bg-blue-100 transition-colors">
                <CalendarDays size={28} className="text-blue-600" strokeWidth={1.75} />
              </div>
              <h3 className="text-lg font-black text-[#1a2b4d] tracking-tight mb-1 uppercase">
                Your Pill Schedule is Empty
              </h3>
              <p className="text-slate-400 text-xs font-bold max-w-[240px] mx-auto leading-relaxed mb-4">
                Add your first medication to receive lock-screen reminders and track daily doses
                offline.
              </p>
              <span className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm">
                <Plus size={15} strokeWidth={3} /> Add First Medication
              </span>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {groupedMeds.morning.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                    <Sunrise size={14} className="text-amber-500" /> Morning Schedule
                  </h4>
                  {groupedMeds.morning.map((med) => (
                    <MedicationCard
                      key={med.id}
                      medication={med}
                      onDelete={onDeleteMedication}
                      onLog={onLogMedication}
                      onRefill={() => setSelectedMedForRefill(med)}
                      onEdit={onEditMedication}
                      onSnooze={onSnoozeMedication}
                      todayLogs={todayLogs.filter((log) => log.medicationId === med.id)}
                      snoozedDoses={getSnoozedDosesForMed(med.id)}
                      compact={compactMode}
                    />
                  ))}
                </div>
              )}

              {groupedMeds.afternoon.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                    <Clock size={14} className="text-blue-500" /> Afternoon Schedule
                  </h4>
                  {groupedMeds.afternoon.map((med) => (
                    <MedicationCard
                      key={med.id}
                      medication={med}
                      onDelete={onDeleteMedication}
                      onLog={onLogMedication}
                      onRefill={() => setSelectedMedForRefill(med)}
                      onEdit={onEditMedication}
                      onSnooze={onSnoozeMedication}
                      todayLogs={todayLogs.filter((log) => log.medicationId === med.id)}
                      snoozedDoses={getSnoozedDosesForMed(med.id)}
                      compact={compactMode}
                    />
                  ))}
                </div>
              )}

              {groupedMeds.evening.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                    <Moon size={14} className="text-indigo-500" /> Evening Schedule
                  </h4>
                  {groupedMeds.evening.map((med) => (
                    <MedicationCard
                      key={med.id}
                      medication={med}
                      onDelete={onDeleteMedication}
                      onLog={onLogMedication}
                      onRefill={() => setSelectedMedForRefill(med)}
                      onEdit={onEditMedication}
                      onSnooze={onSnoozeMedication}
                      todayLogs={todayLogs.filter((log) => log.medicationId === med.id)}
                      snoozedDoses={getSnoozedDosesForMed(med.id)}
                      compact={compactMode}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Refill Settings Modal */}
      <RefillSettingsModal
        isOpen={!!selectedMedForRefill}
        onClose={() => setSelectedMedForRefill(null)}
        medication={selectedMedForRefill}
        onSave={(medId, stock, threshold) => {
          if (onUpdateMedicationStockSettings) {
            onUpdateMedicationStockSettings(medId, stock, threshold);
          } else {
            onRefillMedication(medId, stock);
          }
        }}
      />
    </div>
  );
};

export default Dashboard;
