
import React, { useState, useEffect, useRef } from 'react';
import { createMedicalChat } from '../services/geminiService';
import { Medication } from '../types';
import { Send, Bot, User, Sparkles, Radio, MessageSquareText } from 'lucide-react';
import { Chat } from '@google/genai';
import LiveVoiceMode from './LiveVoiceMode';
import { motion, AnimatePresence } from 'framer-motion';

interface AssistantViewProps {
  medications: Medication[];
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

const AssistantView: React.FC<AssistantViewProps> = ({ medications }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: "Hello! I'm MediMind Assistant. I can help you with questions about your medications, potential side effects, or general wellness. How can I help you today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatSessionRef.current = createMedicalChat(medications.map(m => m.name));
  }, [medications]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !chatSessionRef.current) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const response = await chatSessionRef.current.sendMessage({ message: userMsg });
      const text = response.text;
      if (text) {
        setMessages(prev => [...prev, { role: 'model', text }]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "I'm having trouble connecting right now. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLiveMode) {
    return <LiveVoiceMode onClose={() => setIsLiveMode(false)} />;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden relative">
      {/* MediMind Assistant Header - Purple Gradient */}
      <div className="bg-gradient-to-r from-[#6366f1] to-[#a855f7] p-5 text-white flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md border border-white/20">
            <Sparkles size={22} className="text-yellow-300" />
          </div>
          <div>
            <h2 className="font-black text-lg leading-tight tracking-tight">MediMind Assistant</h2>
            <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest opacity-80">Powered by Gemini AI</p>
          </div>
        </div>
        
        <button 
          onClick={() => setIsLiveMode(true)}
          className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-md px-4 py-2 rounded-full transition-all text-[11px] font-black uppercase tracking-wider border border-white/30 active:scale-95"
        >
           <Radio size={14} className="text-white" />
           Live Call
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-[#f8fafc] no-scrollbar">
        {messages.map((msg, idx) => (
          <motion.div 
            key={idx} 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'model' && (
              <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-500 shadow-sm self-start mt-1">
                <Bot size={20} />
              </div>
            )}
            
            <div 
              className={`max-w-[85%] p-4 rounded-3xl text-[13px] leading-relaxed shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-[#5d73ff] text-white rounded-tr-none font-bold' 
                  : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none font-medium'
              }`}
            >
              {msg.text.split('\n').map((line, i) => {
                // Basic markdown-like handling for headers and bullets
                if (line.startsWith('###')) {
                  return <h3 key={i} className="text-sm font-black mt-3 mb-2 text-slate-900">{line.replace('###', '').trim()}</h3>;
                }
                if (line.startsWith('*')) {
                  return <div key={i} className="flex gap-2 ml-1 my-1"><span className="text-slate-400">•</span> <span>{line.replace('*', '').trim()}</span></div>;
                }
                return <p key={i} className={line.trim() === '' ? 'h-2' : 'mb-1'}>{line}</p>;
              })}
            </div>

            {msg.role === 'user' && (
              <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 text-slate-400 shadow-sm self-start mt-1">
                <User size={20} />
              </div>
            )}
          </motion.div>
        ))}
        
        {isLoading && (
          <div className="flex gap-3 justify-start">
             <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-500">
                <Bot size={20} />
              </div>
              <div className="bg-white border border-slate-100 p-4 rounded-3xl rounded-tl-none shadow-sm flex gap-1.5 items-center">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75"></span>
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-150"></span>
              </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-50">
        <form onSubmit={handleSend} className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about interactions, symptoms..."
              className="w-full pl-5 pr-12 py-4 bg-slate-50 rounded-2xl border border-slate-100 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-[13px] font-bold text-slate-700 transition-all"
            />
            <button 
              type="submit" 
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-indigo-600 disabled:text-slate-200 transition-colors"
            >
              <Send size={24} />
            </button>
          </div>
        </form>
        <p className="text-[10px] font-bold text-center text-slate-300 mt-3 uppercase tracking-wider">
          AI can make mistakes. Always consult a doctor for medical advice.
        </p>
      </div>
    </div>
  );
};

export default AssistantView;
