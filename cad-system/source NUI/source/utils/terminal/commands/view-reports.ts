import { defineCommand } from '../registry';
import type { TerminalCommand } from '../types';

const viewReportsCommand: TerminalCommand = {
  name: 'view reports',
  description: 'Muestra la lista de reportes',
  category: 'reports',
  permissions: ['user', 'admin'],
  args: [
    {
      name: 'status',
      type: 'choice',
      required: false,
      choices: ['all', 'open', 'in_progress', 'resolved', 'closed'],
      default: 'all',
      description: 'Filtrar por estado'
    }
  ],
  format: 'table',
  handler: async ({ args, terminal, fivem }) => {
    terminal.print('📄 Cargando reportes...', 'info');
    
    try {
      const reports = await fivem.fetch('getReports', {
        status: args.status
      });
      
      if (!reports || reports.length === 0) {
        terminal.print('⚠️ No hay reportes', 'warning');
        return;
      }
      
      terminal.print(`\n📋 Reportes encontrados: ${reports.length}\n`, 'success');
      
      terminal.printTable(reports, ['id', 'title', 'status', 'priority', 'date', 'location', 'officer']);
      
      const openCount = reports.filter((r: any) => r.status === 'open').length;
      if (openCount > 0) {
        terminal.print(`\n⚠️ ${openCount} reporte(s) pendiente(s) de atención`, 'warning');
      }
      
    } catch (error) {
      terminal.print(`❌ Error: ${error}`, 'error');
    }
  }
};

defineCommand(viewReportsCommand);
