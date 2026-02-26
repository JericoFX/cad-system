import { defineCommand, commandRegistry } from '../registry';
import type { TerminalCommand } from '../types';

const helpCommand: TerminalCommand = {
  name: 'help',
  description: 'Muestra información de comandos disponibles',
  category: 'system',
  args: [
    {
      name: 'command',
      type: 'string',
      required: false,
      description: 'Nombre del comando específico'
    }
  ],
  format: 'custom',
  handler: async ({ args, terminal }) => {
    if (args.command) {
      const cmd = commandRegistry.get(args.command);
      if (!cmd) {
        terminal.print(`❌ Comando '${args.command}' no encontrado`, 'error');
        return;
      }
      
      terminal.print(`\n📖 ${cmd.name.toUpperCase()}`, 'info');
      terminal.print(cmd.description);
      terminal.print(`\n📂 Categoría: ${cmd.category}`);
      
      if (cmd.permissions && cmd.permissions.length > 0) {
        terminal.print(`🔒 Permisos: ${cmd.permissions.join(', ')}`);
      }
      
      if (cmd.args.length > 0) {
        terminal.print('\n📋 Argumentos:');
        cmd.args.forEach(arg => {
          const req = arg.required ? '(requerido)' : '(opcional)';
          const def = arg.default ? `[default: ${arg.default}]` : '';
          terminal.print(`  ${arg.name}: ${arg.description} ${req} ${def}`);
          if (arg.choices) {
            terminal.print(`    Opciones: ${arg.choices.join(', ')}`);
          }
        });
      }
      
      if (cmd.interactive) {
        terminal.print('\n💡 Este comando es interactivo (pide datos)');
      }
      return;
    }
    
    const categories = commandRegistry.getCategories();
    
    terminal.print('\n📚 COMANDOS DISPONIBLES\n', 'info');
    
    categories.forEach(cat => {
      const cmds = commandRegistry.getByCategory(cat);
      if (cmds.length > 0) {
        terminal.print(`\n[${cat.toUpperCase()}]`, 'warning');
        cmds.forEach(cmd => {
          const perms = cmd.permissions ? ` [${cmd.permissions.join('/')}]` : '';
          terminal.print(`  ${cmd.name.padEnd(25)} - ${cmd.description}${perms}`);
        });
      }
    });
    
    terminal.print('\n💡 Usa: help <comando> para más detalles', 'info');
    terminal.print('💡 Usa: clear para limpiar la terminal', 'info');
  }
};

defineCommand(helpCommand);
