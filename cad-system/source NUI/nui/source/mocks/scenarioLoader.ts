import { emptyStateScenario } from './scenarios/emptyStateScenario';
import { caseSearchScenario } from './scenarios/caseSearchScenario';
import { evidenceScenario } from './scenarios/evidenceScenario';
import { dispatchScenario } from './scenarios/dispatchScenario';
import { personSearchScenario } from './scenarios/personSearchScenario';
import { vehicleSearchScenario } from './scenarios/vehicleSearchScenario';
import { vehicleTestScenario } from './scenarios/vehicleTestScenario';

export const scenarios = {
  'Empty State': emptyStateScenario,
  'Vehicle Context': vehicleTestScenario,
  'Case Search': caseSearchScenario,
  'Evidence Collection': evidenceScenario,
  'Dispatch Board': dispatchScenario,
  'Person Search': personSearchScenario,
  'Vehicle Search': vehicleSearchScenario,
};