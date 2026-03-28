
import { createCommand } from '../commandBuilder';

export function registerPoliceDashboardCommand(): void {
  createCommand({
    name: 'police',
    aliases: ['pd', 'police-dashboard'],
    description: 'Open Police Dashboard GUI',
    usage: 'police',
    category: 'POLICE',
    permissions: ['police'],
    handler: async ({ terminal }) => {
      terminal.openModal('POLICE_DASHBOARD');
      terminal.print('Opening Police Dashboard...', 'system');
    }
  });
}
