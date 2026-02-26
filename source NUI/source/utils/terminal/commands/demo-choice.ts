import { defineCommand } from '../registry';
import type { TerminalCommand } from '../types';

defineCommand({
  name: 'demo-choice',
  description: 'Demonstra el uso de seleccion interactiva (select)',
  category: 'demo',
  interactive: true,
  args: [],
  format: 'custom',
  handler: async ({ terminal }) => {
    terminal.print('\n🎯 DEMO: Comando Interactivo con Select', 'info');
    terminal.print('Este comando muestra como usar la funcion select()\n', 'info');
    terminal.print('💡 Instrucciones: Escribe el NUMERO de la opcion y presiona ENTER\n', 'warning');
    
    const color = await terminal.select('Elige un color:', [
      'Rojo - Para alertas importantes',
      'Azul - Para informacion general',
      'Verde - Para confirmaciones',
      'Amarillo - Para advertencias'
    ]);
    
    terminal.print(`\n✅ Seleccionaste: ${color}`, 'success');
    
    const size = await terminal.select('Elige un tamano:', [
      'Pequeno',
      'Mediano',
      'Grande'
    ]);
    
    terminal.print(`✅ Tamano seleccionado: ${size}`, 'success');
    
    terminal.print('\n💡 Instrucciones: Escribe "s", "si", "y" o "yes" para confirmar', 'warning');
    terminal.print('                  Escribe "n" o "no" para cancelar\n', 'warning');
    const confirmed = await terminal.confirm('¿Confirmas estas selecciones?');
    
    if (confirmed) {
      terminal.print('\n✅ ¡Operacion confirmada!', 'success');
      terminal.print(`   Color: ${color}`, 'info');
      terminal.print(`   Tamano: ${size}`, 'info');
    } else {
      terminal.print('\n❌ Operacion cancelada', 'error');
    }
  }
} as TerminalCommand);
