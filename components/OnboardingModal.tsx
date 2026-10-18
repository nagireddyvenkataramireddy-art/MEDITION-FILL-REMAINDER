import React, { useState } from 'react';
import { Sparkles, Bell, ArrowRight, Check, Pill, ShieldCheck, HeartPulse } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose, userName }) => {
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      title: "Welcome to MediMind",
      desc: `Hi ${userName}! I'm your intelligent health companion. I'm here to help you stay on top of your medications and wellbeing.`,
      icon: <HeartPulse size={64} className="text-white drop-shadow-md" />,
      bg: "bg-gradient-to-br from-blue-500 to-indigo-600"
    },
    {
      title: "Just Say It",
      desc: "Scheduling shouldn't be a chore. Use our Smart Voice Add feature to simply speak your prescription, and I'll organize it for you.",
      icon: <Sparkles size={64} className="text-white drop-shadow-md" />,
      bg: "bg-gradient-to-br from-indigo-500 to-purple-600"
    },
    {
      title: "Safety First",
      desc: "I automatically check for drug interactions between your medications and provide helpful warnings to keep you safe.",
      icon: <ShieldCheck size={64} className="text-white drop-shadow-md" />,
      bg: "bg-gradient-to-br from-teal-500 to-emerald-600"
    },
    {
      title: "Ready to Start?",
      desc: "Let's add your first medication now. It takes less than 30 seconds to set up your first reminder.",
      icon: <Pill size={64} className="text-white drop-shadow-md" />,
      bg: "bg-slate-900"
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  const currentStep = steps[step];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900">
      {/* Dynamic Background */}
      <div className={`absolute inset-0 transition-colors duration-700 ease-in-out ${currentStep.bg}`}></div>
      
      {/* Floating Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-white opacity-10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-black opacity-10 rounded-full blur-3xl"></div>

      <div className="relative z-10 w-full max-w-md p-8 flex flex-col h-full justify-between py-12">
        
        {/* Indicators */}
        <div className="flex gap-2 mb-8">
          {steps.map((_, idx) => (
            <div 
              key={idx} 
              className={`h-1.5 rounded-full transition-all duration-500 ${idx === step ? 'w-8 bg-white' : 'w-2 bg-white/30'}`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center text-center justify-center animate-fadeIn">
          <div className="mb-10 transform transition-transform duration-500 hover:scale-110">
            {currentStep.icon}
          </div>
          
          <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
            {currentStep.title}
          </h2>
          
          <p className="text-white/80 text-lg leading-relaxed max-w-xs font-medium">
            {currentStep.desc}
          </p>
        </div>

        {/* Action Button */}
        <button 
          onClick={handleNext}
          className="w-full py-4 bg-white text-slate-900 rounded-2xl font-bold shadow-xl transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 text-lg"
        >
          {step === steps.length - 1 ? (
            <>Get Started <Check size={24} /></>
          ) : (
            <>Continue <ArrowRight size={24} /></>
          )}
        </button>

        {step < steps.length - 1 && (
            <button onClick={onClose} className="mt-4 text-white/50 text-sm font-bold hover:text-white transition-colors">
                Skip Intro
            </button>
        )}
      </div>
    </div>
  );
};

export default OnboardingModal;