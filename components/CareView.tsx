
import React, { useState, useEffect, useMemo } from 'react';
import { Medication, PharmacySearchResponse, ConditionAdvice, Appointment } from '../types';
import SafetyCheck from './SafetyCheck';
import { 
  ShieldCheck, Pill, Hospital, Calendar, 
  Plus, X, Stethoscope, Clock, MapPin, 
  ChevronDown, ChevronRight, Heart, 
  CheckCircle2, XCircle, Loader2, Send, Search, List, CalendarDays, Edit2,
  CalendarPlus, ChevronLeft
} from 'lucide-react';
import { findNearbyPlaces, getConditionAdvice } from '../services/geminiService';
import { 
  format, 
  parseISO, 
  addHours, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday
} from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface CareViewProps {
  medications: Medication[];
  appointments?: Appointment[];
  onAddAppointment?: (appt: Appointment) => void;
  onDeleteAppointment?: (id: string) => void;
}

const SPECIALTIES = [
  "General Practitioner",
  "Cardiologist",
  "Dermatologist",
  "Endocrinologist",
  "Gastroenterologist",
  "Neurologist",
  "Ophthalmologist",
  "Pediatrician",
  "Psychiatrist",
  "Orthopedic Surgeon",
  "Other"
];

const CareView: React.FC<CareViewProps> = ({ medications, appointments = [], onAddAppointment, onDeleteAppointment }) => {
  const [activeTab, setActiveTab] = useState<'visits' | 'safety' | 'wellness' | 'pharmacy' | 'hospital'>('visits');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [locationCoords, setLocationCoords] = useState<{lat: number, lng: number} | null>(null);
  const [isAddingAppointment, setIsAddingAppointment] = useState(false); 
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Appointment Form State
  const [doctorName, setDoctorName] = useState('');
  const [specialty, setSpecialty] = useState('Cardiologist');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  // Search States
  const [pharmacies, setPharmacies] = useState<PharmacySearchResponse | null>(null);
  const [hospitals, setHospitals] = useState<PharmacySearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  
  // Wellness States
  const [conditionInput, setConditionInput] = useState('');
  const [advice, setAdvice] = useState<ConditionAdvice | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [lastSearchedCondition, setLastSearchedCondition] = useState('');

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocationCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn("Location access denied")
      );
    }
  }, []);

  const handleSearchPlaces = async (type: 'pharmacy' | 'hospital') => {
    if (!locationCoords) {
      alert("Please enable location services to find nearby facilities.");
      return;
    }
    setSearching(true);
    const results = await findNearbyPlaces(locationCoords.lat, locationCoords.lng, type);
    if (type === 'pharmacy') setPharmacies(results);
    else setHospitals(results);
    setSearching(false);
  };

  const handleGetAdvice = async () => {
    if (!conditionInput.trim()) return;
    setLoadingAdvice(true);
    const result = await getConditionAdvice(conditionInput);
    if (result) {
      setAdvice(result);
      setLastSearchedCondition(conditionInput);
    }
    setLoadingAdvice(false);
  };

  const handleAddAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddAppointment) return;

    if (!doctorName.trim()) {
      alert("Please fill in the Doctor Name.");
      return;
    }

    const newAppt: Appointment = {
      id: `appt-${Date.now()}`,
      doctorName: doctorName.trim(),
      specialty: specialty,
      date: date || format(new Date(), 'yyyy-MM-dd'),
      time: time || format(new Date(), 'HH:mm'),
      location: location.trim(),
      notes: notes.trim()
    };

    onAddAppointment(newAppt);
    setIsAddingAppointment(false);
    resetForm();
  };

  const resetForm = () => {
    setDoctorName('');
    setSpecialty('Cardiologist');
    setDate('');
    setTime('');
    setLocation('');
    setNotes('');
  };

  const generateGoogleCalendarUrl = (appt: Appointment) => {
    try {
      const startDateTime = parseISO(`${appt.date}T${appt.time}`);
      const endDateTime = addHours(startDateTime, 1);
      const formatGCal = (d: Date) => format(d, "yyyyMMdd'T'HHmmss");
      const title = encodeURIComponent(`Medical Appointment: ${appt.doctorName} (${appt.specialty})`);
      const dates = `${formatGCal(startDateTime)}/${formatGCal(endDateTime)}`;
      const details = encodeURIComponent(`${appt.notes}\n\nScheduled via MediMind App`);
      const loc = encodeURIComponent(appt.location || "Clinic/Hospital");
      return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${loc}`;
    } catch (e) {
      return "#";
    }
  };

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const appointmentsOnSelectedDay = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return appointments.filter(appt => appt.date === dateStr);
  }, [selectedDate, appointments]);

  const TabButton = ({ id, label, icon }: { id: typeof activeTab, label: string, icon: React.ReactNode }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all whitespace-nowrap ${
        activeTab === id 
          ? 'bg-blue-600 text-white shadow-md' 
          : 'bg-white text-slate-400 hover:text-slate-600 border border-transparent'
      }`}
    >
      {icon} {label}
    </button>
  );

  const labelClass = "block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest";
  const inputClass = "w-full p-4 bg-white border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-medium text-slate-800 transition-all placeholder:text-slate-300";

  // Fix: Explicitly type AppointmentItem as React.FC to handle React's reserved props like 'key'
  const AppointmentItem: React.FC<{ appt: Appointment }> = ({ appt }) => {
    const dateObj = parseISO(appt.date);
    return (
      <motion.div 
        key={appt.id} 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center justify-between group"
      >
        <div className="flex items-center gap-5">
          <div className="flex flex-col items-center justify-center min-w-[64px] h-16 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(dateObj, 'MMM')}</span>
            <span className="text-2xl font-black text-slate-800 leading-none">{format(dateObj, 'dd')}</span>
          </div>
          <div>
            <h4 className="font-black text-[#1a2b4d] text-lg leading-tight uppercase tracking-tight">
              {appt.doctorName}
            </h4>
            <p className="text-xs font-bold text-blue-600 mt-0.5">
              {appt.specialty}
            </p>
            <div className="flex items-center gap-1.5 text-slate-400 mt-1.5">
              <Clock size={12} />
              <span className="text-[11px] font-bold uppercase tracking-wider">
                {appt.time.includes(':') ? format(parseISO(`2000-01-01T${appt.time}`), 'h:mm a') : appt.time}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
           <a 
             href={generateGoogleCalendarUrl(appt)}
             target="_blank"
             rel="noopener noreferrer"
             className="p-2 text-slate-300 hover:text-emerald-500 transition-colors"
             title="Add to Google Calendar"
           >
             <CalendarPlus size={18} />
           </a>
           <button className="p-2 text-slate-300 hover:text-blue-500 transition-colors">
             <Edit2 size={18} />
           </button>
           <button onClick={() => onDeleteAppointment?.(appt.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
             <X size={20} />
           </button>
        </div>
      </motion.div>
    );
  };

  const NearbySection = ({ 
    type, 
    results, 
    onSearch 
  }: { 
    type: 'pharmacy' | 'hospital', 
    results: PharmacySearchResponse | null, 
    onSearch: () => void 
  }) => {
    const title = type === 'pharmacy' ? 'Medical Stores' : 'Hospitals';
    const subTitle = type === 'pharmacy' 
      ? 'Need a refill? Find top-rated pharmacies and medical supply stores near your current location.'
      : 'Emergency or checkup? Find top-rated hospitals and clinics near your current location.';
    const Icon = type === 'pharmacy' ? Pill : Hospital;
    const gradient = type === 'pharmacy' ? 'from-[#00b087] to-[#12c499]' : 'from-[#ff5b5b] to-[#ff8c8c]';
    
    return (
      <div className="space-y-6">
        <div className={`bg-gradient-to-br ${gradient} rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden min-h-[240px] flex flex-col justify-between`}>
          <div className="relative z-10">
            <h2 className="text-3xl font-black tracking-tight mb-3">Nearest {title}</h2>
            <p className="text-white/90 text-[13px] max-w-[280px] leading-relaxed mb-6 font-bold">
              {subTitle}
            </p>
          </div>
          <div className="relative z-10">
            <button 
              onClick={onSearch} 
              disabled={searching} 
              className="bg-white text-[#12c499] px-6 py-3.5 rounded-xl font-black text-sm shadow-xl flex items-center justify-center gap-2 hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-80 group"
            >
              {searching ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Search size={18} className="text-[#12c499]" />
              )}
              {searching ? 'Locating...' : results ? 'Search Again' : `Find Nearby ${title}`}
            </button>
          </div>
          <div className="absolute -bottom-10 -right-10 opacity-10">
            <Icon size={240} strokeWidth={1} />
          </div>
          <div className="absolute bottom-10 right-10 w-24 h-24 bg-white/5 rounded-full flex items-center justify-center">
             <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center">
               <div className="w-4 h-4 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.6)]" />
             </div>
          </div>
        </div>
        {results && (
          <div className="space-y-4 px-1 pb-4 animate-fadeIn">
            <div className="flex justify-between items-center px-1">
              <h3 className="font-black text-[#1a2b4d] text-base">Found Locations</h3>
              <span className="text-[10px] bg-slate-100 text-slate-500 font-black px-3 py-1.5 rounded-full uppercase tracking-wider">
                {results.places.length} Results
              </span>
            </div>
            <div className="space-y-3">
              {results.places.map((place, idx) => (
                <motion.a 
                  key={idx} 
                  href={place.uri} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:border-blue-200 transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#f0f9ff] text-[#00b087] border border-[#e0f2fe]">
                      <Icon size={22} />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#1a2b4d] text-base leading-tight group-hover:text-blue-600 transition-colors">
                        {place.title}
                      </h4>
                      <p className="text-[11px] font-bold text-slate-400 mt-1 flex items-center gap-1">
                        <MapPin size={10} className="text-slate-300" /> View on Google Maps
                      </p>
                    </div>
                  </div>
                  <div className="text-slate-200 group-hover:text-blue-400 transition-colors">
                    <Send size={20} className="rotate-45" />
                  </div>
                </motion.a>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      <div className="px-1 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 min-w-max pb-2">
          <TabButton id="visits" label="Visits" icon={<Calendar size={18} />} />
          <TabButton id="safety" label="Safety" icon={<ShieldCheck size={18} />} />
          <TabButton id="wellness" label="Wellness" icon={<Heart size={18} />} />
          <TabButton id="pharmacy" label="Pharmacy" icon={<Pill size={18} />} />
          <TabButton id="hospital" label="Hospital" icon={<Hospital size={18} />} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'visits' && (
          <motion.div key="visits" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            {isAddingAppointment ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl relative"
              >
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Stethoscope size={20} />
                    </div>
                    <h3 className="text-lg font-black text-slate-800 tracking-tight">New Appointment</h3>
                  </div>
                  <button onClick={() => setIsAddingAppointment(false)} className="text-slate-300 hover:text-slate-500">
                    <X size={24} />
                  </button>
                </div>
                <form onSubmit={handleAddAppointment} className="space-y-6">
                  <div>
                    <label className={labelClass}>Doctor Name</label>
                    <input required autoFocus value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="Dr. Smith" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Specialty</label>
                    <div className="relative">
                      <select value={specialty} onChange={e => setSpecialty(e.target.value)} className={`${inputClass} appearance-none pr-10`}>
                        {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <ChevronDown size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Date</label>
                      <input type="date" required value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Time</label>
                      <input type="time" required value={time} onChange={e => setTime(e.target.value)} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Location (Optional)</label>
                    <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City Hospital, Room 302" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Notes (Optional)</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Bring blood test results..." className={`${inputClass} h-24 resize-none`} />
                  </div>
                  <button type="submit" className="w-full py-5 bg-[#5d73ff] text-white rounded-2xl font-black shadow-[0_10px_20px_rgba(93,115,255,0.3)] flex items-center justify-center gap-3 active:scale-95 transition-all text-base uppercase tracking-widest">
                    <Clock size={20} /> Schedule Appointment
                  </button>
                </form>
              </motion.div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between px-1">
                  <button 
                    onClick={() => setIsAddingAppointment(true)} 
                    className="flex-1 py-4 bg-white border border-blue-200 border-dashed rounded-2xl text-blue-600 font-black flex items-center justify-center gap-2 hover:bg-blue-50 transition-all shadow-sm"
                  >
                    <Plus size={20} strokeWidth={3} /> Schedule New
                  </button>
                  <div className="flex items-center gap-1 ml-4 bg-white border border-slate-100 p-1 rounded-xl shadow-sm">
                    <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-100 text-blue-600' : 'text-slate-300'}`}>
                      <List size={20} />
                    </button>
                    <button onClick={() => setViewMode('calendar')} className={`p-2 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-slate-100 text-blue-600' : 'text-slate-300'}`}>
                      <CalendarDays size={20} />
                    </button>
                  </div>
                </div>

                {viewMode === 'calendar' ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-6 px-2">
                      <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{format(currentMonth, 'MMMM yyyy')}</h3>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400"><ChevronLeft size={20} /></button>
                        <button onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()); }} className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-slate-50 text-slate-500 rounded-lg mx-1">Today</button>
                        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400"><ChevronRight size={20} /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest py-2">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((day, idx) => {
                        const isSelected = selectedDate && isSameDay(day, selectedDate);
                        const isTodayDate = isToday(day);
                        const isCurrentMonth = isSameMonth(day, currentMonth);
                        const hasAppointment = appointments.some(a => a.date === format(day, 'yyyy-MM-dd'));
                        return (
                          <button
                            key={idx}
                            onClick={() => setSelectedDate(isSelected ? null : day)}
                            className={`relative h-12 flex flex-col items-center justify-center rounded-xl transition-all ${
                              !isCurrentMonth ? 'text-slate-200' : 
                              isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105 z-10' : 
                              isTodayDate ? 'bg-blue-50 text-blue-600 font-black' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <span className="text-sm font-bold">{format(day, 'd')}</span>
                            {hasAppointment && (
                              <div className={`w-1 h-1 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-blue-500 animate-pulse'}`}></div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    
                    {selectedDate && (
                      <div className="mt-8 pt-6 border-t border-slate-50 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-black text-slate-400 text-[10px] uppercase tracking-widest">
                            Visits on {format(selectedDate, 'MMM do')}
                          </h4>
                          <button onClick={() => setSelectedDate(null)} className="text-[10px] font-bold text-blue-600">View All</button>
                        </div>
                        {appointmentsOnSelectedDay.length > 0 ? (
                           <div className="space-y-3">
                             {appointmentsOnSelectedDay.map(appt => <AppointmentItem key={appt.id} appt={appt} />)}
                           </div>
                        ) : (
                          <div className="py-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-100">
                             <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">No appointments for this day</p>
                             <button onClick={() => { setDate(format(selectedDate, 'yyyy-MM-dd')); setIsAddingAppointment(true); }} className="mt-2 text-blue-500 text-[10px] font-black uppercase tracking-widest">+ Schedule Visit</button>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 px-1">
                      <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                      <h3 className="text-lg font-black text-[#1a2b4d] tracking-tight">Upcoming Visits</h3>
                    </div>
                    {appointments.length > 0 ? (
                      <div className="space-y-3 px-1">
                        {appointments
                          .filter(a => parseISO(a.date) >= startOfMonth(new Date()))
                          .sort((a,b) => a.date.localeCompare(b.date))
                          .map(appt => (
                            <AppointmentItem key={appt.id} appt={appt} />
                          ))
                        }
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 bg-white/40 border-2 border-dashed border-slate-100 rounded-[2rem] mx-1">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 opacity-40">
                          <Stethoscope size={32} className="text-slate-400" />
                        </div>
                        <p className="text-slate-400 font-black text-sm uppercase tracking-widest text-center px-8">No upcoming appointments scheduled.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'pharmacy' && (
          <motion.div key="pharmacy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <NearbySection type="pharmacy" results={pharmacies} onSearch={() => handleSearchPlaces('pharmacy')} />
          </motion.div>
        )}

        {activeTab === 'hospital' && (
          <motion.div key="hospital" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <NearbySection type="hospital" results={hospitals} onSearch={() => handleSearchPlaces('hospital')} />
          </motion.div>
        )}

        {activeTab === 'safety' && (
          <motion.div key="safety" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SafetyCheck medications={medications} />
          </motion.div>
        )}

        {activeTab === 'wellness' && (
          <motion.div key="wellness" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className="bg-gradient-to-br from-[#623ce1] to-[#8d69ff] rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden">
              <h2 className="text-2xl font-black mb-3 tracking-tight">Condition & Diet Advice</h2>
              <p className="text-white/80 text-xs mb-8 max-w-[280px] leading-relaxed font-bold">
                Enter a diagnosis to get personalized dietary tips and lifestyle advice.
              </p>
              <div className="bg-black/20 p-1.5 rounded-2xl border border-white/10 flex items-center gap-2">
                <input 
                  value={conditionInput}
                  onChange={(e) => setConditionInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGetAdvice()}
                  placeholder="Type condition..."
                  className="bg-transparent flex-1 p-3 outline-none text-white font-bold placeholder:text-white/40"
                />
                <button 
                  onClick={handleGetAdvice}
                  disabled={loadingAdvice || !conditionInput.trim()}
                  className="w-10 h-10 bg-white text-[#623ce1] rounded-xl flex items-center justify-center hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  {loadingAdvice ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={24} />}
                </button>
              </div>
            </div>
            {advice && (
              <div className="space-y-4 animate-fadeIn px-1">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Advice for {lastSearchedCondition}</h3>
                <div className="space-y-4">
                  <div className="bg-[#f0fdf4] p-5 rounded-[1.5rem] border border-[#dcfce7]">
                    <h4 className="flex items-center gap-2 font-black text-[#166534] mb-3 text-sm uppercase tracking-wider"><CheckCircle2 size={18} /> Recommended</h4>
                    <ul className="space-y-2">
                      {advice.recommendedFoods.map((f, i) => <li key={i} className="text-sm text-[#166534] font-bold">• {f}</li>)}
                    </ul>
                  </div>
                  <div className="bg-[#fef2f2] p-5 rounded-[1.5rem] border border-[#fee2e2]">
                    <h4 className="flex items-center gap-2 font-black text-[#991b1b] mb-3 text-sm uppercase tracking-wider"><XCircle size={18} /> Avoid</h4>
                    <ul className="space-y-2">
                      {advice.avoidFoods.map((f, i) => <li key={i} className="text-sm text-[#991b1b] font-bold">• {f}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CareView;
