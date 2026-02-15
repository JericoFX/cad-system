
import { createCommand } from '../commandBuilder';

export function registerPropertyCommands() {
  createCommand({
    name: 'property',
    description: 'Buscar propiedades',
    usage: 'property [dirección/ID]',
    category: 'CIVIL',
    args: [
      { name: 'query', type: 'string', required: false, description: 'Dirección o ID de ciudadano' }
    ],
    handler: async ({ args, terminal }) => {
      if (args.query) {
        terminal.print(`🏠 Buscando: ${args.query}`, 'system');
      } else {
        terminal.print('🏠 Abriendo registro de propiedades...', 'system');
      }
      terminal.openModal('PROPERTY_MANAGER');
    }
  });
}
