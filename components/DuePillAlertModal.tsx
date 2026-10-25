import React from 'react';
import { Pill, Check, Clock, Bell, Volume2, X } from 'lucide-react';
import { Medication } from '../types';

interface DuePillAlertModalProps {
  isOpen: boolean;
  medication: Medication | null;
  scheduledTime: string;
  onTake: () => void;
  onSnooze: (minutes: number) => void;
  onDismiss: () => void;
}

export const DuePillAlertModal: React.FC<DuePillAlertModalProps> = ({
  isOpen,
  medication,
  scheduledTime,
  onTake,
  onSnooze,
  onDismiss
}) => {
  if (!isOpen || !medication) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden p-6 text-center border-4 border-blue-500/20 relative animate-bounce-short">
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
        >
          <X size={16} />
        </button>

        {/* Pulsing Pill Icon */}
        <div className="relative mx-auto w-20 h-20 mb-4">
          <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
          <div className="relative w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/40">
            <Pill size={36} />
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black uppercase tracking-wider mb-2">
          <Clock size={12} /> Due at {scheduledTime}
        </div>

        <h3 className="text-2xl font-black text-slate-900 leading-tight mb-1">
          {medication.name}
        </h3>
        <p className="text-sm font-bold text-slate-400 mb-6">
          {medication.dosage || '1 Dose'} {medication.notes ? `• ${medication.notes}` : ''}
        </p>

        <div className="space-y-2.5">
          <button
            onClick={onTake}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all"
          >
            <Check size={20} strokeWidth={3} />
            Log as Taken Now
          </button>

          <button
            onClick={() => onSnooze(15)}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <Clock size={16} />
            Snooze 15 Minutes
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuePillAlertModal;
