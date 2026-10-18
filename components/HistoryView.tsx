
import React, { useState, useMemo } from 'react';
import { Medication, LogEntry, VitalEntry, MoodEntry, MoodType } from '../types';
import { format, subDays, isSameDay, startOfDay } from 'date-fns';
import { 
  Activity, Sparkles, Printer, Copy, X, Loader2, CheckCircle2, 
  Clock, FileText, Heart, Smile
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, Legend 
} from 'recharts';
import { generateAIHealthReport } from '../services/geminiService';

interface HistoryViewProps {
  medications: Medication[];
  logs: LogEntry[];
  vitals?: VitalEntry[];
  moods?: MoodEntry[];
  userName: string;
}

const HistoryView: React.FC<HistoryViewProps> = ({ medications, logs, vitals = [], moods = [], userName }) => {
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportText, setReportText] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const last7Days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => subDays(new Date(), 6 - i));
  }, []);

  // Calculate chart data for adherence
  const adherenceChartData = useMemo(() => {
    return last7Days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayLogs = logs.filter(l => l.dateStr === dateStr);
      const taken = dayLogs.filter(l => l.status === 'TAKEN').length;
      const skipped = dayLogs.filter(l => l.status === 'SKIPPED').length;
      return {
        name: format(day, 'EEE'),
        Taken: taken,
        Skipped: skipped,
        fullDate: day
      };
    });
  }, [logs, last7Days]);

  const handleGenerateReport = async () => {
    setIsReportOpen(true);
    if (reportText) return;
    setIsGenerating(true);
    const report = await generateAIHealthReport(medications, logs, moods, vitals, userName);
    setReportText(report);
    setIsGenerating(false);
  };

  const getMoodEmoji = (type?: MoodType) => {
    switch(type) {
      case 'GREAT': return '🤩';
      case 'GOOD': return '🙂';
      case 'OKAY': return '😐';
      case 'LOW': return '😔';
      case 'PAIN': return '😣';
      default: return null;
    }
  };

  const dayLogs = useMemo(() => {
    const start = startOfDay(selectedDay);
    return logs
      .filter(l => isSameDay(new Date(l.timestamp), start))
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [selectedDay, logs]);

  const copyToClipboard = () => {
    if (reportText) {
      navigator.clipboard.writeText(reportText);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24">
      {/* 1. Adherence History Chart */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-50 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Activity size={20} className="text-blue-500" />
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-tight">
            Adherence History (Last 7 Days)
          </h3>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={adherenceChartData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontWeight: 700, fontSize: '12px' }}
              />
              <Legend 
                verticalAlign="bottom" 
                align="center" 
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}
              />
              <Bar dataKey="Skipped" stackId="a" fill="#cbd5e1" radius={[0, 0, 0, 0]} barSize={24} />
              <Bar dataKey="Taken" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Mood History Section */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-50 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Heart size={20} className="text-pink-500" />
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-tight">Mood History</h3>
          </div>
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full">
            Last 7 Days
          </span>
        </div>
        <div className="flex justify-between items-center px-1">
          {last7Days.map((day, i) => {
            const isSelected = isSameDay(day, selectedDay);
            const dayMood = moods.find(m => isSameDay(new Date(m.timestamp), day));
            const emoji = getMoodEmoji(dayMood?.type);

            return (
              <button
                key={i}
                onClick={() => setSelectedDay(day)}
                className="flex flex-col items-center gap-3 transition-all active:scale-95"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  isSelected 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 ring-4 ring-blue-50' 
                    : 'bg-slate-50 text-slate-300'
                }`}>
                  {emoji ? <span className="text-xl">{emoji}</span> : <div className="w-1.5 h-1.5 rounded-full bg-slate-400 opacity-30" />}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>
                  {format(day, 'EEE')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. AI Health Report Card */}
      <div className="px-1">
        <AnimatePresence mode="wait">
          {!isReportOpen ? (
            <motion.div 
              key="trigger"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gradient-to-br from-[#6366f1] to-[#a855f7] p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden"
            >
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-yellow-300">
                    <Sparkles size={20} />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight leading-none">AI Health Report</h2>
                </div>
                <p className="text-indigo-50 text-sm font-bold max-w-[280px] leading-relaxed mb-8">
                  Generate a comprehensive summary of your adherence, vitals, and logs for your doctor.
                </p>
                <button 
                  onClick={handleGenerateReport}
                  className="w-full bg-white text-indigo-600 py-4 rounded-2xl font-black shadow-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-all uppercase tracking-widest text-sm"
                >
                  <FileText size={20} /> Generate Report
                </button>
              </div>
              {/* Decorative elements */}
              <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl pointer-events-none" />
            </motion.div>
          ) : (
            <motion.div 
              key="report"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-br from-[#6366f1] to-[#a855f7] p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                  <Sparkles size={24} className="text-yellow-300" />
                  <h2 className="text-xl font-black tracking-tight uppercase leading-none">Your AI Report</h2>
                </div>
                <button onClick={() => setIsReportOpen(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                   <X size={20} />
                </button>
              </div>
              
              <div className="bg-white/10 backdrop-blur-md rounded-[1.5rem] border border-white/10 p-6 mb-8 min-h-[200px] relative z-10 overflow-y-auto max-h-[400px] no-scrollbar">
                {isGenerating ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
                    <Loader2 className="w-12 h-12 text-white/50 animate-spin" strokeWidth={3} />
                    <p className="text-xs font-black uppercase tracking-widest text-white/50">Analyzing Health Data...</p>
                  </div>
                ) : (
                  <div className="text-sm font-bold text-white leading-relaxed whitespace-pre-line prose prose-invert">
                    {reportText}
                  </div>
                )}
              </div>

              {!isGenerating && (
                <div className="flex gap-3 relative z-10">
                  <button onClick={() => window.print()} className="flex-1 bg-white text-indigo-600 py-3.5 rounded-xl font-black flex items-center justify-center gap-2 shadow-lg text-[10px] uppercase tracking-widest active:scale-95 transition-all">
                    <Printer size={16} /> Print
                  </button>
                  <button onClick={copyToClipboard} className="flex-1 bg-[#5d73ff] text-white py-3.5 rounded-xl font-black flex items-center justify-center gap-2 shadow-lg text-[10px] uppercase tracking-widest active:scale-95 transition-all">
                    <Copy size={16} /> Copy
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. Recent Activity Section */}
      <div className="space-y-4 px-1">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
             <Activity size={14} /> Recent Activity
          </h3>
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
            {format(selectedDay, 'MMMM do')}
          </span>
        </div>
        
        <div className="space-y-3">
          {dayLogs.length > 0 ? (
            dayLogs.map(log => {
              const med = medications.find(m => m.id === log.medicationId);
              const isTaken = log.status === 'TAKEN';
              return (
                <motion.div 
                  key={log.id} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white p-5 rounded-[2rem] border border-slate-50 shadow-sm flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
                      isTaken 
                        ? 'bg-emerald-50 text-emerald-500 border border-emerald-100' 
                        : 'bg-red-50 text-red-400 border border-red-100'
                    }`}>
                      {isTaken ? <CheckCircle2 size={24} strokeWidth={2.5} /> : <X size={24} strokeWidth={2.5} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-[#1a2b4d] text-lg uppercase tracking-tight leading-none">
                          {med?.name || 'Unknown'}
                        </h4>
                        {med?.dosage && (
                          <span className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-md text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            {med.dosage}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 text-slate-400">
                        <Clock size={12} className="opacity-60" />
                        <p className="text-[11px] font-bold uppercase tracking-wider">
                          {format(new Date(log.timestamp), 'h:mm a')}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                    isTaken 
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                      : 'bg-red-50 text-red-500 border-red-100'
                  }`}>
                    {log.status}
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="py-16 text-center bg-white/50 border-2 border-dashed border-slate-100 rounded-[2.5rem]">
               <Activity size={32} className="mx-auto text-slate-200 mb-3" />
               <p className="text-xs font-black text-slate-300 uppercase tracking-widest">No activity recorded for this day</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryView;
