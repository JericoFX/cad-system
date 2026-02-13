
import { registerTriageCommand } from './triage';
import { registerTreatmentCommand } from './treatment';
import { registerInventoryCommand } from './inventory';
import { registerEMSDashboardCommand } from './dashboard';

export function registerEMSCommands() {
  registerEMSDashboardCommand();
  registerTriageCommand();
  registerTreatmentCommand();
  registerInventoryCommand();
  console.log('[Commands] EMS commands registered');
}

export { registerTriageCommand } from './triage';
export { registerTreatmentCommand } from './treatment';
export { registerInventoryCommand } from './inventory';
export { registerEMSDashboardCommand } from './dashboard';
