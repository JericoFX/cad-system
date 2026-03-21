import type { DispatchCall, SecurityCamera } from '~/stores/cadStore';

export type DispatchGuardError = {
  ok: false;
  error: string;
};

export type CameraListResponse = {
  ok: boolean;
  cameras?: SecurityCamera[];
  error?: string;
};

export type CameraWatchResponse = {
  ok: boolean;
  camera?: SecurityCamera;
  error?: string;
};

export type CameraStatusResponse = {
  ok: boolean;
  camera?: SecurityCamera;
  error?: string;
};

export type CameraRemoveResponse = {
  ok: boolean;
  cameraId?: string;
  error?: string;
};

export type DispatchSettings = {
  callTypeOptions: string[];
};

export const DEFAULT_DISPATCH_SETTINGS: DispatchSettings = {
  callTypeOptions: ['GENERAL', '10-31', '10-50', '10-71', 'MEDICAL'],
};

export const isGuardError = (value: unknown): value is DispatchGuardError => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record.ok === false && typeof record.error === 'string';
};

export const isDispatchCall = (value: unknown): value is DispatchCall => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return typeof (value as Record<string, unknown>).callId === 'string';
};

export const cameraArrayToRecord = (items: SecurityCamera[]): Record<string, SecurityCamera> => {
  const out: Record<string, SecurityCamera> = {};
  for (let i = 0; i < items.length; i += 1) {
    const camera = items[i];
    if (!camera || !camera.cameraId) {
      continue;
    }

    out[camera.cameraId] = camera;
  }

  return out;
};

export const normalizeDispatchSettings = (source: unknown): DispatchSettings => {
  const record = source && typeof source === 'object' ? (source as Record<string, unknown>) : {};

  const callTypeOptions = Array.isArray(record.callTypeOptions)
    ? record.callTypeOptions
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().toUpperCase())
        .filter((item) => item.length > 0)
    : DEFAULT_DISPATCH_SETTINGS.callTypeOptions;

  return {
    callTypeOptions: callTypeOptions.length ? callTypeOptions : DEFAULT_DISPATCH_SETTINGS.callTypeOptions,
  };
};
