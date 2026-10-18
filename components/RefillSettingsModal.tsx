
import React, { useState, useEffect } from 'react';
import { Medication } from '../types';
import { X, Settings, Save, Info, AlertTriangle } from 'lucide-react';

interface RefillSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  medication: Medication | null;
  onSave: (medId: string, currentStock: number, lowStockThreshold: number) => void;
}

const RefillSettingsModal: React.FC<RefillSettingsModalProps> = ({ isOpen, onClose, medication, onSave }) => {
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(5);

  useEffect(() => {
    if (medication) {
      setCurrentStock(medication.currentStock);
      setLowStockThreshold(medication.lowStockThreshold || 5);
    }
  }, [medication, isOpen]);

  if (!isOpen || !medication) return null;

  const dailyDose = medication.times.length || 1;
  const daysUntilAlert = Math.max(0, Math.floor((currentStock - lowStockThreshold) / dailyDose));

  const handleSave = () => {
    onSave(medication.id, currentStock, lowStockThreshold);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-[2rem] w-full max-w-sm shadow-2xl overflow-hidden border border-slate-100">
        <div className="px-6 py-5 border-b border-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Settings size={20} />
            </div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight">Refill Reminder Settings</h2>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Current Stock</label>
              <input 
                type="number" 
                value={currentStock} 
                onChange={(e) => setCurrentStock(parseInt(e.target.value) || 0)}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Alert Below</label>
              <input 
                type="number" 
                value={lowStockThreshold} 
                onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 0)}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
              />
            </div>
          </div>

          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 flex items-start gap-3">
            <div className="mt-0.5">
              <Info size={16} className="text-blue-500" />
            </div>
            <p className="text-xs font-bold text-blue-600/80 leading-relaxed">
              At current dose, stock alert will trigger in <span className="text-blue-700">~{daysUntilAlert} days</span>.
            </p>
          </div>

          <button 
            onClick={handleSave}
            className="w-full bg-[#5d73ff] text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg shadow-blue-200 active:scale-[0.98] transition-all uppercase tracking-widest text-sm"
          >
            <Save size={18} /> Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default RefillSettingsModal;
