import type { Scenario } from '../types';

export const emptyScenario: Scenario = {
  id: 'EMPTY',
  name: 'Empty State',
  description: 'Clean state with no data. Ideal for testing from scratch.',
  icon: '📭',
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
