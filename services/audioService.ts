
import { SoundType } from '../types';

let audioCtx: AudioContext | null = null;

// Call this function on a user interaction (click/touch) to unlock audio on mobile
export const initAudio = () => {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

export const playNotificationSound = (type: SoundType = 'default') => {
  if (type === 'default') return; 

  // Ensure context exists
  if (!audioCtx) {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }

  if (!audioCtx) return;

  const ctx = audioCtx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;

  if (type === 'chime') {
    // Gentle sine wave ascending
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
    osc.start(now);
    osc.stop(now + 1.5);
  } else if (type === 'alert') {
    // Sharp sawtooth pulsing
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, now);
    
    // Pulse volume
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.linearRampToValueAtTime(0, now + 0.2);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.25);
    gain.gain.linearRampToValueAtTime(0, now + 0.5);

    osc.start(now);
    osc.stop(now + 0.6);
  } else if (type === 'soft') {
    // Soft triangle wave swell
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 1);
    gain.gain.linearRampToValueAtTime(0, now + 2.5);
    osc.start(now);
    osc.stop(now + 2.5);
  } else if (type === 'harp') {
    // Arpeggio effect
    const notes = [440, 554, 659, 880]; // A major
    
    // Disconnect default osc as we create multiple for harp
    osc.disconnect(); 
    
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      o.connect(g);
      g.connect(ctx.destination);
      const start = now + (i * 0.1);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.15, start + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, start + 2.0);
      o.start(start);
      o.stop(start + 2.0);
    });
  } else if (type === 'nature') {
    // Bird chirp-ish
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500, now);
    osc.frequency.linearRampToValueAtTime(2500, now + 0.1);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.3);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
    gain.gain.linearRampToValueAtTime(0, now + 0.3);
    
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'arcade') {
    // Jump sound
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(600, now + 0.2);
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.2);
    
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'glass') {
    // High pitched ting
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
    osc.start(now);
    osc.stop(now + 1.0);
  } else if (type === 'shimmer') {
    // FM synthesis simulation
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();
    
    carrier.type = 'sine';
    carrier.frequency.value = 440;
    
    modulator.type = 'triangle';
    modulator.frequency.value = 10;
    
    modGain.gain.value = 200;
    
    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(gain);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.5);
    gain.gain.linearRampToValueAtTime(0, now + 2.0);
    
    carrier.start(now);
    modulator.start(now);
    carrier.stop(now + 2.0);
    modulator.stop(now + 2.0);
    
    // Disconnect standard osc since we built a custom chain
    osc.disconnect();
  } else if (type === 'echo') {
    // Simple echo effect logic manually created with two blips
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(330, now);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.1);
    gain.gain.linearRampToValueAtTime(0, now + 0.3);
    
    osc.start(now);
    osc.stop(now + 0.3);
    
    // Echo
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(330, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    gain2.gain.setValueAtTime(0, now + 0.4);
    gain2.gain.linearRampToValueAtTime(0.15, now + 0.5);
    gain2.gain.linearRampToValueAtTime(0, now + 0.7);
    
    osc2.start(now + 0.4);
    osc2.stop(now + 0.7);
  }
};
