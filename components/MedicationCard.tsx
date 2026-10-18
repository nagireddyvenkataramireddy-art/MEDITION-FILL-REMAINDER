
import React, { useMemo, useState } from 'react';
import { Medication, FrequencyType, LogEntry } from '../types';
import { 
  Pill, Clock, Check, Database, 
  Settings, AlarmClock, X, RefreshCw, Paperclip, Bell, Plus, Hourglass, Edit
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
  snoozedDoses?: {[time: string]: number}; 
}

const MedicationCard: React.FC<MedicationCardProps> = ({ 
  medication, onDelete, onLog, onRefill, onEdit, todayLogs, onSnooze, snoozedDoses = {} 
}) => {
  const [snoozeMenuFor, setSnoozeMenuFor] = useState<string | null>(null);

  const daysLeft = useMemo(() => {
    if (medication.currentStock === 0) return 0;
    const dailyDosageCount = medication.frequency === FrequencyType.DAILY ? medication.times.length : 1;
    return Math.floor(medication.currentStock / (dailyDosageCount || 1));
  }, [medication]);

  const handleSnoozeSelect = (time: string, minutes: number) => {
    onSnooze(medication.id, time, minutes);
    setSnoozeMenuFor(null);
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden mb-6 p-6"
    >
      {/* Header Info */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex gap-4">
          <div className="w-14 h-14 rounded-3xl bg-blue-50 flex items-center justify-center text-blue-500">
             <Paperclip size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-xl text-[#1a2b4d] uppercase tracking-tight">
                {medication.name}
              </h3>
              <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
            </div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
              1 • {medication.frequency === FrequencyType.DAILY ? 'Daily' : medication.frequency}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <button className="p-2 text-slate-300 hover:text-blue-500 transition-colors">
            <Bell size={20} />
          </button>
          <button 
            onClick={onRefill} 
            className="p-2 text-slate-300 hover:text-blue-500 transition-colors"
            title="Refill Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Stock & Refill Row */}
      <div className="space-y-4 mb-6 px-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Database size={18} className="text-slate-400" />
            <span className="font-black text-lg text-slate-700">{medication.currentStock} left</span>
            <button 
              onClick={onRefill}
              className="bg-white border border-blue-200 text-blue-600 px-4 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1.5 hover:bg-blue-50 transition-all shadow-sm ml-2"
            >
              <Plus size={14} strokeWidth={4} /> Refill
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2.5 ml-0.5">
           <Hourglass size={18} className="text-slate-300" />
           <span className="text-sm font-bold text-slate-400">~ {daysLeft} days left</span>
        </div>
      </div>

      {medication.notes && (
        <div className="mb-6 bg-amber-50/50 border border-amber-100 p-4 rounded-2xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
            <Edit size={16} className="text-amber-600" />
          </div>
          <span className="text-sm font-bold text-amber-800 italic">{medication.notes}</span>
        </div>
      )}

      {/* Doses List */}
      <div className="space-y-4 pt-2 border-t border-slate-50">
        {medication.times.map((time, idx) => {
          const log = todayLogs.find(l => l.scheduledTime === time);
          const isTaken = log?.status === 'TAKEN';
          const wakeUpTime = snoozedDoses[time];
          const isSnoozed = !!wakeUpTime && wakeUpTime > Date.now();
          const isMenuOpen = snoozeMenuFor === time;
          
          return (
            <div key={idx} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Clock size={22} className={isTaken ? 'text-slate-200' : 'text-slate-300'} />
                  <div>
                    <span className={`font-black text-xl tracking-tight ${isTaken ? 'text-slate-300' : 'text-[#1a2b4d]'}`}>
                      {time}
                    </span>
                    {isSnoozed && !isTaken && (
                      <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                        <AlarmClock size={10} /> Snoozed until {format(new Date(wakeUpTime), 'HH:mm')}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <AnimatePresence mode="wait">
                    {isTaken ? (
                      <motion.div 
                        key="taken-badge"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center gap-1.5 bg-[#f0fdf4] text-[#166534] px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest border border-emerald-100"
                      >
                        <Check size={16} strokeWidth={4} /> TAKEN
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="action-buttons"
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="flex items-center gap-2"
                      >
                        <button 
                          onClick={() => setSnoozeMenuFor(isMenuOpen ? null : time)}
                          className={`p-2 transition-colors rounded-lg ${isMenuOpen ? 'bg-amber-100 text-amber-600' : 'text-slate-300 hover:text-amber-500'}`}
                        >
                          <AlarmClock size={28} />
                        </button>
                        
                        <button 
                          onClick={() => onLog(medication.id, 'SKIPPED', time)}
                          className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <X size={28} />
                        </button>
                        
                        <button 
                          onClick={() => onLog(medication.id, 'TAKEN', time)}
                          className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-100 transition-all ml-1 shadow-sm"
                        >
                          <Check size={28} strokeWidth={4} />
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
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    className="overflow-hidden"
                  >
                    <div className="flex gap-2 p-2 bg-slate-50 rounded-2xl border border-slate-100 justify-end items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-auto ml-2">Snooze for:</span>
                      {[5, 10, 15].map(mins => (
                        <button
                          key={mins}
                          onClick={() => handleSnoozeSelect(time, mins)}
                          className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm active:scale-95"
                        >
                          {mins}m
                        </button>
                      ))}
                      <button 
                        onClick={() => setSnoozeMenuFor(null)}
                        className="p-1.5 text-slate-300 hover:text-slate-500"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-50 flex justify-end gap-6 px-1">
         <button onClick={() => onEdit(medication)} className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 hover:text-blue-500 transition-colors">
           <Edit size={14} /> Edit
         </button>
         <button onClick={() => onDelete(medication.id)} className="text-[11px] font-black text-red-400 uppercase tracking-widest hover:text-red-600 transition-colors">
           Remove
         </button>
      </div>
    </motion.div>
  );
};

export default MedicationCard;
