import { SoundType } from '../types';

let audioCtx: AudioContext | null = null;
let standbyAudioEl: HTMLAudioElement | null = null;
let isStandbyGuardRunning = false;

// Call this function on any user interaction (click/touch) to unlock audio on mobile
export const initAudio = () => {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch (e) {
    console.warn('initAudio error:', e);
  }
};

// Automatically unlock audio context and arm lock-screen audio guard on the first user tap anywhere
if (typeof window !== 'undefined') {
  const autoUnlock = () => {
    initAudio();
    if (localStorage.getItem('medimind_standby_guard') !== 'false') {
      startStandbyAudioGuard('Armed & Ready');
    }
    window.removeEventListener('click', autoUnlock);
    window.removeEventListener('touchstart', autoUnlock);
  };
  window.addEventListener('click', autoUnlock, { passive: true });
  window.addEventListener('touchstart', autoUnlock, { passive: true });
}

// Generate a clean, 16-bit PCM WAV data URI for alarm chimes so HTML5 audio can play even when backgrounded
function createWavDataUri(tones: { freq: number; duration: number }[]): string {
  const sampleRate = 22050;
  let totalSamples = 0;
  tones.forEach(t => totalSamples += Math.floor(sampleRate * t.duration));
  
  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);

  // RIFF header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true);  // NumChannels (1 mono)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true);  // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, 'data');
  view.setUint32(40, totalSamples * 2, true);

  // Generate PCM samples with gentle envelope to avoid clicks
  let offset = 44;
  tones.forEach(t => {
    const toneSamples = Math.floor(sampleRate * t.duration);
    const attack = Math.min(200, Math.floor(toneSamples * 0.1));
    const decay = Math.floor(toneSamples * 0.4);

    for (let i = 0; i < toneSamples; i++) {
      let amp = 0.65;
      if (i < attack) {
        amp = (i / attack) * 0.65;
      } else if (i > toneSamples - decay) {
        amp = ((toneSamples - i) / decay) * 0.65;
      }

      const sample = Math.sin((2 * Math.PI * t.freq * i) / sampleRate) * amp;
      const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  });

  // Convert to base64
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

// Pre-generated chimes as data URIs so they can play even when mobile screen is locked!
const CHIME_WAV_URIS: Record<string, string> = {
  alert: createWavDataUri([
    { freq: 784, duration: 0.16 },
    { freq: 1046.5, duration: 0.22 },
    { freq: 1318.5, duration: 0.40 }
  ]),
  chime: createWavDataUri([
    { freq: 523.25, duration: 0.18 },
    { freq: 659.25, duration: 0.18 },
    { freq: 880, duration: 0.45 }
  ]),
  glass: createWavDataUri([
    { freq: 1318.5, duration: 0.25 },
    { freq: 1568, duration: 0.35 }
  ]),
  harp: createWavDataUri([
    { freq: 523.25, duration: 0.12 },
    { freq: 659.25, duration: 0.12 },
    { freq: 783.99, duration: 0.12 },
    { freq: 1046.5, duration: 0.4 }
  ]),
  soft: createWavDataUri([
    { freq: 440, duration: 0.3 },
    { freq: 554.37, duration: 0.45 }
  ]),
  nature: createWavDataUri([
    { freq: 1600, duration: 0.12 },
    { freq: 2200, duration: 0.25 }
  ])
};

// Play audio using both HTML5 Audio element (survives lock screen) and Web Audio
export const playNotificationSound = (type: SoundType = 'alert') => {
  const soundName = (type === 'default' || !type) ? 'alert' : type;
  
  // 1. Play through HTML5 Audio element
  try {
    const uri = CHIME_WAV_URIS[soundName] || CHIME_WAV_URIS.alert;
    const audio = new Audio(uri);
    audio.volume = 1.0;
    const playPromise = audio.play();
    if (playPromise) {
      playPromise.catch((err) => {
        // Fallback to Web Audio if audio element was blocked
        playWebAudioTone(soundName);
      });
    }
  } catch (e) {
    playWebAudioTone(soundName);
  }

  // 2. Also play through Web Audio if active for extra clarity
  playWebAudioTone(soundName);
};

// Web Audio fallback implementation
function playWebAudioTone(soundName: string) {
  try {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    const ctx = audioCtx;
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.5, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur);
    };

    if (soundName === 'alert') {
      playTone(784, now, 0.18);
      playTone(1046.5, now + 0.15, 0.35);
      playTone(1318.5, now + 0.40, 0.45);
    } else {
      playTone(659.25, now, 0.2);
      playTone(880, now + 0.15, 0.35);
    }
  } catch (e) {}
}

/**
 * Standby Alarm Guardian:
 * Android Chrome suspends tabs and timers after ~30s of screen lock UNLESS
 * an active MediaSession is playing. By playing an imperceptible silent loop
 * with MediaSession metadata, Android treats MediMind as a foreground media
 * service, guaranteeing that timers and alarms fire reliably on the lock screen!
 */
export const startStandbyAudioGuard = (nextDoseLabel: string = 'Armed') => {
  if (typeof window === 'undefined') return;
  
  try {
    if (!standbyAudioEl) {
      // 1-second silent WAV URI
      const silentWavUri = createWavDataUri([{ freq: 20, duration: 1.0 }]);
      standbyAudioEl = new Audio(silentWavUri);
      standbyAudioEl.loop = true;
      standbyAudioEl.volume = 0.01; // Imperceptible volume to maintain Android foreground status
    }

    // Set Media Session metadata to show in Android lock screen media controls
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'MediMind Pill Reminders',
        artist: `Lock-Screen Protected • ${nextDoseLabel}`,
        album: 'Reminder Guard Active',
        artwork: [
          { src: 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png', sizes: '512x512', type: 'image/png' }
        ]
      });

      // Handle user media actions
      navigator.mediaSession.setActionHandler('play', () => {
        standbyAudioEl?.play().catch(() => {});
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        // Keep active
      });
    }

    standbyAudioEl.play().then(() => {
      isStandbyGuardRunning = true;
      console.log('[AudioService] Standby Audio Guard running for lock-screen reliability');
    }).catch((err) => {
      console.log('[AudioService] Standby Audio Guard waiting for user touch:', err);
    });
  } catch (e) {
    console.warn('[AudioService] Could not start standby guard:', e);
  }
};

export const stopStandbyAudioGuard = () => {
  if (standbyAudioEl) {
    try {
      standbyAudioEl.pause();
      isStandbyGuardRunning = false;
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
      }
    } catch (e) {}
  }
};

export const isStandbyAudioGuardActive = () => isStandbyGuardRunning;
