
import { registerArrestCommand } from './arrest';
import { registerWarrantCommand } from './warrant';
import { registerImpoundCommand } from './impound';
import { registerPoliceDashboardCommand } from './dashboard';
import { registerBOLOCommands } from './bolo';

export function registerPoliceCommands() {
  registerPoliceDashboardCommand();
  registerArrestCommand();
  registerWarrantCommand();
  registerImpoundCommand();
  registerBOLOCommands();
}

export { registerArrestCommand } from './arrest';
export { registerWarrantCommand } from './warrant';
export { registerImpoundCommand } from './impound';
export { registerPoliceDashboardCommand } from './dashboard';
