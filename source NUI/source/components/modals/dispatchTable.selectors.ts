import type { DispatchCall, DispatchUnit, SecurityCamera } from '~/stores/cadStore';

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

export const getDispatchChannelForUnit = (unit: DispatchUnit) => {
  const unitType = String(unit.type || '').toUpperCase();
  const isEms = unitType.includes('EMS') || unitType.includes('AMBULANCE') || unitType.includes('MEDIC');
  return isEms ? 'CH-3' : 'CH-2';
};
