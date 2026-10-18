
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, X, PhoneOff, Radio, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

interface LiveVoiceModeProps {
  onClose: () => void;
  userName?: string;
}

const LiveVoiceMode: React.FC<LiveVoiceModeProps> = ({ onClose, userName }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [volume, setVolume] = useState(0);
  const [status, setStatus] = useState("Connecting...");
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Audio playback queue tracker for smooth gapless playback
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    startSession();
    return () => stopSession();
  }, []);

  const startSession = async () => {
    try {
      // Fixed: Initializing GoogleGenAI using environment variable directly as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // 1. Setup Audio Contexts (Input 16kHz, Output 24kHz for Live API)
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      audioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      // 2. Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // 3. Connect to Gemini Live API
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setStatus("Listening...");
            
            // Setup Input Processing from microphone to the model
            const source = inputCtx.createMediaStreamSource(stream);
            sourceRef.current = source;
            
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              if (!isMicOn) return;
              
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Calculate volume for visualizer
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
              }
              const rms = Math.sqrt(sum / inputData.length);
              setVolume(Math.min(1, rms * 5)); 

              // Send audio PCM blob to Gemini session once it resolves
              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session) => {
                 session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Process the model's output audio bytes
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setStatus("Speaking...");
              playAudioChunk(audioData, outputCtx);
            }
            
            if (message.serverContent?.turnComplete) {
               setStatus("Listening...");
            }

            // Handle interruption signal from the model
            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
               stopCurrentAudio();
               setStatus("Listening...");
            }
          },
          onclose: () => {
            setIsConnected(false);
            setStatus("Disconnected");
          },
          onerror: (err) => {
            console.error(err);
            setError("Connection failed. Please try again.");
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: `You are MediMind, a helpful and empathetic health assistant talking to ${userName || 'the user'}. Keep responses concise, friendly, and supportive. Do not give medical diagnosis, but offer general wellness advice and medication reminders.`
        }
      });

    } catch (err) {
      console.error("Failed to start live session:", err);
      setError("Could not access microphone or connect to AI.");
    }
  };

  const stopSession = () => {
    // Cleanup Audio Contexts and streams
    if (audioContextRef.current) audioContextRef.current.close();
    if (outputAudioContextRef.current) outputAudioContextRef.current.close();
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
    }
    
    if (sourceRef.current) sourceRef.current.disconnect();

    setIsConnected(false);
  };

  const stopCurrentAudio = () => {
    // Instantly stop all playing audio buffers on interruption
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  };

  const playAudioChunk = async (base64Data: string, ctx: AudioContext) => {
    try {
      // Manual decoding implementation as required for raw PCM streams
      const bytes = decode(base64Data);
      
      const audioBuffer = await decodeAudioData(bytes, ctx, 24000, 1);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      
      // Schedule audio to start after the previous chunk ends
      const currentTime = ctx.currentTime;
      const startTime = Math.max(currentTime, nextStartTimeRef.current);
      
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;
      
      sourcesRef.current.add(source);
      source.onended = () => sourcesRef.current.delete(source);
      
      setVolume(0.5); 
      setTimeout(() => setVolume(0), audioBuffer.duration * 1000);
      
    } catch (e) {
      console.error("Error playing audio:", e);
    }
  };

  // Helper: Manual base64 decode to bytes
  function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  // Helper: Create PCM Blob from Float32Array
  const createBlob = (data: Float32Array): { data: string, mimeType: string } => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768; 
    }
    
    // Manual Base64 Encode
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    return {
      data: base64,
      mimeType: 'audio/pcm;rate=16000'
    };
  };

  // Helper: Manual PCM Decoding logic
  const decodeAudioData = async (
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
  ): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const toggleMic = () => {
     setIsMicOn(!isMicOn);
  };

  return (
    <div className="absolute inset-0 z-50 bg-slate-900 text-white flex flex-col items-center justify-between p-6 animate-fadeIn">
      {/* Background UI elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-900 opacity-50"></div>
      
      <div className="w-full flex justify-between items-center relative z-10">
        <div className="flex items-center gap-2 text-indigo-300">
           <Radio size={16} className={isConnected ? "animate-pulse" : ""} />
           <span className="text-xs font-bold uppercase tracking-wider">Live Connection</span>
        </div>
        <button 
          onClick={onClose}
          className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full">
        <div className="relative">
          <motion.div 
            animate={{ scale: 1 + volume * 0.5, opacity: 0.5 + volume * 0.5 }}
            className="absolute inset-0 bg-indigo-500 rounded-full blur-3xl"
          />
          
          <div className="relative w-48 h-48 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center shadow-2xl border-4 border-white/10">
             {error ? (
                <PhoneOff size={48} className="text-white/50" />
             ) : (
                <Activity size={48} className="text-white" />
             )}
          </div>

          {isConnected && !error && (
            <>
              <motion.div 
                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute inset-0 border border-white/20 rounded-full"
              />
              <motion.div 
                animate={{ scale: [1, 2], opacity: [0.3, 0] }}
                transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
                className="absolute inset-0 border border-white/10 rounded-full"
              />
            </>
          )}
        </div>

        <div className="mt-12 text-center space-y-2">
           <h3 className="text-2xl font-bold tracking-tight">
             {error ? "Connection Error" : status}
           </h3>
           <p className="text-slate-400 text-sm max-w-xs mx-auto">
             {error || "MediMind is listening. Speak naturally to discuss your health."}
           </p>
        </div>
      </div>

      <div className="w-full max-w-sm grid grid-cols-3 gap-6 relative z-10">
         <button 
           className="flex flex-col items-center gap-2 text-slate-400 hover:text-white transition-colors"
           onClick={onClose}
         >
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
              <X size={24} />
            </div>
            <span className="text-xs font-bold">Close</span>
         </button>
         
         <button 
           className={`flex flex-col items-center gap-2 transition-colors ${isMicOn ? 'text-white' : 'text-red-400'}`}
           onClick={toggleMic}
         >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transform transition-transform active:scale-95 ${isMicOn ? 'bg-white text-indigo-900' : 'bg-red-500/20 text-red-500 border border-red-500/50'}`}>
              {isMicOn ? <Mic size={32} /> : <MicOff size={32} />}
            </div>
            <span className="text-xs font-bold">{isMicOn ? 'Mute' : 'Unmute'}</span>
         </button>

         <button 
           className="flex flex-col items-center gap-2 text-slate-400 hover:text-white transition-colors"
           onClick={() => { stopSession(); setTimeout(startSession, 500); }}
         >
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
              <Radio size={24} />
            </div>
            <span className="text-xs font-bold">Reconnect</span>
         </button>
      </div>
    </div>
  );
};

export default LiveVoiceMode;
