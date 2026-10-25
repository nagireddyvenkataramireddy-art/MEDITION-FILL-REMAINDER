
import React, { useMemo, useState, useEffect } from 'react';
import { Medication, LogEntry, FrequencyType, MoodType, MoodEntry, SnoozeEntry, VitalEntry } from '../types';
import MedicationCard from './MedicationCard';
import RefillSettingsModal from './RefillSettingsModal';
import { format } from 'date-fns';
import { 
  Sunrise, Moon, Clock, Smile, Meh, Frown, ThumbsUp, 
  Activity, Target, Plus, Check, Edit, Sparkles, 
  Calendar, CalendarDays, BellRing, AlertCircle
} from 'lucide-react';
import { getSmartInsights } from '../services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardProps {
  medications: Medication[];
  logs: LogEntry[];
  moods: MoodEntry[];
  vitals: VitalEntry[];
  snoozedItems: SnoozeEntry[];
  onDeleteMedication: (id: string) => void;
  onLogMedication: (medId: string, status: 'TAKEN' | 'SKIPPED', time?: string) => void;
  onRefillMedication: (medId: string, newStock: number) => void;
  onUpdateMedicationStockSettings?: (medId: string, currentStock: number, lowStockThreshold: number) => void;
  onEditMedication: (med: Medication) => void;
  onUpdateMedication: (med: Medication) => void;
  onLogMood: (mood: MoodType) => void;
  onSnoozeMedication: (medId: string, time: string, minutes: number) => void;
  onAddMedication: () => void;
  userName: string;
  notificationPermission?: NotificationPermission;
  onOpenNotificationCenter?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  medications, logs, moods, vitals, snoozedItems, 
  onDeleteMedication, onLogMedication, onRefillMedication, onUpdateMedicationStockSettings, onEditMedication, onUpdateMedication, onLogMood, onSnoozeMedication,
  onAddMedication,
  userName,
  notificationPermission = 'default',
  onOpenNotificationCenter
}) => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayLogs = logs.filter(log => log.dateStr === todayStr);
  const todaysMood = moods.find(m => m.dateStr === todayStr);

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
    if (hour < 12) return "Good Morning,";
    if (hour < 17) return "Good Afternoon,";
    return "Good Evening,";
  }, []);

  const { adherenceProgress, allDosesCompleted } = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 (Sun) to 6 (Sat)

    // Identify medications that have a schedule for today
    const medsScheduledToday = medications.filter(med => {
      if (med.frequency === FrequencyType.DAILY) return true;
      if (med.frequency === FrequencyType.INTERVAL) return true; 
      if (med.frequency === FrequencyType.WEEKLY) {
        return med.daysOfWeek?.includes(dayOfWeek);
      }
      return false;
    });

    if (medsScheduledToday.length === 0) return { adherenceProgress: 0, allDosesCompleted: false };
    
    const totalExpectedDoses = medsScheduledToday.reduce((acc, med) => acc + med.times.length, 0);
    const takenExpectedDoses = medsScheduledToday.reduce((acc, med) => {
      const medTakenTimes = todayLogs
        .filter(l => l.medicationId === med.id && l.status === 'TAKEN')
        .map(l => l.scheduledTime);
      
      const takenCount = med.times.filter(t => medTakenTimes.includes(t)).length;
      return acc + takenCount;
    }, 0);

    const progress = Math.min(100, Math.round((takenExpectedDoses / totalExpectedDoses) * 100));
    
    return {
      adherenceProgress: progress,
      allDosesCompleted: takenExpectedDoses >= totalExpectedDoses && totalExpectedDoses > 0
    };
  }, [medications, todayLogs]);

  const nextUpMed = useMemo(() => {
    const now = format(new Date(), 'HH:mm');
    let upcoming: { med: Medication; time: string } | null = null;

    medications.forEach(med => {
      med.times.forEach(time => {
        const alreadyTaken = todayLogs.some(l => l.medicationId === med.id && l.scheduledTime === time);
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
    const groups = { morning: [] as Medication[], afternoon: [] as Medication[], evening: [] as Medication[] };
    medications.forEach(med => {
      if (med.times.length > 0) {
        const hour = parseInt(med.times[0].split(':')[0]);
        if (hour < 12) groups.morning.push(med);
        else if (hour < 17) groups.afternoon.push(med);
        else groups.evening.push(med);
      }
    });
    return groups;
  }, [medications]);

  const getSnoozedDosesForMed = (medId: string) => {
    const doses: {[time: string]: number} = {};
    snoozedItems.forEach(s => {
      if (s.medicationId === medId) {
        doses[s.scheduledTime] = s.wakeUpTime;
      }
    });
    return doses;
  };

  const MoodButton = ({ type, icon, label }: { type: MoodType, icon: React.ReactNode, label: string }) => {
    const isSelected = todaysMood?.type === type;
    const isGreat = type === 'GREAT';
    
    return (
      <button 
        onClick={() => onLogMood(type)} 
        className={`flex flex-col items-center gap-2 flex-1 p-2 rounded-2xl transition-all ${
          isSelected && isGreat 
            ? 'border-2 border-emerald-500 bg-emerald-50/50' 
            : isSelected 
              ? 'border-2 border-blue-500 bg-blue-50/50' 
              : 'border border-transparent'
        }`}
      >
        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
          isSelected 
            ? isGreat ? 'bg-emerald-500 text-white shadow-lg' : 'bg-blue-600 text-white shadow-lg'
            : 'bg-white text-slate-300 border border-slate-100'
        }`}>
          {icon}
        </div>
        <span className={`text-[10px] font-black uppercase tracking-tight ${isSelected ? (isGreat ? 'text-emerald-600' : 'text-blue-600') : 'text-slate-400'}`}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header Layout per Screenshot */}
      <div className="flex justify-between items-start px-2 mt-4">
        <div>
          <h1 className="text-3xl font-black text-[#1a2b4d] tracking-tight leading-none">{greeting}</h1>
          <p className="text-2xl font-bold text-slate-400 leading-tight mt-1">{userName}</p>
        </div>
        {medications.length > 0 && (
          <div className="relative w-16 h-16">
            <svg className="w-full h-full -rotate-90">
              <circle cx="32" cy="32" r="26" fill="transparent" stroke="#e0e7ff" strokeWidth="5" />
              <circle 
                cx="32" cy="32" r="26" fill="transparent" stroke="#5d73ff" strokeWidth="5" 
                strokeDasharray={163} 
                strokeDashoffset={163 - (163 * adherenceProgress) / 100}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-blue-600">
              {adherenceProgress}%
            </div>
          </div>
        )}
      </div>

      {/* Phone Notification Banner */}
      {notificationPermission !== 'granted' && onOpenNotificationCenter ? (
        <div 
          onClick={onOpenNotificationCenter}
          className="mx-1 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2rem] text-white shadow-lg shadow-blue-500/25 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all border border-blue-400/30"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <BellRing size={20} className="animate-bounce" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider">
                {notificationPermission === 'denied' ? 'Alerts Blocked in Settings' : 'Turn On Phone Reminders'}
              </p>
              <p className="text-[11px] text-white/80 font-medium">
                {notificationPermission === 'denied' 
                  ? 'Tap to unblock notifications on your phone' 
                  : 'Get pill alerts & sound directly on your phone'}
              </p>
            </div>
          </div>
          <span className="px-3.5 py-2 bg-white text-blue-600 rounded-xl text-xs font-black uppercase tracking-wider flex-shrink-0 shadow-md">
            {notificationPermission === 'denied' ? 'Fix Now' : 'Turn On'}
          </span>
        </div>
      ) : onOpenNotificationCenter && (
        <div 
          onClick={onOpenNotificationCenter}
          className="mx-1 px-4 py-2.5 bg-white border border-slate-100 rounded-2xl flex items-center justify-between text-slate-700 shadow-sm cursor-pointer hover:bg-slate-50 transition-all active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs font-bold text-slate-700">
              Lock-Screen Reminders Armed & Active
            </p>
          </div>
          <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider flex items-center gap-1">
            Test / Settings &rarr;
          </span>
        </div>
      )}

      {/* Urgent Reminders Section - Moved to TOP as per request */}
      <section className="px-1">
        <AnimatePresence mode="wait">
          {medications.length > 0 && (
            allDosesCompleted ? (
              <motion.div 
                key="caught-up"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#10a37f] rounded-[2.5rem] p-8 text-white shadow-xl flex items-center justify-between relative overflow-hidden mb-8"
              >
                <div className="relative z-10">
                  <h2 className="text-3xl font-black mb-1 tracking-tighter leading-none">All Caught Up!</h2>
                  <p className="text-base font-bold text-white/90 tracking-tight mt-2">Completed for today.</p>
                </div>
                <Check size={40} strokeWidth={4} className="relative z-10 text-white opacity-80" />
                <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-white/5 rounded-full pointer-events-none" />
              </motion.div>
            ) : nextUpMed ? (
              <motion.div 
                key="next-up"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#5d73ff] rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden mb-8"
              >
                <div className="bg-white/10 rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 mb-4">
                  <Clock size={12} /> NEXT UP • {nextUpMed.time}
                </div>
                <h2 className="text-4xl font-black mb-1 uppercase tracking-tighter leading-none truncate pr-4">{nextUpMed.med.name}</h2>
                <p className="text-xl font-bold text-white/90 mb-6">{nextUpMed.med.dosage || '1 Dose'}</p>
                <button 
                  onClick={() => onLogMedication(nextUpMed.med.id, 'TAKEN', nextUpMed.time)}
                  className="w-full bg-white text-[#5d73ff] py-4 rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-all uppercase tracking-widest text-sm"
                >
                  <Check size={22} strokeWidth={4} /> Take Now
                </button>
              </motion.div>
            ) : null
          )}
        </AnimatePresence>
      </section>

      {/* Wellness Goals Section */}
      <section className="space-y-4 px-1">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
             <Target size={14} className="opacity-60" /> DAILY WELLNESS GOALS
          </h3>
          <button className="text-blue-500 text-[11px] font-black uppercase tracking-widest flex items-center gap-1 hover:underline">
            <Plus size={12} strokeWidth={4} /> Add Goal
          </button>
        </div>
        <div className="bg-white border-2 border-dashed border-slate-100 rounded-[2rem] py-12 flex items-center justify-center shadow-sm">
          <p className="text-slate-300 text-sm font-bold tracking-tight">No daily goals set yet.</p>
        </div>
      </section>

      {/* Daily Check-in Section */}
      <section className="space-y-4 px-1">
        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2">
          <Activity size={14} className="opacity-60" /> DAILY CHECK-IN
        </h3>
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-50 flex justify-between gap-1">
          <MoodButton type="GREAT" icon={<ThumbsUp size={24} />} label="Great" />
          <MoodButton type="GOOD" icon={<Smile size={24} />} label="Good" />
          <MoodButton type="OKAY" icon={<Meh size={24} />} label="Okay" />
          <MoodButton type="LOW" icon={<Frown size={24} />} label="Low" />
          <MoodButton type="PAIN" icon={<Activity size={24} />} label="Pain" />
        </div>
      </section>

      {/* Main Schedule Content */}
      <section className="px-1">
        {medications.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border-2 border-dashed border-slate-100 rounded-[3rem] p-12 text-center shadow-sm cursor-pointer hover:border-blue-200 transition-all active:scale-[0.98] group"
            onClick={onAddMedication}
          >
            <div className="w-20 h-20 bg-blue-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-sm border border-blue-50/50 group-hover:bg-blue-100 transition-colors">
               <CalendarDays size={40} className="text-blue-500" strokeWidth={1.5} />
            </div>
            <h3 className="text-2xl font-black text-[#1a2b4d] tracking-tight mb-2 uppercase">Your Schedule is Empty</h3>
            <p className="text-slate-400 text-sm font-bold max-w-[240px] mx-auto leading-relaxed">
              Add your first medication to start building your daily health routine.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-10 pt-4">
            {/* Grouped Medications List - Order: Morning -> Afternoon -> Evening */}
            {groupedMeds.morning.length > 0 && (
              <div className="space-y-4">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-2">
                    <Sunrise size={18} /> MORNING
                  </h4>
                  {groupedMeds.morning.map(med => (
                    <MedicationCard key={med.id} medication={med} onDelete={onDeleteMedication} onLog={onLogMedication} onRefill={() => setSelectedMedForRefill(med)} onEdit={onEditMedication} onSnooze={onSnoozeMedication} todayLogs={todayLogs.filter(log => log.medicationId === med.id)} snoozedDoses={getSnoozedDosesForMed(med.id)} />
                  ))}
              </div>
            )}

            {groupedMeds.afternoon.length > 0 && (
              <div className="space-y-4">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-2">
                    <Clock size={18} /> AFTERNOON
                  </h4>
                  {groupedMeds.afternoon.map(med => (
                    <MedicationCard key={med.id} medication={med} onDelete={onDeleteMedication} onLog={onLogMedication} onRefill={() => setSelectedMedForRefill(med)} onEdit={onEditMedication} onSnooze={onSnoozeMedication} todayLogs={todayLogs.filter(log => log.medicationId === med.id)} snoozedDoses={getSnoozedDosesForMed(med.id)} />
                  ))}
              </div>
            )}

            {groupedMeds.evening.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-2">
                  <Moon size={18} /> EVENING
                </h4>
                {groupedMeds.evening.map(med => (
                  <MedicationCard key={med.id} medication={med} onDelete={onDeleteMedication} onLog={onLogMedication} onRefill={() => setSelectedMedForRefill(med)} onEdit={onEditMedication} onSnooze={onSnoozeMedication} todayLogs={todayLogs.filter(log => log.medicationId === med.id)} snoozedDoses={getSnoozedDosesForMed(med.id)} />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Smart Insights if available */}
      {insights && !loadingInsights && medications.length > 0 && (
        <section className="px-1">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-indigo-100">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Sparkles size={18} />
              </div>
              <h3 className="text-[13px] font-black text-slate-700 uppercase tracking-widest">Smart Insights</h3>
            </div>
            <div className="text-sm font-medium text-slate-600 leading-relaxed prose prose-slate">
              <div dangerouslySetInnerHTML={{ __html: insights.replace(/\n/g, '<br/>') }} />
            </div>
          </div>
        </section>
      )}

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
