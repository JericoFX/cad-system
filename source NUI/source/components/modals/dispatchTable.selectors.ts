import type { DispatchCall, DispatchUnit, SecurityCamera } from '~/stores/cadStore';
import { getThresholdForPriority, type DispatchSettings, type SlaLevel } from './dispatchTable.utils';

export const sortDispatchCalls = (calls: DispatchCall[]) =>
  [...calls].sort((a, b) => {
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
  });

export const sortCameraGrid = (cameras: SecurityCamera[]) =>
  [...cameras].sort((a, b) => {
    if (a.cameraNumber !== b.cameraNumber) {
      return a.cameraNumber - b.cameraNumber;
    }

    return a.cameraId.localeCompare(b.cameraId);
  });

export const calculateDispatchMetrics = (calls: DispatchCall[], units: DispatchUnit[]) => ({
  pending: calls.filter((call) => call.status === 'PENDING').length,
  active: calls.filter((call) => call.status === 'ACTIVE').length,
  available: units.filter((unit) => unit.status === 'AVAILABLE').length,
  busy: units.filter((unit) => unit.status === 'BUSY').length,
});

export const filterDispatchCalls = (
  calls: DispatchCall[],
  query: string,
  status: 'ALL' | 'PENDING' | 'ACTIVE' | 'CLOSED',
  priority: 'ALL' | '1' | '2' | '3'
) => {
  const normalizedQuery = query.trim().toLowerCase();

  return calls.filter((call) => {
    if (status !== 'ALL' && call.status !== status) {
      return false;
    }

    if (priority !== 'ALL' && String(call.priority) !== priority) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [call.callId, call.title, call.location || '', call.description || '', call.type]
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
};

export const selectDispatchCall = (calls: DispatchCall[], selectedCallId: string | null) => {
  if (selectedCallId) {
    const selected = calls.find((call) => call.callId === selectedCallId);
    if (selected) {
      return selected;
    }
  }

  return calls[0] || null;
};

export const filterAvailableDispatchUnits = (
  units: DispatchUnit[],
  unitTypeFilter: 'ALL' | 'PATROL' | 'EMS' | 'SUPERVISOR'
) =>
  units.filter((unit) => {
    if (unit.status !== 'AVAILABLE') {
      return false;
    }

    if (unitTypeFilter === 'ALL') {
      return true;
    }

    return String(unit.type || '').toUpperCase() === unitTypeFilter;
  });

export const mapAssignedUnits = (
  call: DispatchCall | null,
  dispatchUnits: Record<string, DispatchUnit>
) => {
  if (!call) {
    return [] as DispatchUnit[];
  }

  return Object.keys(call.assignedUnits)
    .map((unitId) => dispatchUnits[unitId])
    .filter((unit): unit is DispatchUnit => Boolean(unit));
};

const getCallAgeMinutes = (iso: string, nowMs: number) => {
  const createdAt = new Date(iso).getTime();
  if (Number.isNaN(createdAt)) {
    return 0;
  }

  return Math.max(0, Math.floor((nowMs - createdAt) / 60000));
};

export const getCallSlaLevel = (
  call: DispatchCall,
  settings: DispatchSettings,
  nowMs: number
): SlaLevel => {
  if (!settings.sla.enabled || call.status === 'CLOSED') {
    return 'ok';
  }

  const ageMinutes = getCallAgeMinutes(call.createdAt, nowMs);
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

export const getCallSlaLabel = (level: SlaLevel) => {
  if (level === 'breach') return 'SLA BREACH';
  if (level === 'warning') return 'SLA WARNING';
  return 'SLA OK';
};

export const isEmsUnit = (unit: DispatchUnit) => {
  const unitType = String(unit.type || '').toUpperCase();
  return unitType.includes('EMS') || unitType.includes('AMBULANCE') || unitType.includes('MEDIC');
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

export const getRecommendedUnit = (
  call: DispatchCall | null,
  settings: DispatchSettings,
  units: DispatchUnit[]
) => {
  if (!call || call.status === 'CLOSED' || !settings.autoAssignment.enabled) {
    return null;
  }

  const candidates = units.filter((unit) => unit.status === 'AVAILABLE');
  if (!candidates.length) {
    return null;
  }

  const wantsEms = isMedicalCall(call);
  const callCoords = call.coordinates;

  const scored = candidates
    .map((unit) => {
      const ems = isEmsUnit(unit);
      const servicePenalty = wantsEms
        ? ems
          ? 0
          : settings.autoAssignment.servicePenalties.needsEmsButNotEms
        : ems
          ? settings.autoAssignment.servicePenalties.nonMedicalEms
          : 0;

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
};

export const formatCallAge = (iso: string, nowMs: number) => {
  const createdAt = new Date(iso).getTime();
  if (Number.isNaN(createdAt)) {
    return 'N/A';
  }

  const minutes = Math.max(0, Math.floor((nowMs - createdAt) / 60000));
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return `${hours}h ${rem}m`;
};

export const priorityLabel = (priority: number) => {
  if (priority === 1) return 'HIGH';
  if (priority === 2) return 'MED';
  return 'LOW';
};

export const getDispatchChannelForUnit = (unit: DispatchUnit) => (isEmsUnit(unit) ? 'CH-3' : 'CH-2');
