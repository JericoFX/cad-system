
import { registerNewsDashboardCommand } from './dashboard';

export function registerNewsCommands() {
  registerNewsDashboardCommand();
  console.log('[Commands] News commands registered');
}

export { registerNewsDashboardCommand } from './dashboard';
