import { defineCommand } from '../registry';
import type { TerminalCommand } from '../types';

const viewCitizenReportsCommand: TerminalCommand = {
  name: 'view citizen-reports',
  description: 'Muestra reportes de un ciudadano con filtros y opción de exportar',
  category: 'reports',
  permissions: ['user', 'admin', 'officer', 'detective'],
  interactive: true,
  args: [
    {
      name: 'citizenId',
      type: 'number',
      required: true,
      description: 'ID del ciudadano (ej: 12345)'
    },
    {
      name: 'status',
      type: 'choice',
      required: false,
      choices: ['all', 'open', 'in_progress', 'resolved', 'closed', 'archived'],
      default: 'all',
      description: 'Filtrar por estado del reporte'
    },
    {
      name: 'year',
      type: 'number',
      required: false,
      description: 'Filtrar por año (ej: 2026)'
    },
    {
      name: 'type',
      type: 'choice',
      required: false,
      choices: ['all', 'criminal', 'traffic', 'civil', 'emergency', 'administrative'],
      default: 'all',
      description: 'Filtrar por tipo de reporte'
    },
    {
      name: 'priority',
      type: 'choice',
      required: false,
      choices: ['all', 'low', 'medium', 'high', 'critical'],
      default: 'all',
      description: 'Filtrar por prioridad'
    },
    {
      name: 'officer',
      type: 'string',
      required: false,
      description: 'Filtrar por oficial asignado'
    }
  ],
  format: 'custom',
  
  handler: async ({ args, terminal, fivem, user: _user }) => {
    const citizenId = args.citizenId;
    
    if (!citizenId) {
      terminal.print('❌ Error: Debes especificar el ID del ciudadano', 'error');
      terminal.print('💡 Uso: view citizen-reports <ID> [filtros]', 'info');
      terminal.print('   Ejemplo: view citizen-reports 12345 status=open', 'info');
      return;
    }
    
    const filters = [];
    if (args.status && args.status !== 'all') filters.push(`estado=${args.status}`);
    if (args.year) filters.push(`año=${args.year}`);
    if (args.type && args.type !== 'all') filters.push(`tipo=${args.type}`);
    if (args.priority && args.priority !== 'all') filters.push(`prioridad=${args.priority}`);
    if (args.officer) filters.push(`oficial=${args.officer}`);
    
    terminal.print(`🔍 Buscando reportes del ciudadano #${citizenId}...`, 'info');
    if (filters.length > 0) {
      terminal.print(`📋 Filtros aplicados: ${filters.join(', ')}`, 'info');
    }
    
    const stopLoading = terminal.showLoading('Consultando base de datos');
    
    try {
      const result = await fivem.fetch('getCitizenReports', {
        citizenId,
        status: args.status,
        year: args.year,
        type: args.type,
        priority: args.priority,
        officer: args.officer,
        includeDetails: false
      });
      
      stopLoading();
      
      if (!result.success) {
        terminal.print(`❌ Error: ${result.error || 'No se pudieron obtener los datos'}`, 'error');
        return;
      }
      
      if (!result.reports || result.reports.length === 0) {
        terminal.print(`\n📋 CIUDADANO: ${result.citizen?.name || 'Desconocido'} (ID: ${citizenId})`, 'info');
        terminal.print(`✅ El ciudadano no tiene reportes${filters.length > 0 ? ' con los filtros aplicados' : ''}`, 'success');
        return;
      }
      
      terminal.print(`\n═══════════════════════════════════════════`, 'info');
      terminal.print(`📋 CIUDADANO: ${result.citizen.name} (ID: ${citizenId})`, 'success');
      terminal.print(`   Teléfono: ${result.citizen.phone || 'N/A'}`, 'info');
      terminal.print(`   Dirección: ${result.citizen.address || 'N/A'}`, 'info');
      terminal.print(`   Licencia: ${result.citizen.license || 'N/A'}`, 'info');
      terminal.print(`═══════════════════════════════════════════`, 'info');
      
      const stats = {
        total: result.reports.length,
        open: result.reports.filter((r: any) => r.status === 'open').length,
        resolved: result.reports.filter((r: any) => r.status === 'resolved').length,
        critical: result.reports.filter((r: any) => r.priority === 'critical').length
      };
      
      terminal.print(`\n📊 ESTADÍSTICAS:`, 'warning');
      terminal.print(`   Total: ${stats.total} reportes`, 'info');
      terminal.print(`   Abiertos: ${stats.open} 🔴`, stats.open > 0 ? 'error' : 'info');
      terminal.print(`   Resueltos: ${stats.resolved} 🟢`, 'success');
      terminal.print(`   Críticos: ${stats.critical} ⚠️`, stats.critical > 0 ? 'error' : 'info');
      
      terminal.print(`\n📄 LISTA DE REPORTES:`, 'warning');
      terminal.printTable(result.reports, ['id', 'title', 'type', 'status', 'priority', 'date', 'officer']);
      
      if (result.reports.length > 10) {
        terminal.print(`\n💡 Mostrando 10 de ${result.reports.length} reportes. Usa filtros para refinar.`, 'info');
      }
      
      terminal.print(`\n❓ OPCIONES:`, 'warning');
      terminal.print('   1. Ver detalle de un reporte específico', 'info');
      terminal.print('   2. Exportar un reporte (generar item físico)', 'info');
      terminal.print('   3. Volver al menú principal', 'info');
      
      const option = await terminal.select('\n¿Qué deseas hacer?', [
        'Ver detalle de reporte',
        'Exportar reporte (item físico)',
        'Salir'
      ]);
      
      if (option === 'Ver detalle de reporte') {
        await viewReportDetail(terminal, fivem, result.reports);
      } else if (option === 'Exportar reporte (item físico)') {
        await exportReport(terminal, fivem, result.reports, result.citizen);
      } else {
        terminal.print('\n👋 Operación finalizada', 'info');
      }
      
    } catch (error) {
      stopLoading();
      terminal.print(`❌ Error de conexión: ${error}`, 'error');
      terminal.print('💡 Verifica que el servidor de FiveM esté activo', 'info');
    }
  }
};

async function viewReportDetail(terminal: any, fivem: any, _reports: any[]) {
  const reportId = await terminal.prompt('\n🔍 Ingresa el ID del reporte a consultar:');
  
  if (!reportId || reportId.trim() === '') {
    terminal.print('❌ Operación cancelada', 'error');
    return;
  }
  
  const loading = terminal.showLoading('Cargando detalle del reporte');
  
  try {
    const detail = await fivem.fetch('getReportDetail', { 
      reportId: parseInt(reportId) 
    });
    
    loading();
    
    if (!detail || !detail.success) {
      terminal.print(`❌ Reporte #${reportId} no encontrado`, 'error');
      return;
    }
    
    const r = detail.report;
    
    terminal.print(`\n═══════════════════════════════════════════`, 'info');
    terminal.print(`📄 REPORTE #${r.id}`, 'success');
    terminal.print(`═══════════════════════════════════════════`, 'info');
    
    terminal.printCard('Información General', {
      'ID': r.id,
      'Título': r.title,
      'Tipo': r.type,
      'Estado': getStatusEmoji(r.status) + ' ' + r.status,
      'Prioridad': getPriorityEmoji(r.priority) + ' ' + r.priority,
      'Fecha': r.date,
      'Ubicación': r.location
    });
    
    terminal.print('\n📝 DESCRIPCIÓN:', 'warning');
    terminal.print(r.description, 'info');
    
    if (r.officer) {
      terminal.printCard('Oficial Asignado', {
        'Nombre': r.officer.name,
        'Placa': r.officer.badge,
        'Teléfono': r.officer.phone,
        'Departamento': r.officer.department
      });
    }
    
    if (r.evidences && r.evidences.length > 0) {
      terminal.print(`\n📎 EVIDENCIAS (${r.evidences.length}):`, 'warning');
      r.evidences.forEach((ev: any, idx: number) => {
        terminal.print(`   [${idx + 1}] ${ev.type}: ${ev.description}`, 'info');
      });
    }
    
    if (r.notes && r.notes.length > 0) {
      terminal.print(`\n📋 NOTAS (${r.notes.length}):`, 'warning');
      r.notes.forEach((note: any) => {
        terminal.print(`   [${note.date}] ${note.author}: ${note.text}`, 'info');
      });
    }
    
    terminal.print(`\n💡 ACCIONES DISPONIBLES:`, 'warning');
    terminal.print(`   • edit report ${r.id} - Editar reporte`, 'info');
    terminal.print(`   • close report ${r.id} - Cerrar reporte`, 'info');
    terminal.print(`   • add note ${r.id} - Agregar nota`, 'info');
    terminal.print(`   • export report ${r.id} - Generar item físico`, 'info');
    
  } catch (error) {
    loading();
    terminal.print(`❌ Error al cargar detalle: ${error}`, 'error');
  }
}

async function exportReport(terminal: any, fivem: any, reports: any[], citizen: any) {
  const reportId = await terminal.prompt('\n📤 Ingresa el ID del reporte a exportar:');
  
  if (!reportId || reportId.trim() === '') {
    terminal.print('❌ Operación cancelada', 'error');
    return;
  }
  
  const report = reports.find((r: any) => r.id === parseInt(reportId));
  
  if (!report) {
    terminal.print(`❌ Reporte #${reportId} no encontrado en la lista`, 'error');
    return;
  }
  
  terminal.print(`\n📄 REPORTE A EXPORTAR:`, 'warning');
  terminal.print(`   ID: ${report.id}`, 'info');
  terminal.print(`   Título: ${report.title}`, 'info');
  terminal.print(`   Ciudadano: ${citizen.name} (ID: ${citizen.id})`, 'info');
  
  const confirmed = await terminal.confirm('\n⚠️ ¿Generar item físico en FiveM?');
  
  if (!confirmed) {
    terminal.print('❌ Exportación cancelada', 'error');
    return;
  }
  
  const loading = terminal.showLoading('Generando item físico');
  
  try {
    const result = await fivem.fetch('exportReportToItem', {
      reportId: parseInt(reportId),
      citizenId: citizen.id,
      generatedBy: 'Terminal System',
      timestamp: new Date().toISOString()
    });
    
    loading();
    
    if (result.success) {
      terminal.print(`\n✅ REPORTE EXPORTADO EXITOSAMENTE!`, 'success');
      terminal.print(`   Item ID: ${result.itemId}`, 'info');
      terminal.print(`   Tipo: ${result.itemType}`, 'info');
      terminal.print(`   Inventario: ${result.inventory}`, 'info');
      terminal.print(`\n💡 El item ha sido agregado a tu inventario`, 'info');
      terminal.print('   Usa el item para mostrar el reporte físicamente', 'info');
      
      if (result.itemData) {
        terminal.printCard('Datos del Item', {
          'Nombre': result.itemData.name,
          'Descripción': result.itemData.description,
          'Peso': result.itemData.weight + 'kg',
          'Único': result.itemData.unique ? 'Sí' : 'No'
        });
      }
    } else {
      terminal.print(`\n❌ Error al exportar: ${result.error}`, 'error');
      if (result.error === 'INVENTORY_FULL') {
        terminal.print('💡 Tu inventario está lleno. Libera espacio e intenta de nuevo.', 'warning');
      }
    }
    
  } catch (error) {
    loading();
    terminal.print(`❌ Error de conexión: ${error}`, 'error');
  }
}

function getStatusEmoji(status: string): string {
  const emojis: Record<string, string> = {
    'open': '🔴',
    'in_progress': '🟡',
    'resolved': '🟢',
    'closed': '⚪',
    'archived': '📦'
  };
  return emojis[status] || '⚪';
}

function getPriorityEmoji(priority: string): string {
  const emojis: Record<string, string> = {
    'low': '🟢',
    'medium': '🟡',
    'high': '🟠',
    'critical': '🔴'
  };
  return emojis[priority] || '⚪';
}

defineCommand(viewCitizenReportsCommand);
