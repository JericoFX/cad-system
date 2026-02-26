
import { createCommand } from '../commandBuilder';
import { registerPersonSearchCommand } from './person';
import { registerVehicleSearchCommand } from './vehicle';

export function registerSearchCommands() {
  createCommand({
    name: 'search',
    description: 'Search help - shows available search commands',
    usage: 'search',
    category: 'SEARCH',
    handler: async ({ terminal }) => {
      terminal.print('\n=== SEARCH COMMANDS ===', 'system');
      terminal.print('Available search commands:', 'info');
      terminal.print('  search-person [name|id]  - Search for persons', 'info');
      terminal.print('  search-vehicle [plate]   - Search for vehicles', 'info');
      terminal.print('  person gui               - Open person search GUI', 'info');
      terminal.print('', 'info');
      terminal.print('Examples:', 'info');
      terminal.print('  search-person "John Doe"', 'info');
      terminal.print('  search-person CID001', 'info');
      terminal.print('  search-vehicle ABC123', 'info');
    }
  });
  
  registerPersonSearchCommand();
  registerVehicleSearchCommand();
}

export { registerPersonSearchCommand } from './person';
export { registerVehicleSearchCommand } from './vehicle';
