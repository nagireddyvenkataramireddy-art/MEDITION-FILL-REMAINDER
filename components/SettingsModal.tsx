
import React, { useState, useEffect } from 'react';
import { X, Check, Settings, Bell, User, ShieldAlert, CreditCard, ChevronRight, Volume2, ArrowLeft, Watch, Link2, Bluetooth, Activity, Download, Plus, Trash2, Shield, FileText, Hash, Users, Smile } from 'lucide-react';
import { Profile, SoundType } from '../types';
import { playNotificationSound } from '../services/audioService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles?: Profile[];
  activeProfileId?: string;
  onAddProfile?: (name: string, avatar?: string, themeColor?: string) => void;
  onUpdateProfile?: (profile: Profile) => void;
  onDeleteProfile?: (id: string) => void;
  fireBolttConnected?: boolean;
  onConnectWatch?: () => void;
  connectedDeviceName?: string | null;
  onTestNotification?: () => void;
}

const AVATARS = ['👤', '👩', '👨', '👵', '👴', '👧', '👦', '👶', '🐱', '🐶'];
const THEME_COLORS = ['blue', 'teal', 'red', 'orange', 'purple', 'pink', 'indigo'];

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, onClose, profiles = [], activeProfileId, onAddProfile, onUpdateProfile, onDeleteProfile, fireBolttConnected = false, onConnectWatch, connectedDeviceName, onTestNotification 
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'family' | 'devices' | 'general'>('profile');
  const [googleFitConnected, setGoogleFitConnected] = useState(false);
  
  // Sub-menu states
  const [showSoundSettings, setShowSoundSettings] = useState(false);

  // Active Profile Edit State
  const [currentProfileData, setCurrentProfileData] = useState<Profile | null>(null);
  
  // New Family Member State
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberAvatar, setNewMemberAvatar] = useState('👤');
  const [newMemberTheme, setNewMemberTheme] = useState('blue');
  
  // Local state for adding tags
  const [newAllergy, setNewAllergy] = useState('');
  const [newCondition, setNewCondition] = useState('');
  const [isEditingInsurance, setIsEditingInsurance] = useState(false);

  useEffect(() => {
    if (profiles && activeProfileId) {
      const active = profiles.find(p => p.id === activeProfileId);
      if (active) {
         // Sanitize legacy data if necessary (e.g. if allergies was a string)
         let safeAllergies = active.allergies;
         if (typeof safeAllergies === 'string') {
             // @ts-ignore - handling legacy type
             safeAllergies = safeAllergies.split(',').map(s => s.trim()).filter(Boolean);
         }
         
         setCurrentProfileData({ 
           ...active, 
           allergies: Array.isArray(safeAllergies) ? safeAllergies : [],
           conditions: Array.isArray(active.conditions) ? active.conditions : [],
           insurance: active.insurance || { provider: '', policyNumber: '', groupNumber: '', holderName: '' }
         });
      }
    }
  }, [profiles, activeProfileId, isOpen]);

  if (!isOpen) return null;

  const handleProfileChange = (field: keyof Profile, value: any) => {
    if (!currentProfileData) return;
    setCurrentProfileData({ ...currentProfileData, [field]: value });
  };

  const handleInsuranceChange = (field: string, value: string) => {
    if (!currentProfileData) return;
    const insurance = { ...(currentProfileData.insurance || { provider: '', policyNumber: '', groupNumber: '', holderName: '' }), [field]: value };
    setCurrentProfileData({ ...currentProfileData, insurance });
  };

  const handleEmergencyChange = (field: string, value: string) => {
    if (!currentProfileData) return;
    const emergencyContact = {
      name: currentProfileData.emergencyContact?.name || '',
      relation: currentProfileData.emergencyContact?.relation || '',
      phone: currentProfileData.emergencyContact?.phone || '',
      [field]: value
    };
    setCurrentProfileData({ ...currentProfileData, emergencyContact });
  };

  const addTag = (field: 'allergies' | 'conditions', tag: string) => {
    if (!tag.trim() || !currentProfileData) return;
    const currentTags = currentProfileData[field] || [];
    const newTags = [...currentTags, tag.trim()];
    handleProfileChange(field, newTags);
    if (field === 'allergies') setNewAllergy('');
    else setNewCondition('');
  };

  const removeTag = (field: 'allergies' | 'conditions', index: number) => {
    if (!currentProfileData) return;
    const currentTags = currentProfileData[field] || [];
    const newTags = currentTags.filter((_, i) => i !== index);
    handleProfileChange(field, newTags);
  };

  const saveProfile = () => {
    if (currentProfileData && onUpdateProfile) {
      onUpdateProfile(currentProfileData);
      alert('Medical ID updated successfully!');
    }
  };

  const handleCreateMember = () => {
    if (newMemberName.trim() && onAddProfile) {
      onAddProfile(newMemberName, newMemberAvatar, newMemberTheme);
      setIsAddingMember(false);
      setNewMemberName('');
      setNewMemberAvatar('👤');
      setNewMemberTheme('blue');
    }
  };

  const handleExportData = () => {
    if (!currentProfileData) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentProfileData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `medimind_profile_${currentProfileData.name.replace(/\s+/g, '_').toLowerCase()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const testSound = (sound: SoundType) => {
    playNotificationSound(sound);
  }

  // Sub-menu for Sound
  if (showSoundSettings) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
          <div className="bg-white p-4 border-b border-slate-100 flex items-center gap-3">
             <button onClick={() => setShowSoundSettings(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
               <ArrowLeft size={20} />
             </button>
             <h2 className="text-xl font-bold text-slate-800">Sounds & Haptics</h2>
          </div>
          <div className="p-6 space-y-6 overflow-y-auto">
             <div className="bg-white border border-slate-200 rounded-xl p-4">
               <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                 <Bell size={18} className="text-blue-500" /> Test Notification
               </h3>
               <button onClick={onTestNotification} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold">
                 Send Test Alert
               </button>
             </div>
             <div className="bg-white border border-slate-200 rounded-xl p-4">
               <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                 <Volume2 size={18} className="text-teal-500" /> Sound Preview
               </h3>
               <div className="grid grid-cols-2 gap-3">
                  {['chime', 'alert', 'soft', 'harp', 'nature', 'arcade', 'glass', 'shimmer', 'echo'].map((sound) => (
                    <button key={sound} onClick={() => testSound(sound as SoundType)} className="p-3 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                      <span className="capitalize">{sound}</span>
                    </button>
                  ))}
               </div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-white p-4 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Settings size={20} className="text-slate-500" />
            Settings
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 flex-shrink-0 overflow-x-auto">
          {[
            { id: 'profile', label: 'My Health', icon: <User size={16} /> },
            { id: 'family', label: 'Family', icon: <Users size={16} /> },
            { id: 'devices', label: 'Devices', icon: <Watch size={16} /> },
            { id: 'general', label: 'Preferences', icon: <Settings size={16} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors border-b-2 whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'border-blue-500 text-blue-600 bg-white' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1 bg-[#f8fafc]">
          
          {/* PROFILE TAB */}
          {activeTab === 'profile' && currentProfileData && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Profile Header Card */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10 flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-3xl shadow-inner border border-white/30">
                    {currentProfileData.avatar}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{currentProfileData.name}</h3>
                    <p className="text-blue-100 text-xs opacity-90 font-mono mt-1">ID: {currentProfileData.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <button onClick={handleExportData} className="ml-auto bg-white/20 p-2 rounded-lg hover:bg-white/30 transition-colors" title="Export Data">
                    <Download size={20} />
                  </button>
                </div>
              </div>

              {/* Physical Stats */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Activity size={14} /> Physical Stats
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Gender</label>
                    <select 
                      value={currentProfileData.gender || ''}
                      onChange={e => handleProfileChange('gender', e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Age</label>
                    <input 
                      type="number"
                      value={currentProfileData.age || ''}
                      onChange={e => handleProfileChange('age', e.target.value)}
                      placeholder="Years"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Blood Type</label>
                    <select 
                      value={currentProfileData.bloodType || ''}
                      onChange={e => handleProfileChange('bloodType', e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                    >
                       <option value="">Select</option>
                       {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => (
                         <option key={b} value={b}>{b}</option>
                       ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Height (cm)</label>
                      <input 
                        type="number"
                        value={currentProfileData.height || ''}
                        onChange={e => handleProfileChange('height', e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Weight (kg)</label>
                      <input 
                        type="number"
                        value={currentProfileData.weight || ''}
                        onChange={e => handleProfileChange('weight', e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Medical Tags (Conditions & Allergies) */}
              <div className="grid grid-cols-1 gap-4">
                {/* Conditions */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                   <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <FileText size={14} /> Medical Conditions
                   </h3>
                   <div className="flex flex-wrap gap-2 mb-3">
                      {(currentProfileData.conditions || []).map((c, i) => (
                        <span key={i} className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                          {c}
                          <button onClick={() => removeTag('conditions', i)} className="hover:bg-indigo-200 rounded-full p-0.5"><X size={12} /></button>
                        </span>
                      ))}
                      {(currentProfileData.conditions || []).length === 0 && <span className="text-sm text-slate-400 italic">None listed</span>}
                   </div>
                   <div className="flex gap-2">
                     <input 
                       value={newCondition}
                       onChange={e => setNewCondition(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && addTag('conditions', newCondition)}
                       placeholder="Add condition (e.g. Asthma)"
                       className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                     />
                     <button onClick={() => addTag('conditions', newCondition)} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">
                       <Plus size={18} />
                     </button>
                   </div>
                </div>

                {/* Allergies */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                   <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <ShieldAlert size={14} /> Allergies
                   </h3>
                   <div className="flex flex-wrap gap-2 mb-3">
                      {(currentProfileData.allergies || []).map((a, i) => (
                        <span key={i} className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                          {a}
                          <button onClick={() => removeTag('allergies', i)} className="hover:bg-red-200 rounded-full p-0.5"><X size={12} /></button>
                        </span>
                      ))}
                      {(currentProfileData.allergies || []).length === 0 && <span className="text-sm text-slate-400 italic">None listed</span>}
                   </div>
                   <div className="flex gap-2">
                     <input 
                       value={newAllergy}
                       onChange={e => setNewAllergy(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && addTag('allergies', newAllergy)}
                       placeholder="Add allergy (e.g. Penicillin)"
                       className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                     />
                     <button onClick={() => addTag('allergies', newAllergy)} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">
                       <Plus size={18} />
                     </button>
                   </div>
                </div>
              </div>

              {/* Digital Insurance Card */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <CreditCard size={14} /> Insurance Card
                  </h3>
                  <button onClick={() => setIsEditingInsurance(!isEditingInsurance)} className="text-blue-500 text-xs font-bold hover:underline">
                    {isEditingInsurance ? 'Done' : 'Edit'}
                  </button>
                </div>
                
                {isEditingInsurance ? (
                  <div className="space-y-3">
                     <input 
                       placeholder="Provider (e.g. Blue Cross)"
                       value={currentProfileData.insurance?.provider || ''}
                       onChange={e => handleInsuranceChange('provider', e.target.value)}
                       className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                     />
                     <input 
                       placeholder="Policy Number"
                       value={currentProfileData.insurance?.policyNumber || ''}
                       onChange={e => handleInsuranceChange('policyNumber', e.target.value)}
                       className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                     />
                     <div className="grid grid-cols-2 gap-3">
                        <input 
                          placeholder="Group #"
                          value={currentProfileData.insurance?.groupNumber || ''}
                          onChange={e => handleInsuranceChange('groupNumber', e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                        />
                         <input 
                          placeholder="Holder Name"
                          value={currentProfileData.insurance?.holderName || ''}
                          onChange={e => handleInsuranceChange('holderName', e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                        />
                     </div>
                  </div>
                ) : (
                  <div className="relative h-48 rounded-xl overflow-hidden shadow-lg group transition-transform hover:scale-[1.01]">
                    {/* Card Background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900"></div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/20 rounded-full blur-xl -ml-5 -mb-5"></div>
                    
                    {/* Card Content */}
                    <div className="relative z-10 p-5 h-full flex flex-col justify-between text-white">
                      <div className="flex justify-between items-start">
                        <div>
                           <h4 className="font-bold text-lg tracking-wide">{currentProfileData.insurance?.provider || 'Provider Name'}</h4>
                           <span className="text-[10px] text-slate-300 uppercase tracking-wider">Health Insurance</span>
                        </div>
                        <Shield size={24} className="text-white/80" />
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                           <Hash size={16} className="text-slate-400" />
                           <span className="font-mono text-lg tracking-widest text-shadow-sm">
                             {currentProfileData.insurance?.policyNumber || '•••• •••• ••••'}
                           </span>
                        </div>
                        
                        <div className="flex justify-between text-xs text-slate-300">
                           <div>
                             <p className="font-bold text-[9px] uppercase">Group #</p>
                             <p className="text-white">{currentProfileData.insurance?.groupNumber || 'N/A'}</p>
                           </div>
                           <div className="text-right">
                             <p className="font-bold text-[9px] uppercase">Member</p>
                             <p className="text-white">{currentProfileData.insurance?.holderName || currentProfileData.name}</p>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Emergency Contact */}
              <div className="bg-red-50 p-5 rounded-xl border border-red-100 shadow-sm">
                <h3 className="text-sm font-bold text-red-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <ShieldAlert size={16} /> Emergency Contact
                </h3>
                <input 
                  placeholder="Contact Name"
                  value={currentProfileData.emergencyContact?.name || ''}
                  onChange={e => handleEmergencyChange('name', e.target.value)}
                  className="w-full p-2.5 bg-white border border-red-200 rounded-lg text-sm outline-none mb-3"
                />
                <div className="grid grid-cols-2 gap-3">
                   <input 
                    placeholder="Relation"
                    value={currentProfileData.emergencyContact?.relation || ''}
                    onChange={e => handleEmergencyChange('relation', e.target.value)}
                    className="w-full p-2.5 bg-white border border-red-200 rounded-lg text-sm outline-none"
                  />
                  <input 
                    placeholder="Phone Number"
                    value={currentProfileData.emergencyContact?.phone || ''}
                    onChange={e => handleEmergencyChange('phone', e.target.value)}
                    className="w-full p-2.5 bg-white border border-red-200 rounded-lg text-sm outline-none"
                  />
                </div>
              </div>

              <button 
                  onClick={saveProfile}
                  className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold shadow-lg shadow-slate-200 hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                >
                  <Check size={18} /> Save Changes
              </button>
            </div>
          )}

          {/* FAMILY TAB */}
          {activeTab === 'family' && (
             <div className="space-y-6 animate-fadeIn">
               {!isAddingMember ? (
                 <>
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-500">
                      <Users size={32} />
                    </div>
                    <h3 className="font-bold text-slate-800">My Family</h3>
                    <p className="text-sm text-slate-500 mb-4">Manage profiles for your family members to track their health separately.</p>
                    <button 
                      onClick={() => setIsAddingMember(true)}
                      className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                    >
                      <Plus size={20} /> Add Family Member
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Family Members ({profiles.length})</h4>
                    {profiles.map(profile => (
                      <div key={profile.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group">
                         <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl bg-${profile.themeColor}-100`}>
                              {profile.avatar}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-800">{profile.name}</h4>
                              {profile.id === activeProfileId && (
                                <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">Active</span>
                              )}
                            </div>
                         </div>
                         {profiles.length > 1 && (
                            <button 
                              onClick={() => onDeleteProfile && onDeleteProfile(profile.id)}
                              className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                              title="Delete Profile"
                            >
                              <Trash2 size={18} />
                            </button>
                         )}
                      </div>
                    ))}
                  </div>
                 </>
               ) : (
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                       <h3 className="font-bold text-slate-800">Add New Member</h3>
                       <button onClick={() => setIsAddingMember(false)} className="text-slate-400 hover:text-slate-600">
                         <X size={20} />
                       </button>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">Select Avatar</label>
                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                           {AVATARS.map(emoji => (
                             <button
                               key={emoji}
                               onClick={() => setNewMemberAvatar(emoji)}
                               className={`w-12 h-12 flex-shrink-0 rounded-full text-2xl flex items-center justify-center border transition-all ${newMemberAvatar === emoji ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-200 hover:bg-slate-50'}`}
                             >
                               {emoji}
                             </button>
                           ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">Theme Color</label>
                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                           {THEME_COLORS.map(color => (
                             <button
                               key={color}
                               onClick={() => setNewMemberTheme(color)}
                               className={`w-10 h-10 flex-shrink-0 rounded-full transition-all border-2 ${newMemberTheme === color ? `border-slate-400 bg-${color}-500 shadow-md scale-110` : `bg-${color}-400 border-transparent opacity-50 hover:opacity-100`}`}
                             />
                           ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">Full Name</label>
                        <input 
                           value={newMemberName}
                           onChange={e => setNewMemberName(e.target.value)}
                           placeholder="e.g. Grandma, Junior"
                           className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-bold text-slate-700"
                        />
                      </div>
                      
                      <div className="pt-2">
                        <button 
                          onClick={handleCreateMember}
                          disabled={!newMemberName.trim()}
                          className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold shadow-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Create Profile
                        </button>
                      </div>
                    </div>
                 </div>
               )}
             </div>
          )}

          {/* DEVICES TAB */}
          {activeTab === 'devices' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100 mb-2">
                <h3 className="font-bold text-indigo-800 mb-2">Connected Health</h3>
                <p className="text-sm text-indigo-600 mb-4">Sync vitals from your devices via Bluetooth to keep your dashboard up to date.</p>
              </div>

              {/* Fire-Boltt Integration */}
              <div className="flex flex-col p-4 border border-indigo-100 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                      <Bluetooth size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-700">Fire-Boltt Watch</p>
                      <p className="text-xs text-slate-400">
                         {fireBolttConnected 
                           ? `Connected to ${connectedDeviceName || 'Device'}` 
                           : 'Bluetooth Pairing Required'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={onConnectWatch}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                      fireBolttConnected 
                        ? 'bg-green-500 text-white shadow-md' 
                        : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'
                    }`}
                  >
                    {fireBolttConnected ? <Check size={16} /> : <Link2 size={16} />}
                    {fireBolttConnected ? 'Linked' : 'Link'}
                  </button>
                </div>
                {!fireBolttConnected && (
                  <div className="mt-3 text-xs text-slate-400 bg-slate-50 p-2 rounded">
                    Tap <b>Link</b> to open the Bluetooth scanner. Select your watch from the list. It must be powered on and not connected to another phone.
                  </div>
                )}
              </div>

              {/* Google Fit Simulation */}
              <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow opacity-75">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center border border-red-100">
                    <Activity size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">Google Fit</p>
                    <p className="text-xs text-slate-400">Cloud Sync (Simulated)</p>
                  </div>
                </div>
                <button 
                  onClick={() => setGoogleFitConnected(!googleFitConnected)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    googleFitConnected 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {googleFitConnected ? 'Active' : 'Enable'}
                </button>
              </div>
            </div>
          )}

          {/* PREFERENCES TAB */}
          {activeTab === 'general' && (
            <div className="space-y-4 animate-fadeIn">
               <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                 <button 
                   onClick={() => setShowSoundSettings(true)}
                   className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                 >
                    <div className="flex items-center gap-3">
                      <Bell size={20} className="text-slate-400" />
                      <div className="text-left">
                        <p className="font-bold text-slate-700 text-sm">Sounds & Haptics</p>
                        <p className="text-xs text-slate-400">Manage alerts & test notifications</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                 </button>
              </div>
              <div className="p-4 text-center text-xs text-slate-400">
                MediMind Version 1.2
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
