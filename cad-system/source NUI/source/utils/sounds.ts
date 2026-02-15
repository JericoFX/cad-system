// Sound effects for CAD system
// Uses Web Audio API for system-like beeps

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// Generate a beep sound
const playBeep = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn('[Sounds] Audio playback failed:', e);
  }
};

// PTT press sound (low beep)
export const playPTTStart = () => {
  playBeep(800, 0.1, 'square');
};

// PTT release sound (high beep)
export const playPTTEnd = () => {
  playBeep(1200, 0.1, 'square');
};

// Dispatch incoming call sound (double beep)
export const playDispatchIncoming = () => {
  playBeep(1000, 0.2, 'sine');
  setTimeout(() => playBeep(1000, 0.2, 'sine'), 250);
};

// Emergency alert sound (urgent beeping)
export const playEmergencyAlert = () => {
  for (let i = 0; i < 5; i++) {
    setTimeout(() => playBeep(1500, 0.15, 'sawtooth'), i * 200);
  }
};

// Success sound (pleasant chime)
export const playSuccess = () => {
  playBeep(880, 0.1, 'sine');
  setTimeout(() => playBeep(1100, 0.15, 'sine'), 100);
};

// Error sound (low tone)
export const playError = () => {
  playBeep(200, 0.3, 'sawtooth');
};

// Radio chatter sound (static-like)
export const playRadioChatter = () => {
  try {
    const ctx = getAudioContext();
    const bufferSize = 4096;
    const whiteNoise = ctx.createScriptProcessor(bufferSize, 1, 1);
    
    whiteNoise.onaudioprocess = (e) => {
      const output = e.outputBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    };
    
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.02, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    
    whiteNoise.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    setTimeout(() => {
      whiteNoise.disconnect();
      gainNode.disconnect();
    }, 500);
  } catch (e) {
    console.warn('[Sounds] Radio chatter failed:', e);
  }
};

// Initialize audio context on first user interaction
export const initSounds = () => {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
};

// Check if audio is supported
export const isAudioSupported = (): boolean => {
  return !!(window.AudioContext || (window as any).webkitAudioContext);
};
