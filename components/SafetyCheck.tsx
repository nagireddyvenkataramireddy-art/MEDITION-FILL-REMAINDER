import React, { useState } from 'react';
import { Medication, InteractionAnalysis } from '../types';
import { checkInteractions } from '../services/geminiService';
import { ShieldCheck, AlertTriangle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';

interface SafetyCheckProps {
  medications: Medication[];
}

const SafetyCheck: React.FC<SafetyCheckProps> = ({ medications }) => {
  const [analysis, setAnalysis] = useState<InteractionAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<number | null>(null);

  const handleCheck = async () => {
    if (medications.length < 2) {
      alert("You need at least 2 medications to check for interactions.");
      return;
    }
    setLoading(true);
    const result = await checkInteractions(medications.map(m => m.name));
    setAnalysis(result);
    setLoading(false);
    setLastCheck(Date.now());
  };

  if (medications.length < 2) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
        <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Safety Check</h2>
        <p className="text-slate-500 max-w-sm mx-auto">
          Add at least two medications to unlock AI-powered drug interaction screening.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Medication Safety</h2>
            <p className="text-blue-100 mb-6 max-w-md">
              Our AI analyzes your medication list for potential drug-drug interactions to keep you safe.
            </p>
            <button 
              onClick={handleCheck}
              disabled={loading}
              className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold shadow-sm hover:bg-blue-50 transition-colors flex items-center gap-2 disabled:opacity-75"
            >
              {loading ? <Loader2 className="animate-spin" /> : <RefreshCw size={18} />}
              {analysis ? 'Re-Analyze Safety' : 'Run Safety Check'}
            </button>
          </div>
          <ShieldCheck size={80} className="text-white opacity-20 hidden sm:block" />
        </div>
      </div>

      {analysis && (
        <div className="animate-fadeIn">
          <div className={`rounded-2xl border p-6 mb-6 ${analysis.safeToTake ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
             <div className="flex items-center gap-3 mb-3">
               {analysis.safeToTake ? (
                 <CheckCircle size={28} className="text-green-600" />
               ) : (
                 <AlertTriangle size={28} className="text-amber-600" />
               )}
               <h3 className={`text-lg font-bold ${analysis.safeToTake ? 'text-green-800' : 'text-amber-800'}`}>
                 {analysis.safeToTake ? 'No Critical Interactions Found' : 'Potential Interactions Detected'}
               </h3>
             </div>
             <p className={`${analysis.safeToTake ? 'text-green-700' : 'text-amber-700'}`}>
               {analysis.summary}
             </p>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-slate-700 text-lg">Detailed Analysis</h3>
            {analysis.interactions.length === 0 ? (
               <div className="bg-white p-6 rounded-xl border border-slate-100 text-slate-500 text-center">
                 No interactions found between your current medications.
               </div>
            ) : (
              analysis.interactions.map((interaction, idx) => (
                <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 border-l-4 border-l-amber-500">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <span>{interaction.medication1}</span>
                      <span className="text-slate-400 text-sm">↔</span>
                      <span>{interaction.medication2}</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${
                      interaction.severity === 'HIGH' ? 'bg-red-100 text-red-600' : 
                      interaction.severity === 'MODERATE' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {interaction.severity} Risk
                    </span>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {interaction.description}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SafetyCheck;
