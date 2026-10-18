
import React, { useState, useEffect, useMemo } from 'react';
import { Medication, LogEntry, VitalEntry, MoodEntry, Profile, SnoozeEntry, Appointment } from './types';
import Dashboard from './components/Dashboard';
import AddMedicationModal from './components/AddMedicationModal';
import HistoryView from './components/HistoryView';
import VitalsView from './components/VitalsView';
import AssistantView from './components/AssistantView';
import CareView from './components/CareView';
import SettingsModal from './components/SettingsModal';
import OnboardingModal from './components/OnboardingModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Plus, Bell, Home, Calendar, Activity, ChevronDown, User, HeartPulse, MessageSquareText } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format, addMinutes } from 'date-fns';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'care' | 'vitals' | 'chat'>('home');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  
  const safeParse = (key: string, fallback: any) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch (e) {
      return fallback;
    }
  };

  const [profiles] = useState<Profile[]>(() => 
    safeParse('medimind_profiles', [{ id: 'default', name: 'Myself', avatar: '👤', themeColor: 'blue' }])
  );
  
  const [activeProfileId] = useState<string>(() => 
    localStorage.getItem('medimind_active_profile') || 'default'
  );

  const [medications, setMedications] = useState<Medication[]>(() => safeParse('medimind_meds', []));
  const [logs, setLogs] = useState<LogEntry[]>(() => safeParse('medimind_logs', []));
  const [vitals, setVitals] = useState<VitalEntry[]>(() => safeParse('medimind_vitals', []));
  const [moods, setMoods] = useState<MoodEntry[]>(() => safeParse('medimind_moods', []));
  const [snoozedItems, setSnoozedItems] = useState<SnoozeEntry[]>(() => safeParse('medimind_snoozes', []));
  const [appointments, setAppointments] = useState<Appointment[]>(() => safeParse('medimind_appts', []));
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];
  const currentMedications = useMemo(() => medications.filter(m => m.profileId === activeProfileId || !m.profileId), [medications, activeProfileId]);
  const currentLogs = useMemo(() => logs.filter(l => l.profileId === activeProfileId || !l.profileId), [logs, activeProfileId]);
  const currentAppointments = useMemo(() => appointments.filter(a => a.profileId === activeProfileId || !a.profileId), [appointments, activeProfileId]);
  const currentVitals = useMemo(() => vitals.filter(v => v.profileId === activeProfileId), [vitals, activeProfileId]);
  const currentMoods = useMemo(() => moods.filter(m => m.profileId === activeProfileId), [moods, activeProfileId]);

  const handleLogMedication = (medId: string, status: 'TAKEN' | 'SKIPPED', time?: string) => {
    const newLog = {
      id: uuidv4(),
      profileId: activeProfileId,
      medicationId: medId,
      timestamp: Date.now(),
      status,
      scheduledTime: time,
      dateStr: format(new Date(), 'yyyy-MM-dd')
    };
    setLogs(prev => [...prev, newLog]);
    
    setSnoozedItems(prev => prev.filter(s => !(s.medicationId === medId && s.scheduledTime === time)));
    
    if (status === 'TAKEN') {
      setMedications(prev => prev.map(m => m.id === medId ? { ...m, currentStock: Math.max(0, m.currentStock - 1) } : m));
    }
  };

  const sendNotification = (title: string, body: string, medicationId?: string, scheduledTime?: string) => {
    // Try using service worker for better background reliability
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          vibrate: [200, 100, 200],
          tag: medicationId ? `med-${medicationId}-${scheduledTime}` : 'medication-reminder',
          renotify: true,
          requireInteraction: true,
          data: { medicationId, scheduledTime },
          actions: medicationId && medicationId !== 'test' ? [
            { action: 'take', title: '✅ Log as Taken' },
            { action: 'dismiss', title: '✖ Dismiss' }
          ] : []
        });
      });
    } else {
      // Fallback to standard Notification
      new Notification(title, { body, icon: '/favicon.ico', requireInteraction: true });
    }
  };

  useEffect(() => {
    localStorage.setItem('medimind_meds', JSON.stringify(medications));
    localStorage.setItem('medimind_logs', JSON.stringify(logs));
    localStorage.setItem('medimind_vitals', JSON.stringify(vitals));
    localStorage.setItem('medimind_moods', JSON.stringify(moods));
    localStorage.setItem('medimind_snoozes', JSON.stringify(snoozedItems));
    localStorage.setItem('medimind_appts', JSON.stringify(appointments));
  }, [medications, logs, vitals, moods, snoozedItems, appointments]);

  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleTestNotification = () => {
    if (!('Notification' in window)) {
      alert('This browser does not support desktop notifications');
      return;
    }

    if (Notification.permission === 'granted') {
      sendNotification('Test Notification', 'This is a test of your medication reminders!', 'test', 'now');
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          sendNotification('Test Notification', 'This is a test of your medication reminders!', 'test', 'now');
        }
      });
    } else {
      alert('Notification permission is denied. Please enable it in your browser settings.');
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'LOG_MEDICATION') {
        handleLogMedication(event.data.medicationId, event.data.status, event.data.scheduledTime);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [medications, activeProfileId]);

  useEffect(() => {
    // Handle actions from URL parameters (when app is opened from notification)
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const medId = params.get('medId');
    const time = params.get('time');

    if (action === 'take' && medId) {
      handleLogMedication(medId, 'TAKEN', time || undefined);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [medications, activeProfileId]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setSnoozedItems(prev => prev.filter(s => s.wakeUpTime > now));
      
      // Check for due medications
      currentMedications.forEach(med => {
        if (med.times && med.times.includes(format(now, 'HH:mm'))) {
           const alreadyTaken = currentLogs.some(log => 
             log.medicationId === med.id && 
             log.dateStr === format(now, 'yyyy-MM-dd') &&
             log.scheduledTime === format(now, 'HH:mm')
           );
           
           if (!alreadyTaken) {
             if ('Notification' in window && Notification.permission === 'granted') {
               sendNotification('Medication Reminder', `It's time to take ${med.name}`, med.id, format(now, 'HH:mm'));
             }
           }
        }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [medications, logs, currentMedications, currentLogs]);

  useEffect(() => {
    const hasOnboarded = localStorage.getItem('medimind_onboarding_complete');
    if (!hasOnboarded) setIsOnboardingOpen(true);
  }, []);

  const handleUpdateMedicationStockSettings = (medId: string, currentStock: number, lowStockThreshold: number) => {
    setMedications(prev => prev.map(m => 
      m.id === medId ? { 
        ...m, 
        currentStock, 
        lowStockThreshold,
        lastRefillDate: format(new Date(), 'MMM do, yyyy') 
      } : m
    ));
  };

  const handleSnoozeMedication = (medId: string, time: string, minutes: number) => {
    const wakeUpTime = addMinutes(new Date(), minutes).getTime();
    setSnoozedItems(prev => [
      ...prev.filter(s => !(s.medicationId === medId && s.scheduledTime === time)),
      { medicationId: medId, scheduledTime: time, wakeUpTime }
    ]);
  };

  const handleAddAppointment = (appt: Appointment) => {
    setAppointments(prev => [...prev, { ...appt, profileId: activeProfileId }]);
  };

  const handleDeleteAppointment = (id: string) => {
    setAppointments(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans pb-32">
      <header className="px-6 pt-8 pb-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="relative">
            <button 
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center gap-3 bg-white border border-slate-100 rounded-full pl-1.5 pr-4 py-1.5 shadow-sm hover:shadow-md transition-all active:scale-95 ring-1 ring-black/5"
            >
              <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs shadow-inner">
                <User size={18} />
              </div>
              <div className="text-left">
                <p className="text-[9px] text-slate-400 font-black uppercase leading-none mb-1 tracking-widest">Hello,</p>
                <p className="text-sm font-black text-[#1a2b4d] leading-none">{activeProfile.name}</p>
              </div>
              <ChevronDown size={18} className="text-slate-300 ml-1" />
            </button>
            
            {isProfileMenuOpen && (
              <div className="absolute top-full left-0 mt-3 w-56 bg-white rounded-[1.5rem] shadow-2xl border border-slate-50 p-3 z-50 animate-slideDown ring-1 ring-black/5">
                <p className="text-[10px] font-black text-slate-400 uppercase p-3 tracking-widest">Select Account</p>
                <button className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 text-sm font-black text-blue-600">
                  <div className="flex items-center gap-3">
                    <User size={18} /> {activeProfile.name}
                  </div>
                  <div className="w-2.5 h-2.5 bg-blue-600 rounded-full shadow-sm"></div>
                </button>
                <div className="h-px bg-slate-100 my-2 mx-2"></div>
                <button onClick={() => { setIsSettingsModalOpen(true); setIsProfileMenuOpen(false); }} className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-slate-50 text-sm font-black text-slate-500">
                  <Plus size={18} /> Manage Profiles
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button className="w-11 h-11 bg-white rounded-full flex items-center justify-center text-slate-400 shadow-sm border border-slate-100 hover:text-blue-500 transition-colors">
              <Bell size={22} />
            </button>
            <button onClick={() => setIsSettingsModalOpen(true)} className="w-11 h-11 bg-white rounded-full flex items-center justify-center text-slate-400 shadow-sm border border-slate-100 hover:text-blue-500 transition-colors">
              <User size={22} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-2">
        <ErrorBoundary>
          {activeTab === 'home' && (
            <Dashboard 
              medications={currentMedications} 
              logs={currentLogs} 
              moods={currentMoods}
              vitals={currentVitals}
              snoozedItems={snoozedItems} 
              onDeleteMedication={(id) => setMedications(m => m.filter(x => x.id !== id))}
              onLogMedication={handleLogMedication} 
              onRefillMedication={(id, stock) => setMedications(prev => prev.map(m => m.id === id ? { ...m, currentStock: stock, lastRefillDate: format(new Date(), 'MMM do, yyyy') } : m))}
              onUpdateMedicationStockSettings={handleUpdateMedicationStockSettings}
              onEditMedication={(med) => { setEditingMedication(med); setIsAddModalOpen(true); }}
              onUpdateMedication={(med) => setMedications(m => m.map(x => x.id === med.id ? med : x))}
              onLogMood={(type) => setMoods(prev => [...prev, { id: uuidv4(), profileId: activeProfileId, type, timestamp: Date.now(), dateStr: format(new Date(), 'yyyy-MM-dd') }])}
              onSnoozeMedication={handleSnoozeMedication}
              onAddMedication={() => { setEditingMedication(null); setIsAddModalOpen(true); }}
              userName={activeProfile.name}
            />
          )}
          {activeTab === 'history' && <HistoryView medications={currentMedications} logs={currentLogs} moods={currentMoods} userName={activeProfile.name} />}
          {activeTab === 'care' && (
            <CareView 
              medications={currentMedications} 
              appointments={currentAppointments}
              onAddAppointment={handleAddAppointment}
              onDeleteAppointment={handleDeleteAppointment}
            />
          )}
          {activeTab === 'vitals' && (
            <VitalsView 
              vitals={currentVitals} 
              onAddVital={(v) => setVitals(prev => [...prev, {...v, profileId: activeProfileId}])}
              watchConnected={false} // TODO: Implement actual Bluetooth connection
              onSyncWatch={async () => {
                // TODO: Implement actual Bluetooth sync
                return null;
              }}
            />
          )}
          {activeTab === 'chat' && <AssistantView medications={currentMedications} />}
        </ErrorBoundary>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-4 py-4 pb-10 z-30 flex justify-between items-end shadow-[0_-8px_30px_rgb(0,0,0,0.06)]">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1.5 px-3 transition-all ${activeTab === 'home' ? 'text-blue-600 scale-105' : 'text-slate-300'}`}>
          <Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">Home</span>
        </button>
        
        <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1.5 px-3 transition-all ${activeTab === 'history' ? 'text-blue-600 scale-105' : 'text-slate-300'}`}>
          <Calendar size={24} strokeWidth={activeTab === 'history' ? 2.5 : 2} />
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">History</span>
        </button>
        
        <div className="relative px-2">
          <button 
            onClick={() => { setEditingMedication(null); setIsAddModalOpen(true); }} 
            className="w-16 h-16 bg-blue-600 rounded-full text-white shadow-[0_12px_24px_rgba(37,99,235,0.4)] flex items-center justify-center border-4 border-white mb-2 transform -translate-y-2 active:scale-90 transition-all"
          >
            <Plus size={32} strokeWidth={4} />
          </button>
        </div>

        <button onClick={() => setActiveTab('vitals')} className={`flex flex-col items-center gap-1.5 px-3 transition-all ${activeTab === 'vitals' ? 'text-blue-600 scale-105' : 'text-slate-300'}`}>
          <Activity size={24} strokeWidth={activeTab === 'vitals' ? 2.5 : 2} />
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">Vitals</span>
        </button>

        <button onClick={() => setActiveTab('care')} className={`flex flex-col items-center gap-1.5 px-3 transition-all ${activeTab === 'care' ? 'text-blue-600 scale-105' : 'text-slate-300'}`}>
          <HeartPulse size={24} strokeWidth={activeTab === 'care' ? 2.5 : 2} />
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">Care</span>
        </button>

        <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center gap-1.5 px-3 transition-all ${activeTab === 'chat' ? 'text-blue-600 scale-105' : 'text-slate-300'}`}>
          <MessageSquareText size={24} strokeWidth={activeTab === 'chat' ? 2.5 : 2} />
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">Assistant</span>
        </button>
      </nav>

      <AddMedicationModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onAdd={(m) => setMedications(prev => [...prev, {...m, profileId: activeProfileId}])} 
        onUpdate={(m) => setMedications(prev => prev.map(x => x.id === m.id ? m : x))} 
        initialData={editingMedication} 
        activeProfile={activeProfile} 
      />
      <SettingsModal 
        isOpen={isSettingsModalOpen} 
        onClose={() => setIsSettingsModalOpen(false)} 
        profiles={profiles} 
        activeProfileId={activeProfileId} 
        onTestNotification={handleTestNotification}
      />
      <OnboardingModal isOpen={isOnboardingOpen} onClose={() => { localStorage.setItem('medimind_onboarding_complete', 'true'); setIsOnboardingOpen(false); }} userName={activeProfile.name} />
    </div>
  );
};

export default App;
