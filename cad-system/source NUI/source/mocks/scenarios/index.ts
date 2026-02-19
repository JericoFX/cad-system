import type { Scenario } from '../types';
import { emptyScenario } from './emptyScenario';
import { dispatchActiveScenario } from './dispatchActiveScenario';
import { forensicSceneScenario } from './forensicSceneScenario';
import { emsBusyScenario } from './emsBusyScenario';
import { investigationScenario } from './investigationScenario';
import { nightShiftScenario } from './nightShiftScenario';
import { trafficStopScenario } from './trafficStopScenario';
import { warrantServiceScenario } from './warrantServiceScenario';
import { drugBustScenario } from './drugBustScenario';
import { violentCrimeScenario } from './violentCrimeScenario';
import { accidentSceneScenario } from './accidentSceneScenario';
import { evidenceCollectionScenario } from './evidenceCollectionScenario';

import { vehicleCompactScenario } from './vehicleCompactScenario';

export const ALL_SCENARIOS: Scenario[] = [
  emptyScenario,
  vehicleCompactScenario,
  dispatchActiveScenario,
  forensicSceneScenario,
  emsBusyScenario,
  investigationScenario,
  nightShiftScenario,
  trafficStopScenario,
  warrantServiceScenario,
  drugBustScenario,
  violentCrimeScenario,
  accidentSceneScenario,
  evidenceCollectionScenario,
];

export function getScenarioById(id: string): Scenario | undefined {
  return ALL_SCENARIOS.find(s => s.id === id);
}

export function getAllScenarios(): Scenario[] {
  return ALL_SCENARIOS;
}

export { emptyScenario };
export { dispatchActiveScenario };
export { forensicSceneScenario };
export { emsBusyScenario };
export { investigationScenario };
export { nightShiftScenario };
export { trafficStopScenario };
export { warrantServiceScenario };
export { drugBustScenario };
export { violentCrimeScenario };
export { accidentSceneScenario };
export { evidenceCollectionScenario };
export { vehicleCompactScenario };
