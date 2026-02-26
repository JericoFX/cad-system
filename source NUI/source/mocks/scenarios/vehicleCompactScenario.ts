import type { Scenario } from '../types';

export const vehicleCompactScenario: Scenario = {
  id: 'VEHICLE_COMPACT',
  name: 'Vehicle CAD',
  description: 'Compact CAD interface for police vehicles',
  icon: '🚓',
  data: {
    cases: {},
    calls: {},
    units: {},
    persons: {},
    vehicles: {},
    evidence: [],
    traces: {},
    alerts: [],
    bloodRequests: {},
    fines: {},
    warrants: {},
  },
};