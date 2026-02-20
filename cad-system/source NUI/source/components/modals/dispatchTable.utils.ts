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

export type SlaLevel = 'ok' | 'warning' | 'breach';

export type PriorityThresholdMap = {
  p1: number;
  p2: number;
  p3: number;
  default: number;
};

export type DispatchSettings = {
  profileName: string;
  refreshIntervalMs: number;
  clockTickMs: number;
  callTypeOptions: string[];
  sla: {
    enabled: boolean;
    pending: {
      warningMinutes: PriorityThresholdMap;
      breachMinutes: PriorityThresholdMap;
    };
    active: {
      warningMinutes: PriorityThresholdMap;
      breachMinutes: PriorityThresholdMap;
    };
  };
  autoAssignment: {
    enabled: boolean;
    distanceMetersPerPenaltyPoint: number;
    unknownDistancePenalty: number;
    servicePenalties: {
      needsEmsButNotEms: number;
      nonMedicalEms: number;
    };
  };
};

export const DEFAULT_DISPATCH_SETTINGS: DispatchSettings = {
  profileName: 'standard',
  refreshIntervalMs: 8000,
  clockTickMs: 15000,
  callTypeOptions: ['GENERAL', '10-31', '10-50', '10-71', 'MEDICAL'],
  sla: {
    enabled: true,
    pending: {
      warningMinutes: { p1: 2, p2: 4, p3: 6, default: 6 },
      breachMinutes: { p1: 4, p2: 8, p3: 12, default: 12 },
    },
    active: {
      warningMinutes: { p1: 8, p2: 10, p3: 12, default: 12 },
      breachMinutes: { p1: 15, p2: 20, p3: 25, default: 25 },
    },
  },
  autoAssignment: {
    enabled: true,
    distanceMetersPerPenaltyPoint: 70,
    unknownDistancePenalty: 15,
    servicePenalties: {
      needsEmsButNotEms: 40,
      nonMedicalEms: 25,
    },
  },
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

const clampNumber = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.floor(parsed)));
};

const normalizeThresholdMap = (
  source: unknown,
  fallback: PriorityThresholdMap
): PriorityThresholdMap => {
  const record = source && typeof source === 'object' ? (source as Record<string, unknown>) : {};
  return {
    p1: clampNumber(record.p1, fallback.p1, 1, 999),
    p2: clampNumber(record.p2, fallback.p2, 1, 999),
    p3: clampNumber(record.p3, fallback.p3, 1, 999),
    default: clampNumber(record.default, fallback.default, 1, 999),
  };
};

export const normalizeDispatchSettings = (source: unknown): DispatchSettings => {
  const record = source && typeof source === 'object' ? (source as Record<string, unknown>) : {};
  const sla = record.sla && typeof record.sla === 'object' ? (record.sla as Record<string, unknown>) : {};
  const pending = sla.pending && typeof sla.pending === 'object' ? (sla.pending as Record<string, unknown>) : {};
  const active = sla.active && typeof sla.active === 'object' ? (sla.active as Record<string, unknown>) : {};
  const autoAssignment =
    record.autoAssignment && typeof record.autoAssignment === 'object'
      ? (record.autoAssignment as Record<string, unknown>)
      : {};
  const servicePenalties =
    autoAssignment.servicePenalties && typeof autoAssignment.servicePenalties === 'object'
      ? (autoAssignment.servicePenalties as Record<string, unknown>)
      : {};

  const callTypeOptions = Array.isArray(record.callTypeOptions)
    ? record.callTypeOptions
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().toUpperCase())
        .filter((item) => item.length > 0)
    : DEFAULT_DISPATCH_SETTINGS.callTypeOptions;

  return {
    profileName:
      typeof record.profileName === 'string' && record.profileName.trim().length
        ? record.profileName.trim().toLowerCase()
        : DEFAULT_DISPATCH_SETTINGS.profileName,
    refreshIntervalMs: clampNumber(record.refreshIntervalMs, DEFAULT_DISPATCH_SETTINGS.refreshIntervalMs, 1000, 60000),
    clockTickMs: clampNumber(record.clockTickMs, DEFAULT_DISPATCH_SETTINGS.clockTickMs, 1000, 60000),
    callTypeOptions: callTypeOptions.length ? callTypeOptions : DEFAULT_DISPATCH_SETTINGS.callTypeOptions,
    sla: {
      enabled: sla.enabled !== false,
      pending: {
        warningMinutes: normalizeThresholdMap(
          pending.warningMinutes,
          DEFAULT_DISPATCH_SETTINGS.sla.pending.warningMinutes
        ),
        breachMinutes: normalizeThresholdMap(
          pending.breachMinutes,
          DEFAULT_DISPATCH_SETTINGS.sla.pending.breachMinutes
        ),
      },
      active: {
        warningMinutes: normalizeThresholdMap(
          active.warningMinutes,
          DEFAULT_DISPATCH_SETTINGS.sla.active.warningMinutes
        ),
        breachMinutes: normalizeThresholdMap(
          active.breachMinutes,
          DEFAULT_DISPATCH_SETTINGS.sla.active.breachMinutes
        ),
      },
    },
    autoAssignment: {
      enabled: autoAssignment.enabled !== false,
      distanceMetersPerPenaltyPoint: clampNumber(
        autoAssignment.distanceMetersPerPenaltyPoint,
        DEFAULT_DISPATCH_SETTINGS.autoAssignment.distanceMetersPerPenaltyPoint,
        1,
        10000
      ),
      unknownDistancePenalty: clampNumber(
        autoAssignment.unknownDistancePenalty,
        DEFAULT_DISPATCH_SETTINGS.autoAssignment.unknownDistancePenalty,
        0,
        1000
      ),
      servicePenalties: {
        needsEmsButNotEms: clampNumber(
          servicePenalties.needsEmsButNotEms,
          DEFAULT_DISPATCH_SETTINGS.autoAssignment.servicePenalties.needsEmsButNotEms,
          0,
          1000
        ),
        nonMedicalEms: clampNumber(
          servicePenalties.nonMedicalEms,
          DEFAULT_DISPATCH_SETTINGS.autoAssignment.servicePenalties.nonMedicalEms,
          0,
          1000
        ),
      },
    },
  };
};

export const getThresholdForPriority = (thresholds: PriorityThresholdMap, priority: number) => {
  if (priority <= 1) return thresholds.p1;
  if (priority === 2) return thresholds.p2;
  if (priority >= 3) return thresholds.p3;
  return thresholds.default;
};
