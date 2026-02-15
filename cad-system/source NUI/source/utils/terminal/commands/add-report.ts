import { defineCommand } from '../registry';
import type { TerminalCommand } from '../types';

const addReportCommand: TerminalCommand = {
  name: 'add report',
  description: 'Crea un nuevo reporte en el sistema',
  category: 'reports',
  permissions: ['user', 'admin'],
  interactive: true,
  args: [],
  format: 'custom',
  handler: async ({ terminal, fivem, user }) => {
    terminal.print('\n📝 CREAR NUEVO REPORTE\n', 'info');
    
    const title = await terminal.prompt('Título del reporte:');
    if (!title || title.trim() === '') {
      terminal.print('❌ Cancelado: título requerido', 'error');
      return;
    }
    
    const description = await terminal.prompt('Descripción detallada:');
    if (!description) {
      terminal.print('❌ Cancelado', 'error');
      return;
    }
    
    const location = await terminal.prompt('Ubicación:');
    if (!location) {
      terminal.print('❌ Cancelado', 'error');
      return;
    }
    
    const priority = await terminal.select('Prioridad:', [
      'baja - No urgente',
      'media - Atención normal', 
      'alta - Atención prioritaria',
      'crítica - Emergencia'
    ]);
    
    const priorityMap: Record<string, string> = {
      'baja - No urgente': 'low',
      'media - Atención normal': 'medium',
      'alta - Atención prioritaria': 'high',
      'crítica - Emergencia': 'critical'
    };
    
    terminal.print('\n📋 Resumen del reporte:', 'info');
    terminal.printCard('Datos del reporte', {
      'Título': title,
      'Ubicación': location,
      'Prioridad': priority,
      'Creado por': user.name
    });
    
    const confirmed = await terminal.confirm('¿Crear este reporte?');
    if (!confirmed) {
      terminal.print('❌ Cancelado por el usuario', 'error');
      return;
    }
    
    terminal.print('\n⏳ Creando reporte...', 'info');
    
    try {
      const result = await fivem.fetch('createReport', {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        priority: priorityMap[priority] || 'medium',
        createdBy: user.name,
        createdAt: new Date().toISOString()
      });
      
      if (result.success) {
        terminal.print(`\n✅ Reporte creado exitosamente!`, 'success');
        terminal.print(`   ID: #${result.id}`, 'info');
        terminal.print(`   Usa 'view reports' para verlo`, 'info');
      } else {
        terminal.print(`\n❌ Error al crear: ${result.error}`, 'error');
      }
      
    } catch (error) {
      terminal.print(`\n❌ Error de conexión: ${error}`, 'error');
    }
  }
};

defineCommand(addReportCommand);
