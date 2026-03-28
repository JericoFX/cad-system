
import { createCommand } from '../commandBuilder';

export function registerEMSDashboardCommand(): void {
  createCommand({
    name: 'ems',
    aliases: ['emergency', 'ems-dashboard'],
    description: 'Open EMS Dashboard GUI',
    usage: 'ems',
    category: 'EMS',
    permissions: ['ems'],
    handler: async ({ terminal }) => {
      terminal.openModal('EMS_DASHBOARD');
      terminal.print('Opening EMS Dashboard...', 'system');
    }
  });
}
