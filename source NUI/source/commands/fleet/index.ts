
import { createCommand } from '../commandBuilder';

export function registerFleetCommands() {
  createCommand({
    name: 'fleet',
    description: 'Panel de flota vehicular',
    usage: 'fleet',
    category: 'LOGISTICS',
    handler: async ({ terminal }) => {
      terminal.print('🚓 Abriendo panel de flota...', 'system');
      terminal.openModal('FLEET_MANAGER');
    }
  });
}
