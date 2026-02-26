import { registry } from './registry';
import { terminalActions } from '~/stores/terminalStore';
import { cadActions } from '~/stores/cadStore';
import { helpActions } from '~/stores/helpStore';

registry.register({
  name: 'help',
  aliases: ['?', 'h'],
  description: 'Show command guide (F1 to toggle)',
  usage: 'help [command]',
  handler: (ctx) => {
    const searchTerm = ctx.args[0]?.toLowerCase();

    if (searchTerm) {
      const command = registry.get(searchTerm);
      if (command) {
        terminalActions.addLine(
          `=== ${command.name.toUpperCase()} ===`,
          'system',
        );
        terminalActions.addLine(
          `Description: ${command.description}`,
          'output',
        );
        terminalActions.addLine(`Usage: ${command.usage}`, 'output');
        if (command.aliases && command.aliases.length > 0) {
          terminalActions.addLine(
            `Aliases: ${command.aliases.join(', ')}`,
            'output',
          );
        }
        terminalActions.addLine('', 'output');
        terminalActions.addLine('Press F1 to open command guide with GUI', 'system');
      } else {
        terminalActions.addLine(`Command not found: ${searchTerm}`, 'error');
      }
      return;
    }

    helpActions.open();
    terminalActions.addLine('Opening command guide...', 'system');
    terminalActions.addLine('Press F1 anytime to toggle help', 'system');
  },
});

registry.register({
  name: 'clear',
  aliases: ['cls'],
  description: 'Clear terminal screen',
  usage: 'clear',
  handler: () => {
    terminalActions.clear();
  },
});

registry.register({
  name: 'exit',
  aliases: ['quit', 'q'],
  description: 'Exit C.A.D. system',
  usage: 'exit',
  handler: () => {
    terminalActions.addLine('Exiting C.A.D. system...', 'system');
    cadActions.clearAll();

    setTimeout(() => {
      if (typeof window !== 'undefined' && (window as any).invokeNative) {
        (window as any).invokeNative('closeApp');
      }
    }, 500);
  },
});

registry.register({
  name: 'status',
  aliases: ['st'],
  description: 'Show system status',
  usage: 'status',
  handler: () => {
    terminalActions.addLine('=== C.A.D. SYSTEM STATUS ===', 'system');
    terminalActions.addLine(`Version: 1.0.0`, 'output');
    terminalActions.addLine(`Status: ONLINE`, 'output');
    terminalActions.addLine(`By JericoFX`, 'output');
    terminalActions.addLine('', 'output');
    terminalActions.addLine('Data in memory:', 'system');
    terminalActions.addLine(
      '  (Store data persists for this session only)',
      'output',
    );
  },
});

registry.register({
  name: 'map',
  aliases: ['m'],
  description: 'Open tactical map',
  usage: 'map',
  handler: () => {
    terminalActions.setActiveModal('MAP');
    terminalActions.addLine('Opening tactical map...', 'system');
  },
});
