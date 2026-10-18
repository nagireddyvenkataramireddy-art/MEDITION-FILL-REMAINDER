
import React, { useState, useEffect, useRef } from 'react';
import { Medication, FrequencyType, SoundType, Profile } from '../types';
import { identifyPillFromImage, parseMedicationInput } from '../services/geminiService';
import { playNotificationSound } from '../services/audioService';
import { 
  Sparkles, X, Loader2, Package, Pill, Tablets, Activity, 
  Syringe, Upload, Camera, Trash2, Clock, GlassWater, 
  ShoppingBag, ScanLine, Repeat, Mic, Play, Calendar, 
  ChevronDown, Droplets, Wind, Zap
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format, parse, addHours, isBefore, startOfDay, addDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface AddMedicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (med: Medication) => void;
  onUpdate?: (med: Medication) => void;
  initialData?: Medication | null;
  activeProfile: Profile;
}

const COLORS = [
  { id: 'blue', color: '#3b82f6', bg: 'bg-blue-500' },
  { id: 'teal', color: '#5eead4', bg: 'bg-teal-300' },
  { id: 'red', color: '#fca5a5', bg: 'bg-red-300' },
  { id: 'orange', color: '#fdba74', bg: 'bg-orange-300' },
  { id: 'purple', color: '#d8b4fe', bg: 'bg-purple-300' },
];

const ICONS = [
  { id: 'pill', icon: <Pill size={20} /> },
  { id: 'tablet', icon: <Tablets size={20} /> },
  { id: 'liquid', icon: <GlassWater size={20} /> },
  { id: 'bottle', icon: <Package size={20} /> },
  { id: 'syringe', icon: <Syringe size={20} /> },
  { id: 'drops', icon: <Droplets size={20} /> },
  { id: 'spray', icon: <Wind size={20} /> },
  { id: 'vitals', icon: <Activity size={20} /> },
];

const SOUNDS: { id: SoundType; name: string }[] = [
  { id: 'default', name: 'Default' },
  { id: 'chime', name: 'Chime' },
  { id: 'alert', name: 'Alert' },
  { id: 'soft', name: 'Soft' },
  { id: 'harp', name: 'Harp' },
  { id: 'nature', name: 'Nature' },
  { id: 'arcade', name: 'Arcade' },
  { id: 'glass', name: 'Glass' },
  { id: 'shimmer', name: 'Shimmer' },
  { id: 'echo', name: 'Echo' },
];

const AddMedicationModal: React.FC<AddMedicationModalProps> = ({ isOpen, onClose, onAdd, onUpdate, initialData, activeProfile }) => {
  const [mode, setMode] = useState<'voice' | 'manual' | 'scan'>('voice');
  const [aiInput, setAiInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState<FrequencyType>(FrequencyType.DAILY);
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [intervalHours, setIntervalHours] = useState<number>(8);
  const [intervalStartTime, setIntervalStartTime] = useState<string>('08:00');
  const [notes, setNotes] = useState('');
  const [currentStock, setCurrentStock] = useState<number | string>(30);
  const [lowStockThreshold, setLowStockThreshold] = useState<number | string>(5);
  const [expiryDate, setExpiryDate] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reminderSound, setReminderSound] = useState<SoundType>('default');
  
  const [selectedColor, setSelectedColor] = useState('blue');
  const [selectedIcon, setSelectedIcon] = useState('pill');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setMode('manual');
        setName(initialData.name);
        setDosage(initialData.dosage);
        setFrequency(initialData.frequency);
        setTimes(initialData.times.length > 0 ? initialData.times : ['08:00']);
        setIntervalHours(initialData.interval || 8);
        setIntervalStartTime(initialData.startTime || '08:00');
        setNotes(initialData.notes || '');
        setCurrentStock(initialData.currentStock);
        setLowStockThreshold(initialData.lowStockThreshold);
        setExpiryDate(initialData.expiryDate || '');
        setStartDate(initialData.startDate || format(new Date(), 'yyyy-MM-dd'));
        setReminderSound(initialData.reminderSound || 'default');
        setSelectedColor(initialData.color || 'blue');
        setSelectedIcon(initialData.icon || 'pill');
      } else {
        resetForm();
      }
    }
  }, [isOpen, initialData, activeProfile]);

  const resetForm = () => {
    setName('');
    setDosage('');
    setFrequency(FrequencyType.DAILY);
    setTimes(['08:00']);
    setIntervalHours(8);
    setIntervalStartTime('08:00');
    setNotes('');
    setCurrentStock(30);
    setLowStockThreshold(5);
    setMode('voice');
    setAiInput('');
  };

  const handleVoiceSubmit = async () => {
    if (!aiInput.trim()) return;
    setIsParsing(true);
    const result = await parseMedicationInput(aiInput);
    if (result) {
      setName(result.name);
      setDosage(result.dosage || '');
      setFrequency(result.frequency || FrequencyType.DAILY);
      setTimes(result.times || ['08:00']);
      setNotes(result.notes || '');
      if (result.currentStock) setCurrentStock(result.currentStock);
      setMode('manual');
    }
    setIsParsing(false);
  };

  const calculateIntervalTimes = (start: string, interval: number): string[] => {
    const result: string[] = [];
    let current = parse(start, 'HH:mm', new Date());
    const stopTime = addDays(startOfDay(current), 1);
    const validInterval = Math.max(1, interval);
    for (let i = 0; i < 24; i += validInterval) {
      result.push(format(current, 'HH:mm'));
      current = addHours(current, validInterval);
      if (!isBefore(current, stopTime) && i + validInterval < 24) {
        if (format(current, 'HH:mm') === result[0]) break;
      }
    }
    return [...new Set(result)].sort();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    let finalTimes = times;
    if (frequency === FrequencyType.INTERVAL) {
      finalTimes = calculateIntervalTimes(intervalStartTime, intervalHours);
    } else if (frequency === FrequencyType.AS_NEEDED) {
      finalTimes = [];
    }

    const newMed: Medication = {
      id: initialData ? initialData.id : uuidv4(),
      name,
      dosage,
      frequency,
      times: finalTimes,
      interval: frequency === FrequencyType.INTERVAL ? intervalHours : undefined,
      startTime: frequency === FrequencyType.INTERVAL ? intervalStartTime : undefined,
      notes,
      color: selectedColor,
      icon: selectedIcon,
      daysOfWeek: [],
      currentStock: Number(currentStock) || 0,
      lowStockThreshold: Number(lowStockThreshold) || 0,
      expiryDate: expiryDate || undefined,
      startDate: startDate,
      reminderSound: reminderSound,
      lastRefillDate: initialData?.lastRefillDate,
    };

    if (initialData && onUpdate) onUpdate(newMed);
    else onAdd(newMed);
    onClose();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = (reader.result as string).split(',')[1];
      try {
        const result = await identifyPillFromImage(base64Data);
        if (result) {
          setName(result.name);
          if (result.dosage) setDosage(result.dosage);
          setMode('manual');
        }
      } catch (err) { console.error("Scanning failed", err); } finally { setIsScanning(false); }
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  const labelClass = "block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest";
  const inputClass = "w-full p-4 bg-white border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all text-slate-700 placeholder:text-slate-300 font-bold";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden max-h-[95vh] flex flex-col ring-1 ring-black/5">
        <div className="px-6 py-5 border-b border-slate-50 flex justify-between items-start flex-shrink-0">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight leading-none mb-1">
              {initialData ? 'Edit Medication' : 'Add Medication'}
            </h2>
            <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest">Profile: {activeProfile.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500 p-1">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-6">
          {/* Tab Switcher */}
          {!initialData && (
            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8">
              {[
                { id: 'voice', label: 'Voice', icon: <Sparkles size={16} /> },
                { id: 'manual', label: 'Manual', icon: null },
                { id: 'scan', label: 'Scan', icon: <Camera size={16} /> },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setMode(t.id as any)}
                  className={`flex-1 py-3.5 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${
                    mode === t.id ? 'bg-white shadow-sm text-blue-600 ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-500'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {mode === 'voice' && (
              <motion.div 
                key="voice"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-[#f0f7ff] p-5 rounded-[2rem] border border-blue-100 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-blue-500 shadow-sm border border-blue-50">
                    <Sparkles size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-slate-800 text-sm mb-1 uppercase tracking-tight">Gemini Assistant</h4>
                    <p className="text-xs text-slate-400 font-bold leading-relaxed">
                      Tap the mic and say something like:<br/>
                      <span className="text-blue-500 italic">"Take Amoxicillin 500mg three times a day for a week."</span>
                    </p>
                  </div>
                </div>

                <div className="relative group">
                  <textarea
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Type or speak your schedule..."
                    className="w-full h-48 p-6 bg-slate-50 border border-slate-100 rounded-[2rem] focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-300 outline-none transition-all text-slate-600 placeholder:text-slate-300 font-bold resize-none text-lg"
                  />
                  <button 
                    className="absolute bottom-4 right-4 w-14 h-14 bg-[#5d73ff] text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-200 active:scale-90 transition-all"
                  >
                    <Mic size={24} />
                  </button>
                </div>

                <button 
                  onClick={handleVoiceSubmit}
                  disabled={!aiInput.trim() || isParsing}
                  className="w-full py-5 bg-slate-300 text-white rounded-[2rem] font-black shadow-lg flex items-center justify-center gap-3 transition-all disabled:opacity-50 active:scale-[0.98]"
                >
                  {isParsing ? <Loader2 size={24} className="animate-spin" /> : <Sparkles size={20} />}
                  <span className="uppercase tracking-widest text-base">Create Schedule</span>
                </button>
              </motion.div>
            )}

            {mode === 'manual' && (
              <motion.form 
                key="manual"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                <div>
                  <label className={labelClass}>Medication Name</label>
                  <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lisinopril" className={inputClass} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Dosage</label>
                    <input required value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="e.g. 10mg" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Frequency</label>
                    <div className="relative">
                      <select value={frequency} onChange={(e) => setFrequency(e.target.value as FrequencyType)} className={`${inputClass} appearance-none pr-10`}>
                        <option value={FrequencyType.DAILY}>Daily</option>
                        <option value={FrequencyType.WEEKLY}>Weekly</option>
                        <option value={FrequencyType.INTERVAL}>Interval</option>
                        <option value={FrequencyType.AS_NEEDED}>As Needed</option>
                      </select>
                      <ChevronDown size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {frequency === FrequencyType.INTERVAL && (
                  <div className="bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100 grid grid-cols-2 gap-4 animate-slideDown">
                    <div>
                      <label className={labelClass}>Every (Hours)</label>
                      <input type="number" min="1" max="24" value={intervalHours} onChange={(e) => setIntervalHours(parseInt(e.target.value) || 1)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>First Dose</label>
                      <input type="time" value={intervalStartTime} onChange={(e) => setIntervalStartTime(e.target.value)} className={inputClass} />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className={labelClass}>Color</label>
                    <div className="flex gap-4">
                      {COLORS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedColor(c.id)}
                          className={`w-10 h-10 rounded-full transition-all flex items-center justify-center ${c.bg} ${
                            selectedColor === c.id ? 'ring-4 ring-offset-2 ring-blue-500 scale-110 shadow-lg' : 'opacity-60 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Icon</label>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                      {ICONS.map((i) => (
                        <button
                          key={i.id}
                          type="button"
                          onClick={() => setSelectedIcon(i.id)}
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
                            selectedIcon === i.id 
                              ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-sm' 
                              : 'border-slate-100 text-slate-300 hover:border-slate-200'
                          }`}
                        >
                          {i.icon}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Package size={18} className="text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory Tracking</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Current Stock</label>
                      <input type="number" min="0" value={currentStock} onChange={(e) => setCurrentStock(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Low Warning At</label>
                      <input type="number" min="0" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Expiry Date (Optional)</label>
                    <div className="relative">
                      <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputClass} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Start Date</label>
                  <div className="relative">
                    <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
                    <Calendar size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                  </div>
                </div>

                {frequency !== FrequencyType.INTERVAL && frequency !== FrequencyType.AS_NEEDED && (
                  <div>
                    <label className={labelClass}>Scheduled Times</label>
                    <div className="space-y-3">
                      {times.map((time, idx) => (
                        <div key={idx} className="flex gap-2">
                          <div className="relative flex-1">
                            <input type="time" value={time} onChange={(e) => { const nt=[...times]; nt[idx]=e.target.value; setTimes(nt); }} className={inputClass} />
                            <Clock size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                          </div>
                          {times.length > 1 && (
                            <button type="button" onClick={() => setTimes(times.filter((_,i)=>i!==idx))} className="p-4 text-red-300 hover:text-red-400">
                              <Trash2 size={24}/>
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => setTimes([...times, '08:00'])} className="text-sm font-black text-blue-600 px-4 py-2 hover:bg-blue-50 rounded-xl transition-all">
                        + Add Time
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className={labelClass}>Notification Sound</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select 
                        value={reminderSound} 
                        onChange={(e) => setReminderSound(e.target.value as SoundType)} 
                        className={`${inputClass} appearance-none pr-10`}
                      >
                        {SOUNDS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <ChevronDown size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    <button 
                      type="button" 
                      onClick={() => playNotificationSound(reminderSound)}
                      className="p-4 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition-all border border-blue-100"
                    >
                      <Play size={20} fill="currentColor" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Notes (Optional)</label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Take with food" className={inputClass} />
                </div>

                <div className="flex gap-4 pt-4 pb-8">
                  <button type="button" onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all">Cancel</button>
                  <button type="submit" className="flex-[2] py-4 bg-[#5d73ff] text-white rounded-2xl font-black shadow-lg shadow-blue-200 active:scale-[0.98] transition-all uppercase tracking-widest text-base">Save Medicine</button>
                </div>
              </motion.form>
            )}

            {mode === 'scan' && (
              <motion.div 
                key="scan"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 animate-fadeIn"
              >
                <input type="file" ref={fileInputRef} accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" />
                
                {isScanning ? (
                  <div className="flex flex-col items-center">
                    <div className="relative w-24 h-24 mb-8">
                      <Loader2 className="w-24 h-24 text-blue-500 animate-spin absolute" strokeWidth={1} />
                      <ScanLine className="w-12 h-12 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Analyzing Medication...</h3>
                    <p className="text-sm text-slate-400 font-bold mt-2">Checking label data with Gemini Vision</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="w-28 h-28 bg-blue-50 rounded-[2.5rem] flex items-center justify-center mx-auto text-blue-600 mb-4 shadow-sm border border-blue-100">
                      <Camera size={48} strokeWidth={1.5} />
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Scan Medication</h3>
                      <p className="text-slate-400 max-w-xs mx-auto text-sm leading-relaxed font-bold">
                        Take a clear photo of the pill, package, or prescription label for instant identification.
                      </p>
                    </div>
                    
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full bg-[#5d73ff] text-white py-5 rounded-[2rem] font-black flex items-center justify-center gap-4 shadow-lg shadow-blue-200 active:scale-95 transition-all text-base uppercase tracking-widest"
                    >
                      <Upload size={20} strokeWidth={3} /> Take or Upload Photo
                    </button>
                    
                    <button onClick={() => setMode('manual')} className="text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition-colors">
                      Skip and enter manually
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default AddMedicationModal;
