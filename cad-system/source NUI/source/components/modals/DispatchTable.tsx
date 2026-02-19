import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import {
  cadActions,
  cadState,
  type DispatchCall,
  type DispatchUnit,
  type SecurityCamera,
} from '~/stores/cadStore';
import { radioActions } from '~/stores/radioStore';
import { fetchNui } from '~/utils/fetchNui';
import { useNui } from '~/hooks/useNui';
import { Button, Modal } from '~/components/ui';

type DispatchGuardError = {
  ok: false;
  error: string;
};

type CameraListResponse = {
  ok: boolean;
  cameras?: SecurityCamera[];
  error?: string;
};

type CameraWatchResponse = {
  ok: boolean;
  camera?: SecurityCamera;
  error?: string;
};

type CameraStatusResponse = {
  ok: boolean;
  camera?: SecurityCamera;
  error?: string;
};

type CameraRemoveResponse = {
  ok: boolean;
  cameraId?: string;
  error?: string;
};

type SlaLevel = 'ok' | 'warning' | 'breach';

type PriorityThresholdMap = {
  p1: number;
  p2: number;
  p3: number;
  default: number;
};

type DispatchSettings = {
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

const DEFAULT_DISPATCH_SETTINGS: DispatchSettings = {
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

const isGuardError = (value: unknown): value is DispatchGuardError => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record.ok === false && typeof record.error === 'string';
};

const isDispatchCall = (value: unknown): value is DispatchCall => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return typeof (value as Record<string, unknown>).callId === 'string';
};

const cameraArrayToRecord = (items: SecurityCamera[]): Record<string, SecurityCamera> => {
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

const normalizeDispatchSettings = (source: unknown): DispatchSettings => {
  const record = source && typeof source === 'object' ? (source as Record<string, unknown>) : {};
  const sla = record.sla && typeof record.sla === 'object'
    ? (record.sla as Record<string, unknown>)
    : {};
  const pending = sla.pending && typeof sla.pending === 'object'
    ? (sla.pending as Record<string, unknown>)
    : {};
  const active = sla.active && typeof sla.active === 'object'
    ? (sla.active as Record<string, unknown>)
    : {};
  const autoAssignment = record.autoAssignment && typeof record.autoAssignment === 'object'
    ? (record.autoAssignment as Record<string, unknown>)
    : {};
  const servicePenalties = autoAssignment.servicePenalties && typeof autoAssignment.servicePenalties === 'object'
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
    refreshIntervalMs: clampNumber(
      record.refreshIntervalMs,
      DEFAULT_DISPATCH_SETTINGS.refreshIntervalMs,
      1000,
      60000
    ),
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

const getThresholdForPriority = (thresholds: PriorityThresholdMap, priority: number) => {
  if (priority <= 1) return thresholds.p1;
  if (priority === 2) return thresholds.p2;
  if (priority >= 3) return thresholds.p3;
  return thresholds.default;
};

export function DispatchTable() {
  const [selectedCallId, setSelectedCallId] = createSignal<string | null>(null);
  const [dispatchSettings, setDispatchSettings] = createSignal<DispatchSettings>(DEFAULT_DISPATCH_SETTINGS);
  const [nowMs, setNowMs] = createSignal(Date.now());
  const [searchQuery, setSearchQuery] = createSignal('');
  const [statusFilter, setStatusFilter] = createSignal<'ALL' | 'PENDING' | 'ACTIVE' | 'CLOSED'>('ALL');
  const [priorityFilter, setPriorityFilter] = createSignal<'ALL' | '1' | '2' | '3'>('ALL');
  const [unitTypeFilter, setUnitTypeFilter] = createSignal<'ALL' | 'PATROL' | 'EMS' | 'SUPERVISOR'>('ALL');
  const [creatingCall, setCreatingCall] = createSignal(false);
  const [cameraLoading, setCameraLoading] = createSignal(false);
  const [watchingCameraId, setWatchingCameraId] = createSignal<string | null>(null);
  const [callForm, setCallForm] = createSignal({
    title: '',
    type: 'GENERAL',
    priority: '2',
    location: '',
    description: '',
  });

  const callTypeOptions = createMemo(() => dispatchSettings().callTypeOptions);

  useNui('camera:viewStarted', (data) => {
    if (!data || !data.camera || !data.camera.cameraId) {
      return;
    }

    setWatchingCameraId(data.camera.cameraId);
  });

  useNui('camera:viewStopped', () => {
    setWatchingCameraId(null);
  });

  const allCalls = createMemo(() =>
    Object.values(cadState.dispatchCalls).sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === 'PENDING') return -1;
        if (b.status === 'PENDING') return 1;
        if (a.status === 'ACTIVE') return -1;
        if (b.status === 'ACTIVE') return 1;
      }

      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    })
  );

  const allUnits = createMemo(() => Object.values(cadState.dispatchUnits));

  const cameraGrid = createMemo(() =>
    Object.values(cadState.securityCameras).sort((a, b) => {
      if (a.cameraNumber !== b.cameraNumber) {
        return a.cameraNumber - b.cameraNumber;
      }

      return a.cameraId.localeCompare(b.cameraId);
    })
  );

  const activeWatchedCamera = createMemo(() => {
    const cameraId = watchingCameraId();
    if (!cameraId) {
      return null;
    }

    return cadState.securityCameras[cameraId] || null;
  });

  const metrics = createMemo(() => {
    const calls = allCalls();
    const units = allUnits();
    const pending = calls.filter((call) => call.status === 'PENDING').length;
    const active = calls.filter((call) => call.status === 'ACTIVE').length;
    const available = units.filter((unit) => unit.status === 'AVAILABLE').length;
    const busy = units.filter((unit) => unit.status === 'BUSY').length;
    return {
      pending,
      active,
      available,
      busy,
    };
  });

  const visibleCalls = createMemo(() => {
    const query = searchQuery().trim().toLowerCase();
    const status = statusFilter();
    const priority = priorityFilter();

    return allCalls().filter((call) => {
      if (status !== 'ALL' && call.status !== status) {
        return false;
      }

      if (priority !== 'ALL' && String(call.priority) !== priority) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [call.callId, call.title, call.location || '', call.description || '', call.type]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  });

  const selectedCall = createMemo(() => {
    const visible = visibleCalls();
    const callId = selectedCallId();
    if (callId) {
      const selectedFromVisible = visible.find((call) => call.callId === callId);
      if (selectedFromVisible) {
        return selectedFromVisible;
      }
    }

    return visible[0] || null;
  });

  const availableUnits = createMemo(() =>
    allUnits().filter((unit) => {
      if (unit.status !== 'AVAILABLE') {
        return false;
      }

      const typeFilter = unitTypeFilter();
      if (typeFilter === 'ALL') {
        return true;
      }

      return String(unit.type || '').toUpperCase() === typeFilter;
    })
  );

  const selectedCallAssignedUnits = createMemo(() => {
    const call = selectedCall();
    if (!call) {
      return [] as DispatchUnit[];
    }

    return Object.keys(call.assignedUnits)
      .map((unitId) => cadState.dispatchUnits[unitId])
      .filter((unit): unit is DispatchUnit => Boolean(unit));
  });

  const getCallAgeMinutes = (iso: string) => {
    const createdAt = new Date(iso).getTime();
    if (Number.isNaN(createdAt)) {
      return 0;
    }

    return Math.max(0, Math.floor((nowMs() - createdAt) / 60000));
  };

  const getCallSlaLevel = (call: DispatchCall): SlaLevel => {
    const settings = dispatchSettings();
    if (!settings.sla.enabled) {
      return 'ok';
    }

    if (call.status === 'CLOSED') {
      return 'ok';
    }

    const ageMinutes = getCallAgeMinutes(call.createdAt);
    if (call.status === 'PENDING') {
      const warningAt = getThresholdForPriority(settings.sla.pending.warningMinutes, call.priority);
      const breachAt = getThresholdForPriority(settings.sla.pending.breachMinutes, call.priority);
      if (ageMinutes >= breachAt) return 'breach';
      if (ageMinutes >= warningAt) return 'warning';
      return 'ok';
    }

    if (call.status === 'ACTIVE') {
      const warningAt = getThresholdForPriority(settings.sla.active.warningMinutes, call.priority);
      const breachAt = getThresholdForPriority(settings.sla.active.breachMinutes, call.priority);
      if (ageMinutes >= breachAt) return 'breach';
      if (ageMinutes >= warningAt) return 'warning';
      return 'ok';
    }

    return 'ok';
  };

  const getCallSlaLabel = (call: DispatchCall) => {
    const level = getCallSlaLevel(call);
    if (level === 'breach') return 'SLA BREACH';
    if (level === 'warning') return 'SLA WARNING';
    return 'SLA OK';
  };

  const isMedicalCall = (call: DispatchCall) => {
    const haystack = `${call.type} ${call.title} ${call.description || ''}`.toUpperCase();
    return (
      haystack.includes('EMS') ||
      haystack.includes('MEDICAL') ||
      haystack.includes('INJUR') ||
      haystack.includes('AMBUL') ||
      haystack.includes('UNCONSCIOUS')
    );
  };

  const isEmsUnit = (unit: DispatchUnit) => {
    const unitType = String(unit.type || '').toUpperCase();
    return unitType.includes('EMS') || unitType.includes('AMBULANCE') || unitType.includes('MEDIC');
  };

  const recommendedUnit = createMemo(() => {
    // Tip rapido: si no hay unit libre o la call ya cerro, no hacemos nada papu.
    const call = selectedCall();
    const settings = dispatchSettings();
    if (!call || call.status === 'CLOSED') {
      return null;
    }

    if (!settings.autoAssignment.enabled) {
      return null;
    }

    const candidates = allUnits().filter((unit) => unit.status === 'AVAILABLE');
    if (!candidates.length) {
      return null;
    }

    const wantsEms = isMedicalCall(call);
    const callCoords = call.coordinates;

    const scored = candidates
      .map((unit) => {
        const ems = isEmsUnit(unit);
        const servicePenalty = wantsEms
          ? (ems ? 0 : settings.autoAssignment.servicePenalties.needsEmsButNotEms)
          : (ems ? settings.autoAssignment.servicePenalties.nonMedicalEms : 0);

        let distance = 0;
        let distancePenalty = settings.autoAssignment.unknownDistancePenalty;
        if (callCoords && unit.location) {
          const dx = unit.location.x - callCoords.x;
          const dy = unit.location.y - callCoords.y;
          const dz = unit.location.z - callCoords.z;
          distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
          distancePenalty = Math.floor(distance / settings.autoAssignment.distanceMetersPerPenaltyPoint);
        }

        return {
          unit,
          distance,
          score: servicePenalty + distancePenalty,
        };
      })
      .sort((a, b) => {
        if (a.score !== b.score) {
          return a.score - b.score;
        }

        return a.unit.unitId.localeCompare(b.unit.unitId);
      });

    const best = scored[0];
    const reason =
      callCoords && best.unit.location
        ? `Closest ${wantsEms ? 'EMS' : 'field'} unit`
        : `Best ${wantsEms ? 'EMS-role' : 'patrol-role'} match`;

    return {
      unit: best.unit,
      distance: best.distance,
      reason,
    };
  });

  const formatAge = (iso: string) => {
    const createdAt = new Date(iso).getTime();
    if (Number.isNaN(createdAt)) {
      return 'N/A';
    }

    const minutes = Math.max(0, Math.floor((nowMs() - createdAt) / 60000));
    if (minutes < 1) return '<1m';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    return `${hours}h ${rem}m`;
  };

  const priorityLabel = (priority: number) => {
    if (priority === 1) return 'HIGH';
    if (priority === 2) return 'MED';
    return 'LOW';
  };

  const getCaseActionLabel = (callId: string) => {
    const linkedCase = Object.values(cadState.cases).find((caseItem) => caseItem.linkedCallId === callId);
    return linkedCase ? 'OPEN CASE' : 'CREATE CASE';
  };

  const getDispatchChannelForUnit = (unit: DispatchUnit) => {
    return isEmsUnit(unit) ? 'CH-3' : 'CH-2';
  };

  const notifyCallToChannels = (call: DispatchCall, unitIds: string[], prefix = 'Assignment') => {
    if (!call || unitIds.length === 0) {
      return;
    }

    const unitLabels = unitIds.join(', ');
    const msg = `${prefix}: ${call.callId} -> ${unitLabels} | ${call.title}`;

    radioActions.injectSystemMessage('CH-1', msg, 'TEXT', 'DISPATCH', 'DSP');

    const sentChannels = new Set<string>();
    for (let i = 0; i < unitIds.length; i++) {
      const unit = cadState.dispatchUnits[unitIds[i]];
      if (!unit) continue;
      const channelId = getDispatchChannelForUnit(unit);
      if (sentChannels.has(channelId)) continue;
      sentChannels.add(channelId);
      radioActions.injectSystemMessage(channelId, msg, 'TEXT', 'DISPATCH', 'DSP');
    }

    terminalActions.addLine(`Radio notice sent: ${msg}`, 'system');
  };

  const formatCameraNumber = (cameraNumber: number) => String(cameraNumber || 0).padStart(4, '0');

  const getMockCameraBackground = (camera: SecurityCamera | null) => {
    if (camera) {
      return `/cctv-mock.svg?cam=${camera.cameraNumber}`;
    }

    return '/cctv-mock.svg';
  };

  const refreshCameraGrid = async (silent = false) => {
    setCameraLoading(true);

    try {
      const response = await fetchNui<CameraListResponse>('cad:cameras:list', {});
      if (!response || response.ok !== true) {
        terminalActions.addLine(
          `Failed to refresh CCTV grid: ${response?.error || 'unknown_error'}`,
          'error'
        );
        return;
      }

      const cameraList = Array.isArray(response.cameras) ? response.cameras : [];
      cadActions.setSecurityCameras(cameraArrayToRecord(cameraList));

      if (!silent) {
        terminalActions.addLine(`CCTV grid refreshed (${cameraList.length})`, 'system');
      }
    } catch (error) {
      terminalActions.addLine(`Failed to refresh CCTV grid: ${String(error)}`, 'error');
    } finally {
      setCameraLoading(false);
    }
  };

  const watchCamera = async (cameraId: string) => {
    try {
      const response = await fetchNui<CameraWatchResponse>('cad:cameras:watch', { cameraId });
      if (!response || response.ok !== true || !response.camera) {
        terminalActions.addLine(
          `Cannot open camera feed: ${response?.error || 'unknown_error'}`,
          'error'
        );
        return;
      }

      setWatchingCameraId(response.camera.cameraId);
      terminalActions.addLine(
        `Viewing camera #${formatCameraNumber(response.camera.cameraNumber)} (${response.camera.label})`,
        'system'
      );
    } catch (error) {
      terminalActions.addLine(`Cannot open camera feed: ${String(error)}`, 'error');
    }
  };

  const stopWatchingCamera = async (silent = false) => {
    if (!watchingCameraId()) {
      return;
    }

    try {
      await fetchNui<{ ok: boolean; error?: string }>('cad:cameras:stopWatch', {});
      if (!silent) {
        terminalActions.addLine('Camera feed closed', 'system');
      }
    } catch (error) {
      terminalActions.addLine(`Cannot close camera feed: ${String(error)}`, 'error');
    } finally {
      setWatchingCameraId(null);
    }
  };

  const setCameraStatus = async (cameraId: string, status: 'ACTIVE' | 'DISABLED') => {
    try {
      const response = await fetchNui<CameraStatusResponse>('cad:cameras:setStatus', {
        cameraId,
        status,
      });

      if (!response || response.ok !== true || !response.camera) {
        terminalActions.addLine(
          `Cannot update camera status: ${response?.error || 'unknown_error'}`,
          'error'
        );
        return;
      }

      cadActions.upsertSecurityCamera(response.camera);
      terminalActions.addLine(
        `Camera #${formatCameraNumber(response.camera.cameraNumber)} set to ${response.camera.status}`,
        'system'
      );

      if (status === 'DISABLED' && watchingCameraId() === response.camera.cameraId) {
        await stopWatchingCamera(true);
      }
    } catch (error) {
      terminalActions.addLine(`Cannot update camera status: ${String(error)}`, 'error');
    }
  };

  const removeCamera = async (camera: SecurityCamera) => {
    const confirmed = window.confirm(
      `Remove camera #${formatCameraNumber(camera.cameraNumber)} (${camera.label})?`
    );
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetchNui<CameraRemoveResponse>('cad:cameras:remove', {
        cameraId: camera.cameraId,
      });

      if (!response || response.ok !== true || !response.cameraId) {
        terminalActions.addLine(`Cannot remove camera: ${response?.error || 'unknown_error'}`, 'error');
        return;
      }

      cadActions.removeSecurityCamera(response.cameraId);
      terminalActions.addLine(
        `Camera #${formatCameraNumber(camera.cameraNumber)} removed from grid`,
        'system'
      );

      if (watchingCameraId() === response.cameraId) {
        await stopWatchingCamera(true);
      }
    } catch (error) {
      terminalActions.addLine(`Cannot remove camera: ${String(error)}`, 'error');
    }
  };

  const closePanel = () => {
    void stopWatchingCamera(true);
    terminalActions.setActiveModal(null);
  };

  const loadDispatchSettings = async () => {
    try {
      const response = await fetchNui<unknown>('cad:getDispatchSettings', {});
      setDispatchSettings(normalizeDispatchSettings(response));
    } catch (error) {
      terminalActions.addLine(`Failed loading dispatch settings, using defaults: ${String(error)}`, 'error');
      setDispatchSettings(DEFAULT_DISPATCH_SETTINGS);
    }
  };

  const assignUnitToCall = async (unitId: string, callId: string) => {
    try {
      const result = await fetchNui<DispatchCall | DispatchGuardError | null>('cad:assignUnitToCall', {
        unitId,
        callId,
      });

      if (isGuardError(result)) {
        terminalActions.addLine(`Assignment blocked: ${result.error}`, 'error');
        return;
      }

      if (!isDispatchCall(result)) {
        terminalActions.addLine('Assignment failed: invalid response', 'error');
        return;
      }

      cadActions.updateDispatchCall(callId, result);
      cadActions.updateDispatchUnit(unitId, {
        status: 'BUSY',
        currentCall: callId,
      });
      terminalActions.addLine(`Unit ${unitId} assigned to ${callId}`, 'output');
      notifyCallToChannels(result, [unitId], 'Assignment');
    } catch (error) {
      terminalActions.addLine(`Failed assigning unit: ${String(error)}`, 'error');
    }
  };

  const unassignUnit = async (unitId: string, callId?: string) => {
    const resolvedCallId = callId || cadState.dispatchUnits[unitId]?.currentCall;
    if (!resolvedCallId) {
      return;
    }

    try {
      const result = await fetchNui<DispatchCall | DispatchGuardError | null>('cad:unassignUnitFromCall', {
        unitId,
        callId: resolvedCallId,
      });

      if (isGuardError(result)) {
        terminalActions.addLine(`Unassign blocked: ${result.error}`, 'error');
        return;
      }

      if (!isDispatchCall(result)) {
        terminalActions.addLine('Unassign failed: invalid response', 'error');
        return;
      }

      cadActions.updateDispatchCall(resolvedCallId, result);
      cadActions.updateDispatchUnit(unitId, {
        status: 'AVAILABLE',
        currentCall: undefined,
      });
      terminalActions.addLine(`Unit ${unitId} released from ${resolvedCallId}`, 'output');
    } catch (error) {
      terminalActions.addLine(`Failed unassigning unit: ${String(error)}`, 'error');
    }
  };

  const closeCall = async (callId: string) => {
    try {
      const result = await fetchNui<DispatchCall | DispatchGuardError | null>('cad:closeDispatchCall', {
        callId,
        resolution: 'Closed by dispatcher',
      });

      if (isGuardError(result)) {
        terminalActions.addLine(`Close call blocked: ${result.error}`, 'error');
        return;
      }

      if (!isDispatchCall(result)) {
        terminalActions.addLine('Close call failed: invalid response', 'error');
        return;
      }

      cadActions.updateDispatchCall(callId, result);

      Object.keys(result.assignedUnits).forEach((unitId) => {
        cadActions.updateDispatchUnit(unitId, {
          status: 'AVAILABLE',
          currentCall: undefined,
        });
      });

      terminalActions.addLine(`Call ${callId} closed`, 'system');
    } catch (error) {
      terminalActions.addLine(`Failed closing call: ${String(error)}`, 'error');
    }
  };

  const autoAssignBestUnit = async () => {
   const call = selectedCall();
    const suggestion = recommendedUnit();

    if (!call || call.status === 'CLOSED') {
      terminalActions.addLine('Cannot auto-assign: call is closed or missing', 'error');
      return;
    }

    if (!suggestion) {
      terminalActions.addLine('No available unit for auto-assignment', 'error');
      return;
    }

    await assignUnitToCall(suggestion.unit.unitId, call.callId);
  };

  const createCaseFromCall = (callId: string) => {
    const call = cadState.dispatchCalls[callId];
    if (!call) {
      return;
    }

    const linkedCase = Object.values(cadState.cases).find((caseItem) => caseItem.linkedCallId === call.callId);
    if (linkedCase) {
      terminalActions.setActiveModal('CASE_MANAGER', { caseId: linkedCase.caseId });
      return;
    }

    terminalActions.setActiveModal('CASE_CREATOR', {
      linkedCallId: call.callId,
      linkedUnits: Object.keys(call.assignedUnits),
      initialTitle: call.title,
      initialDescription: call.description,
      initialPriority: call.priority,
    });
  };

  const submitNewCall = async () => {
    const payload = callForm();
    if (payload.title.trim().length < 3) {
      terminalActions.addLine('Call title must have at least 3 characters', 'error');
      return;
    }

    setCreatingCall(true);
    try {
      const result = await fetchNui<DispatchCall | DispatchGuardError | null>('cad:createDispatchCall', {
        title: payload.title,
        type: payload.type,
        priority: Number(payload.priority),
        location: payload.location,
        description: payload.description,
      });

      if (isGuardError(result)) {
        terminalActions.addLine(`Create call blocked: ${result.error}`, 'error');
        return;
      }

      if (!isDispatchCall(result)) {
        terminalActions.addLine('Create call failed: invalid response', 'error');
        return;
      }

      cadActions.addDispatchCall(result);
      setSelectedCallId(result.callId);
      setCallForm({
        title: '',
        type: payload.type,
        priority: payload.priority,
        location: '',
        description: '',
      });
      terminalActions.addLine(`Dispatch call ${result.callId} created`, 'output');
      radioActions.injectSystemMessage('CH-1', `New call ${result.callId}: ${result.title}`, 'TEXT', 'DISPATCH', 'DSP');
    } catch (error) {
      terminalActions.addLine(`Failed creating call: ${String(error)}`, 'error');
    } finally {
      setCreatingCall(false);
    }
  };

  createEffect(() => {
    void loadDispatchSettings();
  });

  createEffect(() => {
    const options = callTypeOptions();
    const currentType = callForm().type;
    if (options.length > 0 && !options.includes(currentType)) {
      setCallForm((prev) => ({ ...prev, type: options[0] }));
    }
  });

  createEffect(() => {
    const selected = selectedCall();
    if (!selected) {
      setSelectedCallId(null);
      return;
    }

    if (selectedCallId() !== selected.callId) {
      setSelectedCallId(selected.callId);
    }
  });

  createEffect(() => {
    const cameraId = watchingCameraId();
    if (!cameraId) {
      return;
    }

    const camera = cadState.securityCameras[cameraId];
    if (!camera || camera.status !== 'ACTIVE') {
      void stopWatchingCamera(true);
    }
  });

  onMount(() => {
    void refreshCameraGrid(true);
  });

  onCleanup(() => {
    void stopWatchingCamera(true);
  });

  createEffect(() => {
    const settings = dispatchSettings();
    // Solo reloj local para timestamps.
    const clockInterval = window.setInterval(() => {
      setNowMs(Date.now());
    }, settings.clockTickMs);

    onCleanup(() => {
      window.clearInterval(clockInterval);
    });
  });

  return (
        <Modal.Root onClose={closePanel} useContentWrapper={false}>
      <div class="modal-content dispatch-table-modal dispatch-v2-modal" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header dispatch-v2-header">
          <h2>=== DISPATCH OPERATIONS CENTER ===</h2>
          <div class="dispatch-v2-header-actions">
            <Button.Root class="btn" onClick={() => terminalActions.setActiveModal('MAP', { returnModal: 'DISPATCH_PANEL' })}>[MAP]</Button.Root>
            <button class="modal-close" onClick={closePanel}>[X]</button>
          </div>
        </div>

        <Show when={watchingCameraId()}>
          <div class="dispatch-cctv-crt-overlay">
            <div
              class="dispatch-cctv-mock-feed"
              style={{
                'background-image': `url(${getMockCameraBackground(activeWatchedCamera())})`,
              }}
            />
            <div class="dispatch-cctv-crt-scanlines" />
            <div class="dispatch-cctv-crt-label">CCTV LIVE FEED</div>
            <Show when={activeWatchedCamera()}>
              {(cameraAccessor) => {
                const camera = cameraAccessor();
                return (
                  <div class="dispatch-cctv-crt-meta">
                    CAM #{formatCameraNumber(camera.cameraNumber)} | {camera.street || 'Unknown street'}
                  </div>
                );
              }}
            </Show>
          </div>
        </Show>

        <div class="dispatch-v2-kpis">
          <div class="dispatch-v2-kpi pending">
            <span>Pending Calls</span>
            <strong>{metrics().pending}</strong>
          </div>
          <div class="dispatch-v2-kpi active">
            <span>Active Calls</span>
            <strong>{metrics().active}</strong>
          </div>
          <div class="dispatch-v2-kpi available">
            <span>Units Available</span>
            <strong>{metrics().available}</strong>
          </div>
          <div class="dispatch-v2-kpi busy">
            <span>Units Busy</span>
            <strong>{metrics().busy}</strong>
          </div>
        </div>

        <div class="dispatch-v2-filters">
          <input
            class="input"
            type="text"
            placeholder="Search by call id, title, location, code"
            value={searchQuery()}
            onInput={(event) => setSearchQuery(event.currentTarget.value)}
          />
          <select class="input" value={statusFilter()} onChange={(event) => setStatusFilter(event.currentTarget.value as 'ALL' | 'PENDING' | 'ACTIVE' | 'CLOSED')}>
            <option value="ALL">ALL STATUS</option>
            <option value="PENDING">PENDING</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="CLOSED">CLOSED</option>
          </select>
          <select class="input" value={priorityFilter()} onChange={(event) => setPriorityFilter(event.currentTarget.value as 'ALL' | '1' | '2' | '3')}>
            <option value="ALL">ALL PRIORITY</option>
            <option value="1">HIGH</option>
            <option value="2">MEDIUM</option>
            <option value="3">LOW</option>
          </select>
          <select class="input" value={unitTypeFilter()} onChange={(event) => setUnitTypeFilter(event.currentTarget.value as 'ALL' | 'PATROL' | 'EMS' | 'SUPERVISOR')}>
            <option value="ALL">ALL UNIT TYPES</option>
            <option value="PATROL">PATROL</option>
            <option value="EMS">EMS</option>
            <option value="SUPERVISOR">SUPERVISOR</option>
          </select>
        </div>

        <div class="dispatch-v2-layout">
          <section class="dispatch-v2-column dispatch-v2-queue">
            <div class="dispatch-v2-section-title">CALL QUEUE ({visibleCalls().length})</div>
            <div class="dispatch-v2-call-list">
              <For each={visibleCalls()}>
                {(call) => (
                  <button
                    class={`dispatch-v2-call-card sla-${getCallSlaLevel(call)} ${selectedCall()?.callId === call.callId ? 'is-selected' : ''}`}
                    onClick={() => setSelectedCallId(call.callId)}
                  >
                    <div class="dispatch-v2-call-card-header">
                      <div style={{ display: 'flex', 'align-items': 'center', gap: '6px' }}>
                        <span class={`dispatch-v2-priority priority-${priorityLabel(call.priority).toLowerCase()}`}>
                          {priorityLabel(call.priority)}
                        </span>
                        <span class={`dispatch-v2-sla-badge sla-${getCallSlaLevel(call)}`}>
                          {getCallSlaLabel(call)}
                        </span>
                      </div>
                      <span class="dispatch-v2-call-id">{call.callId}</span>
                    </div>
                    <div class="dispatch-v2-call-title">{call.title}</div>
                    <div class="dispatch-v2-call-meta">
                      <span>{call.type}</span>
                      <span>{call.location || 'No location'}</span>
                    </div>
                    <div class="dispatch-v2-call-meta">
                      <span>{call.status}</span>
                      <span>{Object.keys(call.assignedUnits).length} units</span>
                      <span>{formatAge(call.createdAt)}</span>
                    </div>
                  </button>
                )}
              </For>
              <Show when={visibleCalls().length === 0}>
                <div class="empty-state">No calls match current filters</div>
              </Show>
            </div>
          </section>

          <section class="dispatch-v2-column dispatch-v2-workspace">
            <Show
              when={selectedCall()}
              fallback={
                <>
                  <div class="empty-state">Select a call to manage</div>
                  <div class="dispatch-v2-section-title">CCTV GRID ({cameraGrid().length})</div>
                  <div class="dispatch-cctv-toolbar">
                    <Button.Root class="btn" onClick={() => void refreshCameraGrid()} disabled={cameraLoading()}>
                      [{cameraLoading() ? 'REFRESHING...' : 'REFRESH CCTV'}]
                    </Button.Root>
                    <Show when={watchingCameraId()}>
                      <Button.Root class="btn btn-warning" onClick={() => void stopWatchingCamera()}>
                        [STOP VIEW]
                      </Button.Root>
                    </Show>
                  </div>
                  <div class="dispatch-cctv-grid">
                    <For each={cameraGrid()}>
                      {(camera) => (
                        <div class={`dispatch-cctv-card ${watchingCameraId() === camera.cameraId ? 'is-viewing' : ''}`}>
                          <div class="dispatch-cctv-card-header">
                            <strong>CAM #{formatCameraNumber(camera.cameraNumber)}</strong>
                            <span class={`dispatch-cctv-status status-${camera.status.toLowerCase()}`}>
                              {camera.status}
                            </span>
                          </div>
                          <div class="dispatch-cctv-card-title">{camera.label || `Camera ${formatCameraNumber(camera.cameraNumber)}`}</div>
                          <div class="dispatch-cctv-card-meta">{camera.street || 'Unknown street'}</div>
                          <div class="dispatch-cctv-card-meta">{camera.zone || 'No zone'}</div>
                          <div class="dispatch-cctv-card-actions">
                            <Button.Root
                              class="btn btn-primary"
                              disabled={camera.status !== 'ACTIVE'}
                              onClick={() => void watchCamera(camera.cameraId)}
                            >
                              [VER]
                            </Button.Root>
                            <Button.Root
                              class="btn"
                              onClick={() => void setCameraStatus(camera.cameraId, camera.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE')}
                            >
                              [{camera.status === 'ACTIVE' ? 'DISABLE' : 'ENABLE'}]
                            </Button.Root>
                            <Button.Root class="btn btn-danger" onClick={() => void removeCamera(camera)}>
                              [REMOVE]
                            </Button.Root>
                          </div>
                        </div>
                      )}
                    </For>
                    <Show when={cameraGrid().length === 0}>
                      <div class="empty-state">No security cameras installed yet</div>
                    </Show>
                  </div>
                </>
              }
            >
              {(callAccessor) => {
                const call = callAccessor();
                return (
                  <>
                    <div class="dispatch-v2-section-title">INCIDENT WORKSPACE</div>
                    <div class={`dispatch-v2-incident-card sla-${getCallSlaLevel(call)}`}>
                      <div class="dispatch-v2-incident-top">
                        <div>
                          <strong>{call.callId}</strong> - {call.title}
                        </div>
                        <span class={`dispatch-v2-priority priority-${priorityLabel(call.priority).toLowerCase()}`}>
                          {priorityLabel(call.priority)}
                        </span>
                      </div>
                      <div class="dispatch-v2-incident-row">
                        <span>Type: {call.type}</span>
                        <span>Status: {call.status}</span>
                        <span>Opened: {formatAge(call.createdAt)} ago</span>
                      </div>
                      <div class="dispatch-v2-incident-row">
                        <span class={`dispatch-v2-sla-badge sla-${getCallSlaLevel(call)}`}>
                          {getCallSlaLabel(call)}
                        </span>
                      </div>
                      <div class="dispatch-v2-incident-row">
                        <span>Location: {call.location || 'Unknown location'}</span>
                      </div>
                      <Show when={call.description?.trim()}>
                        <div class="dispatch-v2-call-description">{call.description}</div>
                      </Show>
                      <div class="dispatch-v2-incident-actions">
                        <Button.Root class="btn" onClick={() => createCaseFromCall(call.callId)}>
                          [{getCaseActionLabel(call.callId)}]
                        </Button.Root>
                        <Show when={Object.keys(call.assignedUnits).length > 0}>
                          <Button.Root
                            class="btn"
                            onClick={() => notifyCallToChannels(call, Object.keys(call.assignedUnits), 'Case update')}
                          >
                            [NOTIFY UNITS]
                          </Button.Root>
                        </Show>
                        <Show when={call.status !== 'CLOSED'}>
                          <Button.Root class="btn btn-danger" onClick={() => void closeCall(call.callId)}>
                            [CLOSE CALL]
                          </Button.Root>
                        </Show>
                      </div>
                    </div>

                    <div class="dispatch-v2-section-title">ASSIGNED UNITS ({selectedCallAssignedUnits().length})</div>
                    <div class="dispatch-v2-assigned-list">
                      <For each={selectedCallAssignedUnits()}>
                        {(unit) => (
                          <div class="dispatch-v2-unit-row">
                            <div>
                              <strong>{unit.unitId}</strong> {unit.name}
                              <div class="dispatch-v2-unit-sub">{unit.type} - {unit.status}</div>
                            </div>
                            <Button.Root class="btn btn-warning" onClick={() => void unassignUnit(unit.unitId, call.callId)}>
                              [RELEASE]
                            </Button.Root>
                          </div>
                        )}
                      </For>
                      <Show when={selectedCallAssignedUnits().length === 0}>
                        <div class="empty-state">No units currently assigned</div>
                      </Show>
                    </div>

                    <div class="dispatch-v2-section-title">AVAILABLE UNITS ({availableUnits().length})</div>
                    <Show when={recommendedUnit()}>
                      {(suggestionAccessor) => {
                        const suggestion = suggestionAccessor();
                        return (
                          <div class="dispatch-v2-recommendation">
                            <div>
                              Suggested: <strong>{suggestion.unit.unitId}</strong> ({suggestion.unit.type}) - {suggestion.reason}
                              <Show when={suggestion.distance > 0}>
                                <span> [{Math.floor(suggestion.distance)}m]</span>
                              </Show>
                            </div>
                            <Button.Root class="btn btn-primary" onClick={() => void autoAssignBestUnit()} disabled={call.status === 'CLOSED'}>
                              [AUTO ASSIGN BEST]
                            </Button.Root>
                          </div>
                        );
                      }}
                    </Show>
                    <div class="dispatch-v2-available-list">
                      <For each={availableUnits()}>
                        {(unit) => (
                          <div class="dispatch-v2-unit-row">
                            <div>
                              <strong>{unit.unitId}</strong> {unit.name}
                              <div class="dispatch-v2-unit-sub">{unit.type}</div>
                            </div>
                            <Button.Root
                              class="btn btn-primary"
                              onClick={() => void assignUnitToCall(unit.unitId, call.callId)}
                              disabled={call.status === 'CLOSED'}
                            >
                              [ASSIGN]
                            </Button.Root>
                          </div>
                        )}
                      </For>
                      <Show when={availableUnits().length === 0}>
                        <div class="empty-state">No available units with current type filter</div>
                      </Show>
                    </div>

                    <div class="dispatch-v2-section-title">CCTV GRID ({cameraGrid().length})</div>
                    <div class="dispatch-cctv-toolbar">
                      <Button.Root class="btn" onClick={() => void refreshCameraGrid()} disabled={cameraLoading()}>
                        [{cameraLoading() ? 'REFRESHING...' : 'REFRESH CCTV'}]
                      </Button.Root>
                      <Show when={watchingCameraId()}>
                        <Button.Root class="btn btn-warning" onClick={() => void stopWatchingCamera()}>
                          [STOP VIEW]
                        </Button.Root>
                      </Show>
                    </div>
                    <div class="dispatch-cctv-grid">
                      <For each={cameraGrid()}>
                        {(camera) => (
                          <div class={`dispatch-cctv-card ${watchingCameraId() === camera.cameraId ? 'is-viewing' : ''}`}>
                            <div class="dispatch-cctv-card-header">
                              <strong>CAM #{formatCameraNumber(camera.cameraNumber)}</strong>
                              <span class={`dispatch-cctv-status status-${camera.status.toLowerCase()}`}>
                                {camera.status}
                              </span>
                            </div>
                            <div class="dispatch-cctv-card-title">{camera.label || `Camera ${formatCameraNumber(camera.cameraNumber)}`}</div>
                            <div class="dispatch-cctv-card-meta">{camera.street || 'Unknown street'}</div>
                            <div class="dispatch-cctv-card-meta">{camera.zone || 'No zone'}</div>
                            <div class="dispatch-cctv-card-actions">
                              <Button.Root
                                class="btn btn-primary"
                                disabled={camera.status !== 'ACTIVE'}
                                onClick={() => void watchCamera(camera.cameraId)}
                              >
                                [VER]
                              </Button.Root>
                              <Button.Root
                                class="btn"
                                onClick={() =>
                                  void setCameraStatus(
                                    camera.cameraId,
                                    camera.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
                                  )
                                }
                              >
                                [{camera.status === 'ACTIVE' ? 'DISABLE' : 'ENABLE'}]
                              </Button.Root>
                              <Button.Root class="btn btn-danger" onClick={() => void removeCamera(camera)}>
                                [REMOVE]
                              </Button.Root>
                            </div>
                          </div>
                        )}
                      </For>
                      <Show when={cameraGrid().length === 0}>
                        <div class="empty-state">No security cameras installed yet</div>
                      </Show>
                    </div>
                  </>
                );
              }}
            </Show>
          </section>

          <section class="dispatch-v2-column dispatch-v2-units">
            <div class="dispatch-v2-section-title">UNIT BOARD ({allUnits().length})</div>
            <div class="dispatch-v2-unit-board">
              <For each={allUnits()}>
                {(unit) => (
                  <div class="dispatch-v2-unit-board-row">
                    <div class="dispatch-v2-unit-main">
                      <div>
                        <strong>{unit.unitId}</strong> {unit.name}
                      </div>
                      <div class="dispatch-v2-unit-sub">{unit.type} | Badge {unit.badge}</div>
                    </div>
                    <div class="dispatch-v2-unit-right">
                      <span class={`dispatch-v2-status status-${unit.status.toLowerCase()}`}>{unit.status}</span>
                      <Show when={unit.currentCall}>
                        <span class="dispatch-v2-current-call">{unit.currentCall}</span>
                      </Show>
                      <Show when={unit.status === 'BUSY' && unit.currentCall}>
                        <Button.Root class="btn btn-warning" onClick={() => void unassignUnit(unit.unitId, unit.currentCall)}>
                          [RELEASE]
                        </Button.Root>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </section>
        </div>

        <div class="dispatch-v2-composer">
          <div class="dispatch-v2-section-title">CREATE INCIDENT</div>
          <div class="dispatch-v2-composer-grid">
            <input
              class="input"
              type="text"
              placeholder="Call title"
              value={callForm().title}
              onInput={(event) => setCallForm((prev) => ({ ...prev, title: event.currentTarget.value }))}
            />
            <input
              class="input"
              type="text"
              placeholder="Location"
              value={callForm().location}
              onInput={(event) => setCallForm((prev) => ({ ...prev, location: event.currentTarget.value }))}
            />
            <select
              class="input"
              value={callForm().type}
              onChange={(event) => setCallForm((prev) => ({ ...prev, type: event.currentTarget.value }))}
            >
              <For each={callTypeOptions()}>
                {(typeOption) => (
                  <option value={typeOption}>{typeOption}</option>
                )}
              </For>
            </select>
            <select
              class="input"
              value={callForm().priority}
              onChange={(event) => setCallForm((prev) => ({ ...prev, priority: event.currentTarget.value }))}
            >
              <option value="1">HIGH</option>
              <option value="2">MEDIUM</option>
              <option value="3">LOW</option>
            </select>
            <input
              class="input dispatch-v2-composer-description"
              type="text"
              placeholder="Short description"
              value={callForm().description}
              onInput={(event) => setCallForm((prev) => ({ ...prev, description: event.currentTarget.value }))}
            />
            <Button.Root class="btn btn-primary" onClick={() => void submitNewCall()} disabled={creatingCall()}>
              [{creatingCall() ? 'CREATING...' : 'CREATE CALL'}]
            </Button.Root>
          </div>
        </div>

        <div class="modal-footer">
          <span style={{ color: '#808080', 'font-size': '14px' }}>
            Profile {dispatchSettings().profileName.toUpperCase()} | Live sync every {Math.round(dispatchSettings().refreshIntervalMs / 1000)}s | Calls {allCalls().length} | Units {allUnits().length}
          </span>
          <Button.Root class="btn" onClick={closePanel}>[CLOSE]</Button.Root>
        </div>
      </div>
    </Modal.Root>
  );
}
