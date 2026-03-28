import { fetchNui } from './fetchNui';

const playNativeSound = async (type: string): Promise<void> => {
  try {
    await fetchNui('playSound', { type });
  } catch (e) {
    console.warn('[Sounds] Failed to play sound:', type);
  }
};

export const playPTTStart = (): void => {
  playNativeSound('PTT_START');
};

export const playPTTEnd = (): void => {
  playNativeSound('PTT_END');
};

export const playDispatchIncoming = (): void => {
  playNativeSound('DISPATCH_INCOMING');
};

export const playEmergencyAlert = (): void => {
  playNativeSound('EMERGENCY_ALERT');
};

export const playSuccess = (): void => {
  playNativeSound('SUCCESS');
};

export const playError = (): void => {
  playNativeSound('ERROR');
};

export const playClick = (): void => {
  playNativeSound('CLICK');
};

export const playBack = (): void => {
  playNativeSound('BACK');
};

export const playBootStart = (): void => {
  playNativeSound('BOOT_START');
};

export const playBootStep = (): void => {
  playNativeSound('BOOT_STEP');
};

export const playBootReady = (): void => {
  playNativeSound('BOOT_READY');
};

export const initSounds = (): void => {};

export const isAudioSupported = (): boolean => {
  return true;
};
