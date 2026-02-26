// Sound effects for CAD system
// Uses GTA V native sounds via Lua bridge

import { fetchNui } from './fetchNui';

// Play sound via Lua native
const playNativeSound = async (type: string): Promise<void> => {
  try {
    await fetchNui('playSound', { type });
  } catch (e) {
    // Silently fail - sounds are optional
    console.warn('[Sounds] Failed to play sound:', type);
  }
};

// PTT press sound
export const playPTTStart = () => {
  playNativeSound('PTT_START');
};

// PTT release sound
export const playPTTEnd = () => {
  playNativeSound('PTT_END');
};

// Dispatch incoming call sound
export const playDispatchIncoming = () => {
  playNativeSound('DISPATCH_INCOMING');
};

// Emergency alert sound
export const playEmergencyAlert = () => {
  playNativeSound('EMERGENCY_ALERT');
};

// Success sound
export const playSuccess = () => {
  playNativeSound('SUCCESS');
};

// Error sound
export const playError = () => {
  playNativeSound('ERROR');
};

// UI click sound
export const playClick = () => {
  playNativeSound('CLICK');
};

// Back/cancel sound
export const playBack = () => {
  playNativeSound('BACK');
};

export const playBootStart = () => {
  playNativeSound('BOOT_START');
};

export const playBootStep = () => {
  playNativeSound('BOOT_STEP');
};

export const playBootReady = () => {
  playNativeSound('BOOT_READY');
};

// Initialize (no-op for native sounds, they work immediately)
export const initSounds = () => {
  // Native sounds don't need initialization
};

// Check if sounds are supported
export const isAudioSupported = (): boolean => {
  return true; // Native sounds are always supported in FiveM
};
