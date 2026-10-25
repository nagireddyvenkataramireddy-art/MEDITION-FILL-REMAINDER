import React, { useMemo, useState } from 'react';
import { Medication, FrequencyType, LogEntry } from '../types';
import {
  Clock,
  Check,
  Database,
  Settings,
  AlarmClock,
  X,
  Paperclip,
  Plus,
  Hourglass,
  Edit,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface MedicationCardProps {
  medication: Medication;
  onDelete: (id: string) => void;
  onLog: (medId: string, status: 'TAKEN' | 'SKIPPED', time?: string) => void;
  onRefill: () => void;
  onEdit: (med: Medication) => void;
  onSnooze: (medId: string, time: string, minutes: number) => void;
  todayLogs: LogEntry[];
  snoozedDoses?: { [time: string]: number };
  compact?: boolean;
}

const MedicationCard: React.FC<MedicationCardProps> = ({
  medication,
  onDelete,
  onLog,
  onRefill,
  onEdit,
  todayLogs,
  onSnooze,
  snoozedDoses = {},
  compact = true,
}) => {
  const [snoozeMenuFor, setSnoozeMenuFor] = useState<string | null>(null);

  const daysLeft = useMemo(() => {
    if (medication.currentStock === 0) return 0;
    const dailyDosageCount =
      medication.frequency === FrequencyType.DAILY ? medication.times.length : 1;
    return Math.floor(medication.currentStock / (dailyDosageCount || 1));
  }, [medication]);

  const handleSnoozeSelect = (time: string, minutes: number) => {
    onSnooze(medication.id, time, minutes);
    setSnoozeMenuFor(null);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden ${
        compact ? 'p-4 mb-3' : 'p-6 mb-5'
      }`}
    >
      {/* Compact Header Info + Stock Badge */}
      <div className="flex justify-between items-start gap-2 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`${
              compact ? 'w-10 h-10 rounded-2xl' : 'w-12 h-12 rounded-2xl'
            } bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0`}
          >
            <Paperclip size={compact ? 18 : 22} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3
                className={`font-black ${
                  compact ? 'text-base' : 'text-lg'
                } text-[#1a2b4d] uppercase tracking-tight truncate`}
              >
                {medication.name}
              </h3>
              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-bold text-slate-400">
              <span>{medication.dosage || '1 dose'}</span>
              <span>•</span>
              <span>
                {medication.frequency === FrequencyType.DAILY ? 'Daily' : medication.frequency}
              </span>
              <span>•</span>
              <span
                className={`inline-flex items-center gap-1 ${
                  medication.currentStock <= (medication.lowStockThreshold || 5)
                    ? 'text-amber-600 font-black'
                    : 'text-slate-500'
                }`}
              >
                <Database size={11} /> {medication.currentStock} left (~{daysLeft}d)
              </span>
            </div>
          </div>
        </div>

        {/* Action Icons with 44x44 touch hitboxes */}
        <div className="flex items-center gap-0.5 flex-shrink-0 -mr-1 -mt-1">
          <button
            onClick={onRefill}
            className="min-w-[40px] min-h-[40px] px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50/70 hover:bg-blue-100 flex items-center gap-1 transition-colors"
            title="Refill Stock"
          >
            <Plus size={12} strokeWidth={3} /> Refill
          </button>
          <button
            onClick={() => onEdit(medication)}
            className="w-10 h-10 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-slate-50 flex items-center justify-center transition-colors"
            title="Edit Medication"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={() => onDelete(medication.id)}
            className="w-10 h-10 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
            title="Remove Medication"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {medication.notes && (
        <div className="mb-3 bg-amber-50/60 border border-amber-100/80 px-3 py-2 rounded-xl flex items-center gap-2">
          <Edit size={13} className="text-amber-600 flex-shrink-0" />
          <span className="text-xs font-bold text-amber-800 truncate">{medication.notes}</span>
        </div>
      )}

      {/* Doses List */}
      <div className="space-y-2 pt-2.5 border-t border-slate-100">
        {medication.times.map((time, idx) => {
          const log = todayLogs.find((l) => l.scheduledTime === time);
          const isTaken = log?.status === 'TAKEN';
          const isSkipped = log?.status === 'SKIPPED';
          const wakeUpTime = snoozedDoses[time];
          const isSnoozed = !!wakeUpTime && wakeUpTime > Date.now();
          const isMenuOpen = snoozeMenuFor === time;

          return (
            <div key={idx} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between bg-slate-50/70 rounded-2xl px-3 py-1.5">
                <div className="flex items-center gap-2.5">
                  <Clock
                    size={17}
                    className={isTaken ? 'text-emerald-500' : 'text-blue-500'}
                  />
                  <div>
                    <span
                      className={`font-black ${
                        compact ? 'text-base' : 'text-lg'
                      } tracking-tight ${
                        isTaken
                          ? 'text-slate-400 line-through'
                          : isSkipped
                          ? 'text-slate-300 line-through'
                          : 'text-[#1a2b4d]'
                      }`}
                    >
                      {time}
                    </span>
                    {isSnoozed && !isTaken && (
                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider flex items-center gap-1">
                        <AlarmClock size={10} /> Snoozed until{' '}
                        {format(new Date(wakeUpTime), 'HH:mm')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <AnimatePresence mode="wait">
                    {isTaken ? (
                      <motion.div
                        key="taken-badge"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border border-emerald-200/60"
                      >
                        <Check size={13} strokeWidth={3.5} /> Taken
                      </motion.div>
                    ) : isSkipped ? (
                      <motion.div
                        key="skipped-badge"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center gap-1 bg-slate-100 text-slate-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider"
                      >
                        Skipped
                      </motion.div>
                    ) : (
                      <motion.div
                        key="action-buttons"
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="flex items-center gap-1"
                      >
                        <button
                          onClick={() => setSnoozeMenuFor(isMenuOpen ? null : time)}
                          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors ${
                            isMenuOpen
                              ? 'bg-amber-100 text-amber-700'
                              : 'text-slate-400 hover:text-amber-600 hover:bg-white'
                          }`}
                          title="Snooze Dose"
                        >
                          <AlarmClock size={20} />
                        </button>

                        <button
                          onClick={() => onLog(medication.id, 'SKIPPED', time)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-500 hover:bg-white transition-colors"
                          title="Skip Dose"
                        >
                          <X size={20} />
                        </button>

                        <button
                          onClick={() => onLog(medication.id, 'TAKEN', time)}
                          className="min-h-[44px] px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                          title="Mark Taken"
                        >
                          <Check size={16} strokeWidth={3.5} /> Take
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Snooze Menu Popover */}
              <AnimatePresence>
                {isMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex gap-1.5 p-2 bg-amber-50/70 rounded-xl border border-amber-100 justify-end items-center">
                      <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider mr-auto ml-1">
                        Snooze:
                      </span>
                      {[5, 10, 15, 30].map((mins) => (
                        <button
                          key={mins}
                          onClick={() => handleSnoozeSelect(time, mins)}
                          className="min-h-[36px] px-2.5 py-1 bg-white border border-amber-200 rounded-lg text-xs font-black text-amber-800 hover:bg-amber-100 transition-all shadow-sm active:scale-95"
                        >
                          {mins}m
                        </button>
                      ))}
                      <button
                        onClick={() => setSnoozeMenuFor(null)}
                        className="p-1.5 text-slate-400 hover:text-slate-600"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default MedicationCard;
