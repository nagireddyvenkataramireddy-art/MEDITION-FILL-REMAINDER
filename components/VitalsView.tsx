
import React, { useState, useMemo } from 'react';
import { VitalEntry, VitalType } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { Activity, Heart, Scale, Droplet, Plus, Watch, RefreshCw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface VitalsViewProps {
  vitals: VitalEntry[];
  onAddVital: (vital: VitalEntry) => void;
  watchConnected?: boolean;
  onSyncWatch?: () => Promise<{ type: VitalType, value: number } | null>;
}

const VitalsView: React.FC<VitalsViewProps> = ({ vitals, onAddVital, watchConnected = false, onSyncWatch }) => {
  const [activeType, setActiveType] = useState<VitalType>('BLOOD_PRESSURE');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const getUnit = (type: VitalType) => {
    switch(type) {
      case 'BLOOD_PRESSURE': return 'mmHg';
      case 'GLUCOSE': return 'mg/dL';
      case 'HEART_RATE': return 'bpm';
      case 'WEIGHT': return 'kg';
    }
  };

  const handleSync = async () => {
    if (onSyncWatch) {
      setIsSyncing(true);
      const data = await onSyncWatch();
      if (data) {
        onAddVital({
          id: uuidv4(),
          type: data.type,
          value: data.value.toString(),
          unit: getUnit(data.type),
          dateStr: format(new Date(), 'yyyy-MM-dd'),
          timestamp: Date.now()
        });
      }
      setIsSyncing(false);
    }
  };

  // Auto-sync when connected
  React.useEffect(() => {
    if (watchConnected) {
      handleSync();
    }
  }, [watchConnected]);

  const chartData = useMemo(() => {
    return vitals
      .filter(v => v.type === activeType)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(v => ({
        date: format(new Date(v.timestamp), 'MMM dd'),
        value: v.type === 'BLOOD_PRESSURE' ? parseInt(v.value.split('/')[0]) : parseFloat(v.value),
      }));
  }, [vitals, activeType]);

  const TabButton = ({ type, label, icon }: { type: VitalType, label: string, icon: React.ReactNode }) => (
    <button
      onClick={() => setActiveType(type)}
      className={`flex flex-col items-center justify-center min-w-[100px] h-24 p-3 rounded-2xl border-2 transition-all ${
        activeType === type 
          ? 'bg-white border-blue-600 shadow-md text-blue-600' 
          : 'bg-white border-slate-50 text-slate-400'
      }`}
    >
      {icon}
      <span className="text-[10px] font-bold mt-2 uppercase tracking-tighter">{label}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Scrollable Type Selector */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-1">
        <TabButton type="BLOOD_PRESSURE" label="Blood Pressure" icon={<Activity size={24} />} />
        <TabButton type="HEART_RATE" label="Heart Rate" icon={<Heart size={24} />} />
        <TabButton type="GLUCOSE" label="Glucose" icon={<Droplet size={24} />} />
        <TabButton type="WEIGHT" label="Weight" icon={<Scale size={24} />} />
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-50 p-8 min-h-[400px]">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">
            {activeType.replace('_', ' ')} Trends
          </h2>
          <div className="flex items-center gap-2">
            {watchConnected ? (
              <button onClick={handleSync} className="flex items-center gap-2 text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full uppercase">
                <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? 'Syncing...' : 'Sync Watch'}
              </button>
            ) : (
              <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full uppercase">
                <Watch size={12} className="inline mr-1" />
                No Watch
              </span>
            )}
            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full uppercase">
              Unit: {getUnit(activeType)}
            </span>
          </div>
        </div>

        {chartData.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{r: 6, fill: '#3b82f6', strokeWidth: 0}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Activity size={48} className="text-slate-100 mb-4" />
            <p className="text-slate-400 text-sm">No data recorded yet</p>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-50 flex items-center justify-between">
        <span className="font-bold text-slate-700">Log New Entry</span>
        <button onClick={() => setIsAdding(true)} className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
};

export default VitalsView;
