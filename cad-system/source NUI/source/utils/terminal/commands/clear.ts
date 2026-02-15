import { defineCommand } from '../registry';
import type { TerminalCommand } from '../types';

export const clearCommand: TerminalCommand = {
  name: 'clear',
  description: 'Limpia la pantalla de la terminal',
  category: 'system',
  args: [],
  format: 'custom',
  handler: async ({ terminal }) => {
    terminal.clear();
  }
};

defineCommand(clearCommand);
