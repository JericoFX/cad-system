import { defineCommand } from '../registry';
import type { TerminalCommand } from '../types';

const viewVehiclesCommand: TerminalCommand = {
  name: 'view vehicles',
  description: 'Lista todos los vehículos del sistema',
  category: 'vehicles',
  permissions: ['user', 'admin'],
  args: [
    {
      name: 'status',
      type: 'choice',
      required: false,
      choices: ['all', 'active', 'busy', 'maintenance', 'idle'],
      default: 'all',
      description: 'Filtrar por estado'
    },
    {
      name: 'location',
      type: 'string',
      required: false,
      description: 'Filtrar por ubicación'
    }
  ],
  format: 'table',
  handler: async ({ args, terminal, fivem }) => {
    terminal.print('🚗 Cargando vehículos...', 'info');
    
    const stopLoading = terminal.showLoading('Consultando base de datos');
    
    try {
      const vehicles = await fivem.fetch('getVehicles', {
        status: args.status,
        location: args.location
      });
      
      stopLoading();
      
      if (!vehicles || vehicles.length === 0) {
        terminal.print('⚠️ No se encontraron vehículos', 'warning');
        return;
      }
      
      terminal.print(`\n📋 Vehículos encontrados: ${vehicles.length}\n`, 'success');
      
      terminal.printTable(vehicles, ['id', 'name', 'type', 'status', 'location', 'driver']);
      
    } catch (error) {
      stopLoading();
      terminal.print(`❌ Error: ${error}`, 'error');
    }
  }
};

defineCommand(viewVehiclesCommand);
